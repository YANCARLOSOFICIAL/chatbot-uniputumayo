"""Mutable runtime configuration singleton.

Copies initial values from settings on import, and allows in-memory updates
(e.g. switching LLM provider, setting API key) without restarting the server.
"""

from app.config import settings


class _RuntimeConfig:
    def __init__(self):
        self.default_llm_provider: str = settings.default_llm_provider
        self.default_temperature: float = settings.default_temperature
        self.default_max_tokens: int = settings.default_max_tokens
        self.openai_api_key: str | None = settings.openai_api_key
        self.ollama_default_model: str = settings.ollama_default_model
        self.openai_default_model: str = settings.openai_default_model
        self.ollama_embedding_model: str = settings.ollama_embedding_model
        self.openai_embedding_model: str = settings.openai_embedding_model


runtime_config = _RuntimeConfig()
