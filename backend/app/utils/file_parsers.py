import logging

logger = logging.getLogger(__name__)


def extract_text(file_path: str, file_type: str) -> str:
    """Extract text content from a file based on its type."""
    if file_type == "pdf":
        return _extract_pdf(file_path)
    elif file_type == "docx":
        return _extract_docx(file_path)
    elif file_type == "txt":
        return _extract_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_pdf(file_path: str) -> str:
    """Extract PDF text using coordinate-based row reconstruction.

    Standard text extraction fails on complex PDFs with rotated headers,
    multi-column layouts, or curriculum grids. This approach:
    1. Extracts all text blocks with their (x,y) coordinates
    2. Groups blocks that share the same vertical position into rows
    3. Sorts each row left-to-right to restore reading order
    """
    import fitz  # PyMuPDF

    all_pages = []

    with fitz.open(file_path) as doc:
        for page in doc:
            # Use "dict" mode to get word-level info with coordinates
            page_dict = page.get_text("dict")
            words = []

            for block in page_dict.get("blocks", []):
                if block.get("type") != 0:  # skip image blocks
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if not text:
                            continue
                        # Skip single-character noise typical of rotated text extraction
                        if len(text) == 1 and not text.isalpha():
                            continue
                        x0 = span["bbox"][0]
                        y0 = span["bbox"][1]
                        words.append((x0, y0, text))

            if not words:
                continue

            # Group words into rows by rounding Y to the nearest 6 pixels
            ROW_BUCKET = 6
            rows: dict[int, list[tuple[float, str]]] = {}
            for x0, y0, text in words:
                row_key = round(y0 / ROW_BUCKET) * ROW_BUCKET
                rows.setdefault(row_key, []).append((x0, text))

            # Build lines: sort rows top→bottom, words left→right
            page_lines = []
            for y_key in sorted(rows):
                row_words = sorted(rows[y_key], key=lambda w: w[0])
                line = " ".join(w for _, w in row_words)
                line = line.strip()
                # Filter lines that are pure noise (only numbers/codes, very short)
                meaningful_chars = sum(1 for c in line if c.isalpha())
                if len(line) > 3 and meaningful_chars >= 2:
                    page_lines.append(line)

            if page_lines:
                all_pages.append("\n".join(page_lines))

    return "\n\n".join(all_pages)


def _extract_docx(file_path: str) -> str:
    from docx import Document

    doc = Document(file_path)
    text_parts = []

    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text)

    # Also extract tables
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            non_empty = [c for c in cells if c]
            if len(non_empty) >= 2:
                text_parts.append(" | ".join(cells))

    return "\n\n".join(text_parts)


def _extract_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()
