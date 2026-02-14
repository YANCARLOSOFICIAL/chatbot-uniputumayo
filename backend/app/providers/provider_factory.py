from app.providers.base import BaseLLMProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.openai_provider import OpenAIProvider


class ProviderFactory:
    _providers: dict[str, BaseLLMProvider] = {}

    def get_provider(self, name: str) -> BaseLLMProvider:
        if name not in self._providers:
            if name == "ollama":
                self._providers[name] = OllamaProvider()
            elif name == "openai":
                self._providers[name] = OpenAIProvider()
            else:
                raise ValueError(f"Unknown LLM provider: {name}")
        return self._providers[name]
