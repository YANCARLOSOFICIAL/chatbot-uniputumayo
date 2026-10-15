from app.services.document_service import select_chunker
from app.utils.chunking import chunk_normative_text, chunk_tabular_text, chunk_text


def test_spreadsheets_use_the_row_aware_chunker():
    assert select_chunker("xlsx", "cualquier texto") is chunk_tabular_text


def test_numbered_article_documents_use_the_article_chunker():
    text = " ".join(f"ARTÍCULO {i}. Algo." for i in range(1, 15))
    assert select_chunker("pdf", text) is chunk_normative_text


def test_plain_documents_keep_character_chunking():
    assert select_chunker("pdf", "Tríptico de oferta académica 2026-2 sin artículos.") is chunk_text
