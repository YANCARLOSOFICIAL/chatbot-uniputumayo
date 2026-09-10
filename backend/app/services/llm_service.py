import re
import time

from app.schemas.llm import (
    GenerateRequest,
    GenerateResponse,
    EmbedRequest,
    EmbedResponse,
    ProvidersResponse,
    ProviderInfo,
    LLMConfigUpdate,
)
from app.providers.provider_factory import ProviderFactory
from app.runtime_config import runtime_config
from app.config import settings

# A model id is only ever forwarded to OpenAI and stored in JSONB — keep it to
# what real ids (incl. fine-tunes like "ft:gpt-4.1:org::abc") actually use.
_MODEL_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:\-]{0,99}$")

# Heuristic used by "discover models" to hide the non-chat ids OpenAI's
# /v1/models returns (embeddings, audio, image, moderation, legacy
# completions). It will age as naming schemes change — the manual "add model"
# box is the escape hatch when it does.
_CHAT_MODEL_INCLUDE_RE = re.compile(r"^(gpt-|o1|o3|o4|chatgpt-)", re.IGNORECASE)
_CHAT_MODEL_EXCLUDE_RE = re.compile(
    r"(embed|audio|realtime|transcribe|tts|whisper|dall-e|image|moderation"
    r"|search|-instruct|davinci|babbage|codex)",
    re.IGNORECASE,
)


def _looks_like_chat_model(model_id: str) -> bool:
    return bool(_CHAT_MODEL_INCLUDE_RE.search(model_id)) and not _CHAT_MODEL_EXCLUDE_RE.search(model_id)


class LLMService:
    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        provider_name = request.provider or runtime_config.default_llm_provider
        
        try:
            provider = ProviderFactory.get_provider(provider_name)
            
            model = request.model
            if not model:
                if provider_name == "ollama":
                    model = runtime_config.ollama_default_model
                else:
                    model = runtime_config.openai_default_model

            temperature = request.temperature if request.temperature is not None else runtime_config.default_temperature
            max_tokens = request.max_tokens if request.max_tokens is not None else runtime_config.default_max_tokens

            start_time = time.time()
            result = await provider.generate(
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            response_time = int((time.time() - start_time) * 1000)

            return GenerateResponse(
                content=result["content"],
                provider=provider_name,
                model=model,
                tokens_used=result.get("tokens_used"),
                response_time_ms=response_time,
                finish_reason=result.get("finish_reason"),
            )
        except ValueError as e:
            raise ValueError(f"Cannot use provider '{provider_name}': {str(e)}")
        except Exception as e:
            raise Exception(f"Error generating response with {provider_name}: {str(e)}")

    async def embed(self, request: EmbedRequest) -> EmbedResponse:
        # Use dedicated embedding_provider (separate from chat provider) to avoid
        # pgvector dimension mismatch when the chat provider is changed (e.g. ollama→openai)
        provider_name = request.provider or runtime_config.embedding_provider
        
        try:
            provider = ProviderFactory.get_provider(provider_name)
        except ValueError as e:
            raise ValueError(f"Cannot use embedding provider '{provider_name}': {str(e)}")

        if provider_name == "openai":
            model = runtime_config.openai_embedding_model
        else:
            model = runtime_config.ollama_embedding_model

        start_time = time.time()
        result = await provider.embed(texts=request.texts, model=model)
        response_time = int((time.time() - start_time) * 1000)

        return EmbedResponse(
            embeddings=result["embeddings"],
            model=model,
            dimensions=len(result["embeddings"][0]) if result["embeddings"] else 0,
            response_time_ms=response_time,
        )

    async def get_providers(self) -> ProvidersResponse:
        providers = []

        # --- Ollama: consulta modelos instalados dinámicamente ---
        try:
            ollama = ProviderFactory.get_provider("ollama")
            is_available = await ollama.is_available()
            installed_models = await ollama.get_installed_models() if is_available else []
        except Exception:
            is_available = False
            installed_models = []

        providers.append(ProviderInfo(
            name="ollama",
            models=installed_models,
            is_available=is_available,
            is_default=(runtime_config.default_llm_provider == "ollama"),
            default_model=runtime_config.ollama_default_model,
            protected_models=sorted(self._protected_ollama_models()),
        ))

        # --- OpenAI: lista curada de modelos actuales ---
        try:
            openai_p = ProviderFactory.get_provider("openai")
            openai_available = await openai_p.is_available()
        except ValueError:
            openai_available = False

        providers.append(ProviderInfo(
            name="openai",
            models=list(runtime_config.openai_chat_models),
            is_available=openai_available,
            is_default=(runtime_config.default_llm_provider == "openai"),
            default_model=runtime_config.openai_default_model,
        ))

        return ProvidersResponse(providers=providers)

    # ── OpenAI model list management (admin, no code change needed) ──

    async def add_openai_model(self, model: str) -> dict:
        """Validate a model id with one minimal real call, then add it to the
        selector list. 'Validated' means it answered a basic request — not
        that every code path (long context, streaming) is guaranteed."""
        model = (model or "").strip()
        if not _MODEL_ID_RE.match(model):
            return {"success": False, "detail": "ID de modelo inválido."}
        if model in runtime_config.openai_chat_models:
            return {"success": False, "detail": "Ese modelo ya está en la lista."}

        provider = ProviderFactory.get_provider("openai")
        if not await provider.is_available():
            return {"success": False, "detail": "Configura primero la API key de OpenAI."}
        try:
            await provider.generate(
                messages=[
                    {"role": "system", "content": "Responde con una palabra."},
                    {"role": "user", "content": "Di: listo"},
                ],
                model=model,
                temperature=1,   # familias nuevas rechazan otro valor
                max_tokens=16,
            )
        except Exception as e:
            return {"success": False, "detail": f"El modelo no respondió a una prueba básica: {e}"}

        runtime_config.add_openai_model(model)
        return {"success": True, "models": list(runtime_config.openai_chat_models)}

    def remove_openai_model(self, model: str) -> dict:
        if model == runtime_config.openai_default_model:
            return {
                "success": False,
                "detail": "Es el modelo activo. Cambia el modelo activo antes de quitarlo.",
            }
        if model not in runtime_config.openai_chat_models:
            return {"success": False, "detail": "Ese modelo no está en la lista."}
        runtime_config.remove_openai_model(model)
        return {"success": True, "models": list(runtime_config.openai_chat_models)}

    async def discover_openai_models(self) -> dict:
        """Chat-like model ids the API key can see that aren't already listed."""
        provider = ProviderFactory.get_provider("openai")
        if not await provider.is_available():
            return {"success": False, "detail": "Configura primero la API key de OpenAI.", "models": []}
        try:
            ids = await provider.list_models()
        except Exception as e:
            return {"success": False, "detail": f"No se pudo consultar OpenAI: {e}", "models": []}
        known = set(runtime_config.openai_chat_models)
        found = sorted(m for m in ids if m not in known and _looks_like_chat_model(m))
        return {"success": True, "models": found}

    # ── Ollama model removal (mirror of the × on OpenAI chips) ──

    def _protected_ollama_models(self) -> set[str]:
        """Models the system depends on — refuse to delete these from the UI."""
        return {
            runtime_config.ollama_default_model,
            settings.ollama_vision_model,
            settings.ollama_embedding_model,
            settings.answer_cache_embedding_model,
        }

    async def remove_ollama_model(self, model: str) -> dict:
        model = (model or "").strip()
        if model in self._protected_ollama_models():
            return {
                "success": False,
                "detail": "El sistema usa este modelo (chat activo, visión o embeddings). "
                          "Cámbialo antes de eliminarlo.",
            }
        provider = ProviderFactory.get_provider("ollama")
        try:
            await provider.delete_model(model)
        except Exception as e:
            return {"success": False, "detail": f"No se pudo eliminar: {e}"}
        return {"success": True}

    async def update_config(self, config: LLMConfigUpdate) -> dict:
        old_provider = runtime_config.default_llm_provider

        if config.default_provider is not None:
            runtime_config.default_llm_provider = config.default_provider
        if config.temperature is not None:
            runtime_config.default_temperature = config.temperature
        if config.max_tokens is not None:
            runtime_config.default_max_tokens = config.max_tokens

        # Actualizar el modelo por defecto del proveedor indicado
        if config.default_model is not None:
            target = config.default_provider or runtime_config.default_llm_provider
            runtime_config.set_model(target, config.default_model)

        if config.default_provider and config.default_provider != old_provider:
            ProviderFactory.reset_provider(old_provider)
            ProviderFactory.reset_provider(config.default_provider)

        return {"success": True, "config": config.model_dump(exclude_none=True)}
