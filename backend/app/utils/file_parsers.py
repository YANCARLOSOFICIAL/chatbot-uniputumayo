import logging

logger = logging.getLogger(__name__)

# Map of file extension → canonical type key used internally
_EXT_MAP: dict[str, str] = {
    "pdf":  "pdf",
    "docx": "docx",
    "doc":  "docx",   # python-docx can open modern .doc; very old binary .doc will fail gracefully
    "txt":  "txt",
    "md":   "txt",
    "xlsx": "xlsx",
    "xls":  "xls",
    "csv":  "csv",
    "pptx": "pptx",
}

# Human-readable list for error messages
SUPPORTED_EXTENSIONS: list[str] = sorted(_EXT_MAP.keys())


def normalize_extension(ext: str) -> str | None:
    """Return canonical file type for a file extension, or None if unsupported."""
    return _EXT_MAP.get(ext.lower().lstrip("."))


def extract_text(file_path: str, file_type: str) -> str:
    """Dispatch to the appropriate parser for the given canonical file type."""
    dispatch = {
        "pdf":  _extract_pdf,
        "docx": _extract_docx,
        "txt":  _extract_txt,
        "xlsx": _extract_xlsx,
        "xls":  _extract_xls,
        "csv":  _extract_csv,
        "pptx": _extract_pptx,
    }
    fn = dispatch.get(file_type)
    if fn is None:
        raise ValueError(f"Tipo de archivo no soportado: '{file_type}'")
    return fn(file_path)


# ── PDF ─────────────────────────────────────────────────────────────────────

def _extract_pdf(file_path: str) -> str:
    """Coordinate-based extraction that reconstructs reading order for complex layouts.

    Standard PyMuPDF get_text("text") scrambles columns and rotated grids (e.g.
    curriculum pensum tables).  This approach rebuilds rows from (x, y) spans.
    """
    import fitz  # PyMuPDF

    all_pages = []
    with fitz.open(file_path) as doc:
        for page in doc:
            page_dict = page.get_text("dict")
            words: list[tuple[float, float, str]] = []

            for block in page_dict.get("blocks", []):
                if block.get("type") != 0:  # skip image blocks
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if not text:
                            continue
                        if len(text) == 1 and not text.isalpha():
                            continue
                        words.append((span["bbox"][0], span["bbox"][1], text))

            if not words:
                continue

            ROW_BUCKET = 6
            rows: dict[int, list[tuple[float, str]]] = {}
            for x0, y0, text in words:
                key = round(y0 / ROW_BUCKET) * ROW_BUCKET
                rows.setdefault(key, []).append((x0, text))

            page_lines = []
            for y_key in sorted(rows):
                row_words = sorted(rows[y_key], key=lambda w: w[0])
                line = " ".join(w for _, w in row_words).strip()
                meaningful = sum(1 for c in line if c.isalpha())
                if len(line) > 3 and meaningful >= 2:
                    page_lines.append(line)

            if page_lines:
                all_pages.append("\n".join(page_lines))

    return "\n\n".join(all_pages)


# ── DOCX ─────────────────────────────────────────────────────────────────────

def _extract_docx(file_path: str) -> str:
    from docx import Document

    doc = Document(file_path)
    parts = []

    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            parts.append(paragraph.text)

    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            non_empty = [c for c in cells if c]
            if len(non_empty) >= 2:
                parts.append(" | ".join(non_empty))

    return "\n\n".join(parts)


# ── TXT / Markdown ────────────────────────────────────────────────────────────

def _extract_txt(file_path: str) -> str:
    """Try multiple encodings; Spanish files from Windows are often cp1252/latin-1."""
    for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, LookupError):
            continue
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        logger.warning("TXT file %s decoded with replacement characters", file_path)
        return f.read()


# ── Excel XLSX ────────────────────────────────────────────────────────────────

def _xlsx_cell_str(val) -> str:
    """Convert an openpyxl cell value to a clean string."""
    if val is None:
        return ""
    if isinstance(val, float) and val == int(val):
        return str(int(val))
    return str(val).strip()


def _extract_xlsx(file_path: str) -> str:
    """Extract all sheets from an XLSX file as labeled pipe-separated rows.

    data_only=True returns computed values instead of formulas, which is what we
    want for embedding (e.g. curricula with calculated credit totals).
    """
    import openpyxl

    wb = openpyxl.load_workbook(file_path, data_only=True)
    parts = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows_text: list[str] = []

        for row in ws.iter_rows(values_only=True):
            cells = [_xlsx_cell_str(c) for c in row]
            non_empty = [c for c in cells if c]
            if len(non_empty) >= 2:
                rows_text.append(" | ".join(cells).strip(" |"))

        if rows_text:
            parts.append(f"=== HOJA: {sheet_name} ===")
            parts.append("\n".join(rows_text))

    return "\n\n".join(parts)


# ── Excel XLS (legacy 97-2003) ────────────────────────────────────────────────

def _extract_xls(file_path: str) -> str:
    """Extract an old-format .xls workbook using xlrd."""
    import xlrd

    wb = xlrd.open_workbook(file_path)
    parts = []

    for sheet_idx in range(wb.nsheets):
        ws = wb.sheet_by_index(sheet_idx)
        rows_text: list[str] = []

        for r in range(ws.nrows):
            cells: list[str] = []
            for c_idx in range(ws.ncols):
                cell = ws.cell(r, c_idx)
                if cell.ctype == xlrd.XL_CELL_DATE:
                    try:
                        import datetime as _dt
                        val = xlrd.xldate_as_datetime(cell.value, wb.datemode).strftime("%Y-%m-%d")
                    except Exception:
                        val = str(cell.value)
                elif cell.ctype == xlrd.XL_CELL_NUMBER:
                    v = cell.value
                    val = str(int(v)) if v == int(v) else str(v)
                else:
                    val = str(cell.value).strip() if cell.value else ""
                cells.append(val)

            non_empty = [c for c in cells if c]
            if len(non_empty) >= 2:
                rows_text.append(" | ".join(cells).strip(" |"))

        if rows_text:
            parts.append(f"=== HOJA: {ws.name} ===")
            parts.append("\n".join(rows_text))

    return "\n\n".join(parts)


# ── CSV ───────────────────────────────────────────────────────────────────────

def _extract_csv(file_path: str) -> str:
    """Parse CSV with automatic encoding detection (covers UTF-8, BOM, Latin-1, cp1252)."""
    import csv

    encodings = ("utf-8-sig", "utf-8", "latin-1", "cp1252")
    for enc in encodings:
        try:
            rows_text: list[str] = []
            with open(file_path, newline="", encoding=enc) as f:
                reader = csv.reader(f)
                for row in reader:
                    cells = [c.strip() for c in row]
                    non_empty = [c for c in cells if c]
                    if len(non_empty) >= 2:
                        rows_text.append(" | ".join(cells).strip(" |"))
            return "\n".join(rows_text)
        except (UnicodeDecodeError, csv.Error):
            continue

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


# ── PowerPoint PPTX ───────────────────────────────────────────────────────────

def _extract_pptx(file_path: str) -> str:
    """Extract text from all slides, including shapes and tables."""
    from pptx import Presentation

    prs = Presentation(file_path)
    parts = []

    for slide_num, slide in enumerate(prs.slides, start=1):
        slide_texts: list[str] = []

        for shape in slide.shapes:
            # Text frames (titles, body, text boxes)
            if shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text:
                    slide_texts.append(text)
            # Tables in slides
            if shape.has_table:
                for trow in shape.table.rows:
                    cells = [c.text.strip() for c in trow.cells]
                    non_empty = [c for c in cells if c]
                    if len(non_empty) >= 2:
                        slide_texts.append(" | ".join(non_empty))

        if slide_texts:
            # "===" (not "---") — clean_text() strips runs of 3+ hyphens as
            # decorative separators, which would destroy a "---"-style marker
            # before chunk_tabular_text ever sees it.
            parts.append(f"=== DIAPOSITIVA {slide_num} ===")
            parts.append("\n".join(slide_texts))

    return "\n\n".join(parts)
