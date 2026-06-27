"""Tests for app.runtime_config and RAGService pure methods."""
from app.runtime_config import _RuntimeConfig


class TestRuntimeConfig:
    def _make_config(self) -> _RuntimeConfig:
        return _RuntimeConfig()

    def test_resolve_model_ollama(self):
        cfg = self._make_config()
        cfg.ollama_default_model = "qwen3:8b"
        assert cfg.resolve_model("ollama") == "qwen3:8b"

    def test_resolve_model_openai(self):
        cfg = self._make_config()
        cfg.openai_default_model = "gpt-4o-mini"
        assert cfg.resolve_model("openai") == "gpt-4o-mini"

    def test_resolve_model_unknown_returns_openai(self):
        cfg = self._make_config()
        cfg.openai_default_model = "gpt-4o-mini"
        assert cfg.resolve_model("unknown") == "gpt-4o-mini"

    def test_set_model_ollama(self):
        cfg = self._make_config()
        cfg.set_model("ollama", "llama3:latest")
        assert cfg.ollama_default_model == "llama3:latest"

    def test_set_model_openai(self):
        cfg = self._make_config()
        cfg.set_model("openai", "gpt-5")
        assert cfg.openai_default_model == "gpt-5"

    def test_set_model_unknown_is_noop(self):
        cfg = self._make_config()
        old_ollama = cfg.ollama_default_model
        old_openai = cfg.openai_default_model
        cfg.set_model("unknown", "model")
        assert cfg.ollama_default_model == old_ollama
        assert cfg.openai_default_model == old_openai

    def test_defaults_from_settings(self):
        cfg = self._make_config()
        assert cfg.default_llm_provider == "ollama"
        assert isinstance(cfg.default_temperature, float)
        assert isinstance(cfg.default_max_tokens, int)
