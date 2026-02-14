import logging
from app.config import settings

logger = logging.getLogger(__name__)

SEPARATORS = [
    "\n\n\n",
    "\n\n",
    "\n",
    ". ",
    " ",
]


def _count_tokens(text: str) -> int:
    """Approximate token count. Uses ~4 chars per token for Spanish text."""
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
