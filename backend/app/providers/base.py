from abc import ABC, abstractmethod


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> dict:
        """Generate a text response.

        Returns:
            dict with keys: content (str), tokens_used (dict|None)
        """
        pass

    @abstractmethod
    async def embed(self, texts: list[str], model: str) -> dict:
        """Generate embeddings for a list of texts.

        Returns:
            dict with key: embeddings (list[list[float]])
        """
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is available and configured."""
        pass
