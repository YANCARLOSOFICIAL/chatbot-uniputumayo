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
from app.config import settings


class LLMService:
    def __init__(self):
        self.factory = ProviderFactory()

    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        provider_name = request.provider or settings.default_llm_provider
        provider = self.factory.get_provider(provider_name)

        model = request.model
        if not model:
            if provider_name == "ollama":
                model = settings.ollama_default_model
            else:
                model = settings.openai_default_model

        temperature = request.temperature or settings.default_temperature
        max_tokens = request.max_tokens or settings.default_max_tokens

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
        # Always use OpenAI for embeddings for consistency
        provider_name = request.provider or "openai"
        provider = self.factory.get_provider(provider_name)

        if provider_name == "openai":
            model = settings.openai_embedding_model
        else:
            model = settings.ollama_embedding_model

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
            provider = self.factory.get_provider(name)
            is_available = await provider.is_available()
            models = []
            if name == "ollama":
                models = [settings.ollama_default_model]
            else:
                models = [settings.openai_default_model]

            providers.append(
                ProviderInfo(
                    name=name,
                    models=models,
                    is_available=is_available,
                    is_default=(name == settings.default_llm_provider),
                )
            )
        return ProvidersResponse(providers=providers)

    async def update_config(self, config: LLMConfigUpdate) -> dict:
        return {"success": True, "config": config.model_dump(exclude_none=True)}
