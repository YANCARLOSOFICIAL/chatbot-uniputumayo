from app.providers.base import BaseLLMProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.openai_provider import OpenAIProvider


class ProviderFactory:
    _providers: dict[str, BaseLLMProvider] = {}

    @classmethod
    def get_provider(cls, name: str) -> BaseLLMProvider:
        if name not in cls._providers:
            if name == "ollama":
                cls._providers[name] = OllamaProvider()
            elif name == "openai":
                cls._providers[name] = OpenAIProvider()
            else:
                raise ValueError(f"Unknown LLM provider: {name}")
        return cls._providers[name]

    @classmethod
    def reset_provider(cls, name: str) -> None:
        """Remove a cached provider so it gets re-created with fresh config."""
        cls._providers.pop(name, None)
