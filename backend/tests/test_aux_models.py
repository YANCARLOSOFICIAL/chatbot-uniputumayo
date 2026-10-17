from app.config import settings
from app.runtime_config import runtime_config
from app.services import rag_service as rag_service_module
from app.services.rag_service import RAGService
from app.services.verification_graph import resolve_grader

# Measured 2026-10-17: with gpt-5.6-luna (a reasoning model) as the chat
# model, HyDE and the verification grader ran on it too — three slow calls
# per question, and HyDE alone went from 3 s to 14-18 s under 8 concurrent
# users. These pin that the auxiliary stages use the cheap model.


class _CapturingProvider:
    def __init__(self):
        self.models = []

    async def generate(self, messages, model, temperature, max_tokens):
        self.models.append(model)
        return {"content": "documento hipotético", "finish_reason": "stop", "tokens_used": None}


async def test_hyde_uses_the_condensation_model_on_openai(monkeypatch):
    fake = _CapturingProvider()
    monkeypatch.setattr(rag_service_module.ProviderFactory, "get_provider", staticmethod(lambda name: fake))
    monkeypatch.setattr(settings, "openai_condensation_model", "gpt-4.1-mini")
    monkeypatch.setattr(runtime_config, "resolve_model", lambda name: "gpt-5.6-luna")
    doc = await RAGService(db=None)._generate_hyde_doc("¿cuánto cuesta la inscripción?", provider_name="openai")
    assert doc == "documento hipotético"
    assert fake.models == ["gpt-4.1-mini"]


async def test_hyde_keeps_the_active_model_on_ollama(monkeypatch):
    fake = _CapturingProvider()
    monkeypatch.setattr(rag_service_module.ProviderFactory, "get_provider", staticmethod(lambda name: fake))
    monkeypatch.setattr(runtime_config, "resolve_model", lambda name: "qwen3:8b")
    await RAGService(db=None)._generate_hyde_doc("¿pregunta?", provider_name="ollama")
    assert fake.models == ["qwen3:8b"]


def test_grader_model_override(monkeypatch):
    monkeypatch.setattr(runtime_config, "openai_api_key", "sk-real")
    monkeypatch.setattr(runtime_config, "resolve_model", lambda name: "gpt-5.6-luna")
    monkeypatch.setattr(settings, "openai_grader_model", None)
    assert resolve_grader("openai", "gpt-5.6-luna") == ("openai", "gpt-5.6-luna")
    monkeypatch.setattr(settings, "openai_grader_model", "gpt-4.1-mini")
    assert resolve_grader("openai", "gpt-5.6-luna") == ("openai", "gpt-4.1-mini")
    assert resolve_grader("ollama", "qwen3:8b") == ("openai", "gpt-4.1-mini")
