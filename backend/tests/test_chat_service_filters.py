import pytest

from app.schemas.rag import SearchFilters, SearchResponse
from app.services import chat_service as chat_service_module
from app.services.chat_service import ChatService

# Live 2026-10-18: "¿Cuáles son los requisitos de grado?" was answered from
# the Gastronomía document (its "Requisitos de grado: Deporte Formativo e
# Inglés" line) instead of the Estatuto's Artículo 58. The question names no
# program, so retrieval must prefer institution-wide (untagged) documents in
# the keyword leg — see SearchFilters.prefer_institutional.


class _FakeRAGService:
    last_request = None

    def __init__(self, db):
        pass

    async def search(self, request):
        _FakeRAGService.last_request = request
        return SearchResponse(results=[], query_embedding_time_ms=1, search_time_ms=1)

    def evaluate_context_quality(self, results):
        return "none"


@pytest.fixture(autouse=True)
def fake_rag_service(monkeypatch):
    _FakeRAGService.last_request = None
    monkeypatch.setattr(chat_service_module, "RAGService", _FakeRAGService)


def _program_filter(svc, program):
    async def fake_detect(query):
        return SearchFilters(program=program) if program else None
    svc._detect_program_filter = fake_detect


class TestRunRagFilters:
    async def test_procedural_without_program_prefers_institutional_and_excludes_pensum(self):
        svc = ChatService(db=None)
        _program_filter(svc, None)
        await svc._run_rag("¿Cuáles son los requisitos de grado?")
        f = _FakeRAGService.last_request.filters
        assert f.exclude_document_type == "pensum"
        assert f.prefer_institutional is True
        assert f.program is None

    async def test_procedural_with_program_keeps_program_scope(self):
        svc = ChatService(db=None)
        _program_filter(svc, "ingenieria de sistemas")
        await svc._run_rag("¿Cuáles son los requisitos de grado en ingeniería de sistemas?")
        f = _FakeRAGService.last_request.filters
        assert f.program == "ingenieria de sistemas"
        assert f.exclude_document_type == "pensum"
        assert f.prefer_institutional is False

    async def test_pecuniary_without_program_also_prefers_institutional(self):
        svc = ChatService(db=None)
        _program_filter(svc, None)
        await svc._run_rag("¿cuánto cuesta la matrícula?")
        f = _FakeRAGService.last_request.filters
        assert f.prefer_institutional is True

    async def test_ordinary_question_has_no_special_filters(self):
        svc = ChatService(db=None)
        _program_filter(svc, None)
        await svc._run_rag("¿qué materias tiene el primer semestre?")
        assert _FakeRAGService.last_request.filters is None
