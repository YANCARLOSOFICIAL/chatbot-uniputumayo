import uuid

import pytest

from app.schemas.chat import SourceInfo
from app.services.chat_service import ChatService, _RAGContext
from app.utils.prompts import REFUSAL_MARKER


def make_rag_ctx(n_sources: int) -> _RAGContext:
    source_infos = [
        SourceInfo(
            chunk_id=uuid.uuid4(),
            document_title=f"Doc {i + 1}",
            content_preview="preview",
            score=0.5,
            program=None,
            faculty=None,
            citation_number=i + 1,
        )
        for i in range(n_sources)
    ]
    sources_payload = [
        {"citation_number": i + 1, "document_title": f"Doc {i + 1}"} for i in range(n_sources)
    ]
    return _RAGContext(
        context_text="context",
        sources_payload=sources_payload,
        source_infos=source_infos,
        quality="good",
        embed_ms=0,
        search_ms=0,
    )


@pytest.fixture
def service():
    return ChatService(db=None)


class TestFilterCitedSources:
    def test_refusal_marker_yields_zero_sources(self, service):
        rag_ctx = make_rag_ctx(3)
        payload, infos = service._filter_cited_sources(REFUSAL_MARKER, rag_ctx)
        assert payload == []
        assert infos == []

    def test_no_sources_available_yields_zero_sources(self, service):
        rag_ctx = make_rag_ctx(0)
        payload, infos = service._filter_cited_sources("Respuesta sin contexto [1]", rag_ctx)
        assert payload == []
        assert infos == []

    def test_uncited_answer_has_no_best_guess_fallback(self, service):
        rag_ctx = make_rag_ctx(3)
        payload, infos = service._filter_cited_sources("Hola, ¿en qué puedo ayudarte?", rag_ctx)
        assert payload == []
        assert infos == []

    def test_cited_sources_are_kept(self, service):
        rag_ctx = make_rag_ctx(3)
        payload, infos = service._filter_cited_sources("La respuesta está en [1] y [3].", rag_ctx)
        assert {p["citation_number"] for p in payload} == {1, 3}
        assert {i.citation_number for i in infos} == {1, 3}

    def test_out_of_range_citation_numbers_are_ignored(self, service):
        rag_ctx = make_rag_ctx(2)
        payload, infos = service._filter_cited_sources("Ver [1] y también [99].", rag_ctx)
        assert {p["citation_number"] for p in payload} == {1}

    def test_non_contiguous_citations_preserve_original_numbers(self, service):
        rag_ctx = make_rag_ctx(5)
        payload, infos = service._filter_cited_sources("Datos en [2] y [4].", rag_ctx)
        assert {p["citation_number"] for p in payload} == {2, 4}
        # Not renumbered to 1/2 by position — original citation_number is kept.
        assert all(p["citation_number"] in {2, 4} for p in payload)
