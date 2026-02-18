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


class LLMService:
    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        provider_name = request.provider or runtime_config.default_llm_provider
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

    async def embed(self, request: EmbedRequest) -> EmbedResponse:
        provider_name = request.provider or runtime_config.default_llm_provider
        provider = ProviderFactory.get_provider(provider_name)

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
        for name in ["ollama", "openai"]:
            provider = ProviderFactory.get_provider(name)
            is_available = await provider.is_available()
            models = []
            if name == "ollama":
                models = [runtime_config.ollama_default_model]
            else:
                models = [runtime_config.openai_default_model]

            providers.append(
                ProviderInfo(
                    name=name,
                    models=models,
                    is_available=is_available,
                    is_default=(name == runtime_config.default_llm_provider),
                )
            )
        return ProvidersResponse(providers=providers)

    async def update_config(self, config: LLMConfigUpdate) -> dict:
        old_provider = runtime_config.default_llm_provider

        if config.default_provider is not None:
            runtime_config.default_llm_provider = config.default_provider
        if config.temperature is not None:
            runtime_config.default_temperature = config.temperature
        if config.max_tokens is not None:
            runtime_config.default_max_tokens = config.max_tokens

        # Reset provider if it changed
        if config.default_provider and config.default_provider != old_provider:
            ProviderFactory.reset_provider(old_provider)
            ProviderFactory.reset_provider(config.default_provider)

        return {"success": True, "config": config.model_dump(exclude_none=True)}
