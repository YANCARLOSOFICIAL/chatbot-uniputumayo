"""Admin-editable LLM model list (OpenAI) + param-family handling + Ollama pull."""
import pytest

from app.providers.openai_provider import _completion_params
from app.services import llm_service as svc
from app.services.llm_service import LLMService, _looks_like_chat_model
from app.runtime_config import _RuntimeConfig


class TestCompletionParams:
    def test_legacy_family_uses_max_tokens_and_temperature(self):
        assert _completion_params("gpt-4.1", 0.05, 100) == {"max_tokens": 100, "temperature": 0.05}

    def test_gpt5_family_uses_max_completion_tokens_and_drops_temperature(self):
        assert _completion_params("gpt-5.4-mini", 0.05, 100) == {"max_completion_tokens": 100}

    def test_gpt5_family_keeps_temperature_only_when_it_is_the_default(self):
        assert _completion_params("gpt-5.5", 1, 100) == {"max_completion_tokens": 100, "temperature": 1}

    def test_o_series_uses_new_shape(self):
        assert _completion_params("o3", 0.3, 50) == {"max_completion_tokens": 50}

    def test_unknown_model_falls_through_to_legacy_shape(self):
        assert _completion_params("some-future-model", 0.2, 10) == {"max_tokens": 10, "temperature": 0.2}

    def test_finetune_of_legacy_model_stays_legacy(self):
        assert _completion_params("ft:gpt-4.1:org::abc", 0.2, 10) == {"max_tokens": 10, "temperature": 0.2}


class TestLooksLikeChatModel:
    @pytest.mark.parametrize("model", ["gpt-5.5", "gpt-4.1-mini", "o3", "chatgpt-4o-latest"])
    def test_chat_models_pass(self, model):
        assert _looks_like_chat_model(model) is True

    @pytest.mark.parametrize("model", [
        "text-embedding-3-large", "gpt-4o-audio-preview", "dall-e-3",
        "whisper-1", "omni-moderation-latest", "gpt-3.5-turbo-instruct",
    ])
    def test_non_chat_models_are_filtered(self, model):
        assert _looks_like_chat_model(model) is False


class FakeOpenAIProvider:
    def __init__(self, *, available=True, generate_error=None, models=None):
        self._available = available
        self._generate_error = generate_error
        self._models = models or []
        self.generate_calls: list[dict] = []

    async def is_available(self):
        return self._available

    async def generate(self, messages, model, temperature, max_tokens):
        self.generate_calls.append({"model": model, "temperature": temperature, "max_tokens": max_tokens})
        if self._generate_error:
            raise self._generate_error
        return {"content": "listo", "tokens_used": None, "finish_reason": "stop"}

    async def list_models(self):
        return self._models


@pytest.fixture
def rc(monkeypatch):
    """Isolated runtime_config so tests don't mutate the process singleton."""
    fresh = _RuntimeConfig()
    fresh.openai_chat_models = ["gpt-4.1", "gpt-4.1-mini"]
    fresh.openai_default_model = "gpt-4.1"
    monkeypatch.setattr(svc, "runtime_config", fresh)
    return fresh


def _patch_provider(monkeypatch, fake):
    monkeypatch.setattr(svc.ProviderFactory, "get_provider", lambda name: fake)


class TestAddOpenAIModel:
    async def test_valid_model_is_validated_then_added(self, rc, monkeypatch):
        fake = FakeOpenAIProvider()
        _patch_provider(monkeypatch, fake)
        res = await LLMService().add_openai_model("gpt-5.5")
        assert res["success"] is True
        assert "gpt-5.5" in rc.openai_chat_models
        assert fake.generate_calls and fake.generate_calls[0]["model"] == "gpt-5.5"

    async def test_duplicate_is_rejected(self, rc, monkeypatch):
        _patch_provider(monkeypatch, FakeOpenAIProvider())
        res = await LLMService().add_openai_model("gpt-4.1")
        assert res["success"] is False

    async def test_bad_id_is_rejected_without_calling_openai(self, rc, monkeypatch):
        fake = FakeOpenAIProvider()
        _patch_provider(monkeypatch, fake)
        res = await LLMService().add_openai_model("no spaces allowed!")
        assert res["success"] is False
        assert fake.generate_calls == []

    async def test_no_api_key_is_rejected(self, rc, monkeypatch):
        _patch_provider(monkeypatch, FakeOpenAIProvider(available=False))
        res = await LLMService().add_openai_model("gpt-5.5")
        assert res["success"] is False
        assert "gpt-5.5" not in rc.openai_chat_models

    async def test_model_that_errors_on_test_call_is_not_added(self, rc, monkeypatch):
        _patch_provider(monkeypatch, FakeOpenAIProvider(generate_error=RuntimeError("404 model not found")))
        res = await LLMService().add_openai_model("gpt-does-not-exist")
        assert res["success"] is False
        assert "no respondió" in res["detail"]
        assert "gpt-does-not-exist" not in rc.openai_chat_models


class TestRemoveOpenAIModel:
    def test_active_model_cannot_be_removed(self, rc):
        res = LLMService().remove_openai_model("gpt-4.1")
        assert res["success"] is False
        assert "gpt-4.1" in rc.openai_chat_models

    def test_unknown_model_is_rejected(self, rc):
        res = LLMService().remove_openai_model("gpt-9")
        assert res["success"] is False

    def test_non_active_model_is_removed(self, rc):
        res = LLMService().remove_openai_model("gpt-4.1-mini")
        assert res["success"] is True
        assert "gpt-4.1-mini" not in rc.openai_chat_models


class TestDiscoverOpenAIModels:
    async def test_returns_chat_like_models_not_already_listed(self, rc, monkeypatch):
        _patch_provider(monkeypatch, FakeOpenAIProvider(models=[
            "gpt-4.1", "gpt-5.5", "text-embedding-3-large", "o3", "whisper-1",
        ]))
        res = await LLMService().discover_openai_models()
        assert res["success"] is True
        assert res["models"] == ["gpt-5.5", "o3"]  # gpt-4.1 already listed, embed/whisper filtered

    async def test_no_api_key(self, rc, monkeypatch):
        _patch_provider(monkeypatch, FakeOpenAIProvider(available=False))
        res = await LLMService().discover_openai_models()
        assert res["success"] is False


class TestRuntimeConfigModelList:
    def test_set_model_appends_active_model_to_the_selectable_list(self):
        c = _RuntimeConfig()
        c.openai_chat_models = ["gpt-4.1"]
        c.set_model("openai", "gpt-5.5")
        assert "gpt-5.5" in c.openai_chat_models

    def test_add_is_deduplicated(self):
        c = _RuntimeConfig()
        c.openai_chat_models = ["gpt-4.1"]
        c.add_openai_model("gpt-4.1")
        assert c.openai_chat_models.count("gpt-4.1") == 1
