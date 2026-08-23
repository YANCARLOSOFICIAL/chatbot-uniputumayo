import pytest

from app.schemas.rag import SearchResponse
from app.services import chat_service as chat_service_module
from app.services.chat_service import ChatService

# Real incident (GoldStandard eval, run c02ae759-*, 2026-08-23): _run_rag()
# called RAGService.search() without a hyde_provider_override, so HyDE's
# on/off decision read the live runtime_config.default_llm_provider instead
# of the provider that would actually generate the answer. The eval's
# generation leg passes an explicit MessageCreate(llm_provider=...) per case
# (to compare Ollama vs OpenAI), but with the live admin default set to
# "ollama" (HyDE disabled for ollama by design), the OpenAI-generation leg
# was silently retrieved with HyDE off too — collapsing recall for queries
# HyDE would otherwise have rescued, and producing "quality=none" instant
# refusals (no LLM call, no verification) on questions the eval's own
# HyDE-pinned retrieval-metrics pass could find. Confirmed live: 16/20 of
# OpenAI's self-refused-before-the-grader cases had recall_at_k=1 in that
# same run. Fix: resolve `provider_name` before calling _run_rag() and pass
# it through as hyde_provider_override, so retrieval always uses HyDE for
# whichever provider is about to generate — matching real single-provider
# chat traffic exactly (provider_name there already equals the live global)
# while fixing the eval's per-case provider override.


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


class TestRunRagHydeProviderOverride:
    async def test_passes_hyde_provider_override_through_to_search(self):
        svc = ChatService(db=None)
        await svc._run_rag("¿algo?", hyde_provider_override="openai")
        assert _FakeRAGService.last_request.hyde_provider_override == "openai"

    async def test_defaults_to_none_when_no_override_given(self):
        svc = ChatService(db=None)
        await svc._run_rag("¿algo?")
        assert _FakeRAGService.last_request.hyde_provider_override is None
