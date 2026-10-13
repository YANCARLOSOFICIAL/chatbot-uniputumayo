import uuid

import pytest

from app.config import settings
from app.services.chat_service import ChatService, _RAGContext

# Live 2026-10-12: three questions got "good" retrieval (something cleared
# the threshold) that was the wrong part of the corpus, and the LLM refused.
# _retry_with_multiquery runs a second, forced multi-query pass in that case
# — but only when it surfaces chunks the model has not already seen, and
# only once per message. These tests pin that contract.


def _ctx(quality="good", chunk_ids=(), multiquery_used=False):
    return _RAGContext(
        context_text="", sources_payload=[], source_infos=[], quality=quality,
        embed_ms=0, search_ms=0, multiquery_used=multiquery_used,
        chunk_ids=frozenset(chunk_ids),
    )


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr(settings, "rag_multiquery_enabled", True)
    return ChatService(db=None)


def _wire_run_rag(service, retry_ctx):
    calls = []

    async def fake_run_rag(query, hyde_provider_override=None, force_multiquery=False):
        calls.append({"query": query, "force": force_multiquery, "provider": hyde_provider_override})
        return retry_ctx

    service._run_rag = fake_run_rag
    return calls


class TestRetryWithMultiquery:
    async def test_returns_new_context_when_it_brings_unseen_chunks(self, service):
        a, b = uuid.uuid4(), uuid.uuid4()
        calls = _wire_run_rag(service, _ctx(chunk_ids=[a, b], multiquery_used=True))
        out = await service._retry_with_multiquery("¿pregunta?", _ctx(chunk_ids=[a]), "openai")
        assert out is not None and out.chunk_ids == {a, b}
        assert calls == [{"query": "¿pregunta?", "force": True, "provider": "openai"}]

    async def test_none_when_retry_only_repeats_the_same_chunks(self, service):
        a = uuid.uuid4()
        _wire_run_rag(service, _ctx(chunk_ids=[a], multiquery_used=True))
        assert await service._retry_with_multiquery("¿pregunta?", _ctx(chunk_ids=[a]), "openai") is None

    async def test_none_when_retry_retrieval_is_not_good(self, service):
        _wire_run_rag(service, _ctx(quality="weak", chunk_ids=[uuid.uuid4()], multiquery_used=True))
        assert await service._retry_with_multiquery("¿pregunta?", _ctx(chunk_ids=[]), "openai") is None

    async def test_never_runs_twice_for_one_message(self, service):
        calls = _wire_run_rag(service, _ctx(chunk_ids=[uuid.uuid4()]))
        assert await service._retry_with_multiquery("¿pregunta?", _ctx(multiquery_used=True), "openai") is None
        assert calls == []

    async def test_skipped_for_ollama(self, service):
        calls = _wire_run_rag(service, _ctx(chunk_ids=[uuid.uuid4()]))
        assert await service._retry_with_multiquery("¿pregunta?", _ctx(), "ollama") is None
        assert calls == []

    async def test_skipped_when_disabled(self, service, monkeypatch):
        monkeypatch.setattr(settings, "rag_multiquery_enabled", False)
        calls = _wire_run_rag(service, _ctx(chunk_ids=[uuid.uuid4()]))
        assert await service._retry_with_multiquery("¿pregunta?", _ctx(), "openai") is None
        assert calls == []
