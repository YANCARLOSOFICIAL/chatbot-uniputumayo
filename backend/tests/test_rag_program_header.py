import pytest

from app.config import settings
from app.schemas.rag import SearchFilters, SearchRequest
from app.services import rag_service as rag_service_module
from app.services.rag_service import RAGService
from tests.test_rag_multiquery import _FakeLLMService, _FakeRagCache, make_item

# Live 2026-10-18: "¿cuántos créditos tiene Ingeniería Ambiental?" was refused
# three times — the document header holding "Total de créditos del programa:
# 162" never reached the model. When the question names a program, the first
# chunk of that program's documents is injected as its own RRF list (see
# RAGService._program_header_chunks).


@pytest.fixture
def service(monkeypatch):
    _FakeLLMService.embed_calls = []
    monkeypatch.setattr(rag_service_module, "LLMService", _FakeLLMService)
    monkeypatch.setattr(rag_service_module, "rag_cache", _FakeRagCache())
    monkeypatch.setattr(settings, "rag_hyde_enabled", False)
    monkeypatch.setattr(settings, "rag_reranker_enabled", False)
    monkeypatch.setattr(settings, "rag_multiquery_enabled", False)
    return RAGService(db=None)


def _wire(service, monkeypatch, vector_items, header_items):
    calls = {"header": []}

    async def fake_vector_search(embedding, where_clause, base_params, candidate_k, threshold):
        return list(vector_items)

    async def fake_keyword_search(query, where_clause, base_params, exclude_ids, limit, prefer_institutional=False):
        return []

    async def fake_header(program, exclude_document_type=None):
        calls["header"].append((program, exclude_document_type))
        return list(header_items)

    monkeypatch.setattr(service, "_vector_search", fake_vector_search)
    monkeypatch.setattr(service, "_keyword_search", fake_keyword_search)
    monkeypatch.setattr(service, "_program_header_chunks", fake_header)
    return calls


class TestProgramHeaderInjection:
    async def test_header_chunk_joins_results_when_program_is_filtered(self, service, monkeypatch):
        header = make_item("MALLA CURRICULAR INGENIERÍA AMBIENTAL … Total de créditos del programa: 162", score=0.35)
        vector = [make_item("Hidraulica — Créditos: 2", score=0.8), make_item("Gestión de residuos — Créditos: 2", score=0.7)]
        calls = _wire(service, monkeypatch, vector, [header])

        resp = await service.search(SearchRequest(
            query="¿cuántos créditos tiene ingeniería ambiental?",
            filters=SearchFilters(program="ingenieria ambiental"),
        ))

        assert calls["header"] == [("ingenieria ambiental", None)]
        assert header.chunk_id in {r.chunk_id for r in resp.results}

    async def test_exclude_document_type_is_passed_through(self, service, monkeypatch):
        calls = _wire(service, monkeypatch, [make_item("x", score=0.8)], [])
        await service.search(SearchRequest(
            query="¿cuáles son los requisitos de grado en ingeniería ambiental?",
            filters=SearchFilters(program="ingenieria ambiental", exclude_document_type="pensum"),
        ))
        assert calls["header"] == [("ingenieria ambiental", "pensum")]

    async def test_not_consulted_without_a_program_filter(self, service, monkeypatch):
        calls = _wire(service, monkeypatch, [make_item("x", score=0.8)], [make_item("header")])
        resp = await service.search(SearchRequest(query="¿cuáles son los requisitos de grado?"))
        assert calls["header"] == []
        assert len(resp.results) == 1

    async def test_header_lookup_failure_never_breaks_search(self, service, monkeypatch):
        _wire(service, monkeypatch, [make_item("x", score=0.8)], [])

        async def boom(program, exclude_document_type=None):
            raise RuntimeError("db down")

        monkeypatch.setattr(service, "_program_header_chunks", boom)
        resp = await service.search(SearchRequest(
            query="¿cuántos créditos tiene ingeniería ambiental?",
            filters=SearchFilters(program="ingenieria ambiental"),
        ))
        assert len(resp.results) == 1
