import re
import unicodedata


def normalize_for_match(text: str) -> str:
    """Lowercase, accent-stripped form of text for fuzzy word/substring matching."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def clean_text(text: str) -> str:
    """Clean and normalize text for chunking."""
    # Normalize Unicode (preserve Spanish characters)
    text = unicodedata.normalize("NFKC", text)

    # Remove excessive whitespace while preserving paragraph breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Remove page numbers (common patterns)
    text = re.sub(r"\n\s*\d+\s*\n", "\n", text)
    text = re.sub(r"Página\s+\d+\s+de\s+\d+", "", text, flags=re.IGNORECASE)

    # Remove common header/footer patterns
    text = re.sub(r"_{3,}", "", text)
    text = re.sub(r"-{3,}", "", text)

    # Strip leading/trailing whitespace from each line
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)

    # Remove empty lines at start/end
    text = text.strip()

    return text
