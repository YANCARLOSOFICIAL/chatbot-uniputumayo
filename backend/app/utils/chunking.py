import logging
import re
from app.config import settings

logger = logging.getLogger(__name__)

SEPARATORS = [
    "\n\n\n",
    "\n\n",
    "\n",
    ". ",
    " ",
]

try:
    import tiktoken
    _ENCODING = tiktoken.get_encoding("cl100k_base")
except Exception:
    _ENCODING = None
    logger.warning("tiktoken unavailable — falling back to chars/4 token estimate")


def _count_tokens(text: str) -> int:
    """Real BPE token count via tiktoken (cl100k_base — a reasonable proxy
    even for non-OpenAI models, and far closer than a flat chars-per-token
    ratio, which over/under-counts Spanish text with accents and compound
    words). Falls back to the chars/4 heuristic only if tiktoken is missing.
    """
    if _ENCODING is not None:
        return len(_ENCODING.encode(text))
    return len(text) // 4


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[dict]:
    """Split text into chunks using recursive character splitting.

    Returns list of dicts with keys: content, token_count, metadata
    """
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap

    # Convert token counts to character counts (approx 4 chars per token for Spanish)
    max_chars = chunk_size * 4
    overlap_chars = chunk_overlap * 4

    raw_chunks = _recursive_split(text, max_chars, overlap_chars, SEPARATORS)

    result = []
    for i, chunk_content in enumerate(raw_chunks):
        chunk_content = chunk_content.strip()
        if not chunk_content:
            continue
        result.append({
            "content": chunk_content,
            "token_count": _count_tokens(chunk_content),
            "metadata": {"chunk_index": i},
        })

    return result


def _recursive_split(
    text: str,
    max_chars: int,
    overlap_chars: int,
    separators: list[str],
) -> list[str]:
    """Recursively split text by trying separators in order."""
    if len(text) <= max_chars:
        return [text] if text.strip() else []

    # Find the best separator
    separator = separators[-1]  # fallback to single space
    for sep in separators:
        if sep in text:
            separator = sep
            break

    parts = text.split(separator)

    chunks = []
    current_chunk = ""

    for part in parts:
        candidate = current_chunk + separator + part if current_chunk else part

        if len(candidate) <= max_chars:
            current_chunk = candidate
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Add overlap from end of previous chunk
                if overlap_chars > 0 and len(current_chunk) > overlap_chars:
                    overlap_text = current_chunk[-overlap_chars:]
                    current_chunk = overlap_text + separator + part
                else:
                    current_chunk = part
            else:
                # Single part is too large, try next separator
                if len(separators) > 1:
                    sub_chunks = _recursive_split(
                        part, max_chars, overlap_chars, separators[1:]
                    )
                    chunks.extend(sub_chunks)
                    current_chunk = ""
                else:
                    # Last resort: hard split
                    for i in range(0, len(part), max_chars - overlap_chars):
                        chunks.append(part[i : i + max_chars])
                    current_chunk = ""

    if current_chunk.strip():
        chunks.append(current_chunk)

    return chunks


# ── Row-aware chunking for spreadsheets / slide decks ────────────────────────

# Matches the section markers _extract_xlsx/_extract_xls/_extract_pptx (see
# file_parsers.py) prepend to each sheet/slide's rows.
_SECTION_RE = re.compile(r"^(=== HOJA: .+? ===|=== DIAPOSITIVA \d+ ===)$", re.MULTILINE)


def chunk_tabular_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[dict]:
    """Chunk spreadsheet/slide-deck text row-by-row instead of by raw characters.

    `chunk_text`'s generic recursive splitter treats a "=== HOJA: X ===" /
    "=== DIAPOSITIVA N ===" header and the row/table content after it as two
    separate top-level pieces once it picks the "\\n\\n" separator tier — for
    any sheet/slide whose rows don't all fit in one chunk, every chunk after
    the first ends up with no idea which sheet/slide it came from (and, in the
    worst case, a single oversized run of rows can land in one chunk far past
    `chunk_size` — the generic splitter only recurses into a finer separator
    when a lone part is too big *by itself*, not when it overflows after
    being combined with a preceding part). This chunker instead treats each
    section's rows as an atomic list, never splits a row across chunks, and
    repeats the section header on every chunk built from it.

    Text with no recognizable section headers (plain CSV) is treated as one
    headerless section — still chunked row-by-row rather than by characters.

    Within a section, a row with no " | " column separator (i.e. only one cell
    of the original row had content — the shape a merged cell like "SEMESTRE
    II" produces once row cells are pipe-joined; see _extract_xlsx et al.) is
    treated as a sub-header: it's tracked and repeated on every chunk split
    out of that sub-section, the same way the section's own "=== HOJA: X ==="
    header is repeated — otherwise only whichever single chunk happens to
    contain that row keeps its semester/section label, and every other chunk
    from a sub-section long enough to span multiple chunks loses it entirely.
    """
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap
    max_chars = chunk_size * 4
    overlap_chars = chunk_overlap * 4

    matches = list(_SECTION_RE.finditer(text))
    sections: list[tuple[str, str]] = []
    if not matches:
        sections.append(("", text))
    else:
        if matches[0].start() > 0:
            sections.append(("", text[: matches[0].start()]))
        for i, m in enumerate(matches):
            body_start = m.end()
            body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            sections.append((m.group(1), text[body_start:body_end]))

    result: list[dict] = []
    for header, body in sections:
        rows = [r for r in body.split("\n") if r.strip()]
        if not rows:
            continue

        section_prefix = f"{header}\n" if header else ""
        current_rows: list[str] = []
        current_len = 0
        active_subheader: str | None = None
        # A lone value with no " | " column separator is only a *sub-header*
        # when it's the odd one out among otherwise multi-column rows (e.g. a
        # "SEMESTRE II" row breaking up a code | materia | créditos table). A
        # section that's uniformly single-column throughout (a plain bulleted
        # list) has nothing to distinguish a "header" row from a normal one —
        # treating every row as its own sub-header there would fragment the
        # section into one tiny duplicated chunk per row for no benefit.
        has_multi_column_rows = any("|" in r for r in rows)

        def chunk_prefix() -> str:
            if active_subheader:
                return section_prefix + active_subheader + "\n"
            return section_prefix

        def flush_pending() -> None:
            # Nothing pending at all — fresh section, or the previous
            # sub-header already got its own standalone chunk below.
            if not current_rows and active_subheader is None:
                return
            content = (
                chunk_prefix() + "\n".join(current_rows) if current_rows
                # A sub-header with zero data rows under it (e.g. a flat list
                # where every entry is nominally its own "sub-header" — see
                # has_multi_column_rows below) still needs its own chunk so
                # it's never silently lost, but WITHOUT re-adding the label
                # as if it were a data row too: chunk_prefix() already shows
                # it. Doing that unconditionally used to render every such
                # entry twice — confirmed live on a real elective-course list
                # ("Ética" chunk read "Ética\nÉtica") and on a curriculum's
                # own semester labels ("SEMESTRE I" duplicated at chunk top).
                else chunk_prefix().rstrip()
            )
            if not content.strip():
                return
            result.append({
                "content": content,
                "token_count": _count_tokens(content),
                "metadata": {"chunk_index": len(result)},
            })

        for idx, row in enumerate(rows):
            # A single-column row only acts as a *header* when it introduces
            # a multi-column group right after it (e.g. "CICLO TECNOLÓGICO"
            # followed by "TD406 | 1 | Redes LAN"). When the next row is
            # itself single-column, this row is just another peer item in a
            # flat list (e.g. a run of elective names with no code/credits
            # attached) — confirmed live: without this check, a 25-item flat
            # list turned into 25 one-line chunks, each re-showing the
            # section header for a single course name.
            next_row = rows[idx + 1] if idx + 1 < len(rows) else None
            is_subheader = (
                has_multi_column_rows and "|" not in row
                and next_row is not None and "|" in next_row
            )

            if is_subheader:
                # Force a clean boundary: whatever was pending under the OLD
                # sub-header is flushed now (using the OLD chunk_prefix()),
                # so a transition row is never grouped under the wrong label
                # — a query about "segundo semestre" should never retrieve a
                # chunk still labeled/mixed with "primer semestre" content.
                flush_pending()
                active_subheader = row
                current_rows = []
                current_len = 0
                continue

            row_len = len(row) + 1  # +1 for the joining newline
            if current_rows and len(chunk_prefix()) + current_len + row_len > max_chars:
                flush_pending()
                # Carry the last row(s) forward as overlap so a record split
                # across a chunk boundary still has its neighbor for context.
                carry: list[str] = []
                carry_len = 0
                for r in reversed(current_rows):
                    if carry_len + len(r) + 1 > overlap_chars:
                        break
                    carry.insert(0, r)
                    carry_len += len(r) + 1
                current_rows = carry
                current_len = carry_len

            current_rows.append(row)
            current_len += row_len

        flush_pending()

    return result
