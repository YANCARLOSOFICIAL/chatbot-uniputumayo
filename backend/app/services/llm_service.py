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
from app.config import OPENAI_CHAT_MODELS


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

            temperature = request.temperature or runtime_config.default_temperature
            max_tokens = request.max_tokens or runtime_config.default_max_tokens

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
        ))

        # --- OpenAI: lista curada de modelos actuales ---
        try:
            openai_p = ProviderFactory.get_provider("openai")
            openai_available = await openai_p.is_available()
        except ValueError:
            openai_available = False

        providers.append(ProviderInfo(
            name="openai",
            models=OPENAI_CHAT_MODELS,
            is_available=openai_available,
            is_default=(runtime_config.default_llm_provider == "openai"),
            default_model=runtime_config.openai_default_model,
        ))

        return ProvidersResponse(providers=providers)

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
