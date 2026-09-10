"""Mutable runtime configuration singleton.

Copies initial values from settings on import, and allows in-memory updates
(e.g. switching LLM provider, API key, default model) without restarting the server.
"""

from app.config import settings, OPENAI_CHAT_MODELS


class _RuntimeConfig:
    def __init__(self):
        self.default_llm_provider: str = settings.default_llm_provider
        self.default_temperature: float = settings.default_temperature
        self.default_max_tokens: int = settings.default_max_tokens
        self.openai_api_key: str | None = settings.openai_api_key
        self.ollama_default_model: str = settings.ollama_default_model
        self.openai_default_model: str = settings.openai_default_model
        # Modelos OpenAI ofrecidos en el selector del panel. Se siembra desde
        # OPENAI_CHAT_MODELS (config.py) y luego el admin lo edita en vivo
        # (agregar/quitar) sin tocar código — persistido en
        # llm_configurations.config['chat_models'] (llm_config_store.py).
        self.openai_chat_models: list[str] = list(OPENAI_CHAT_MODELS)
        self.ollama_embedding_model: str = settings.ollama_embedding_model
        self.openai_embedding_model: str = settings.openai_embedding_model
        # Proveedor de embeddings fijo — independiente del chat para evitar mismatch de dims
        self.embedding_provider: str = settings.embedding_provider
        # Resend (recuperación de contraseña) — configurable desde /admin/config,
        # ver app/services/email_config_store.py
        self.resend_api_key: str | None = settings.resend_api_key
        self.resend_from_email: str = settings.resend_from_email

    def resolve_model(self, provider_name: str) -> str:
        """Devuelve el modelo activo para el proveedor indicado."""
        if provider_name == "ollama":
            return self.ollama_default_model
        return self.openai_default_model

    def set_model(self, provider_name: str, model: str) -> None:
        """Actualiza el modelo por defecto de un proveedor en runtime."""
        if provider_name == "ollama":
            self.ollama_default_model = model
        elif provider_name == "openai":
            self.openai_default_model = model
            # El modelo activo siempre debe poder seleccionarse en el panel.
            self.add_openai_model(model)

    def add_openai_model(self, model: str) -> None:
        model = (model or "").strip()
        if model and model not in self.openai_chat_models:
            self.openai_chat_models.append(model)

    def remove_openai_model(self, model: str) -> None:
        self.openai_chat_models = [m for m in self.openai_chat_models if m != model]


runtime_config = _RuntimeConfig()
