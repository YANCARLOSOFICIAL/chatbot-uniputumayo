import logging
from typing import AsyncIterator

from openai import AsyncOpenAI

from app.providers.base import BaseLLMProvider
from app.runtime_config import runtime_config

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    def __init__(self):
        self.client = None

    def _ensure_client(self) -> AsyncOpenAI:
        """Lazily initialize the OpenAI client only when an API key is available."""
        if not runtime_config.openai_api_key:
            raise ValueError(
                "OpenAI is not configured. Please configure your OpenAI API key from the admin panel."
            )
        
        if self.client is None:
            self.client = AsyncOpenAI(api_key=runtime_config.openai_api_key)
        
        return self.client

    async def generate(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> dict:
        client = self._ensure_client()
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        choice = response.choices[0]
        tokens_used = None
        if response.usage:
            tokens_used = {
                "prompt": response.usage.prompt_tokens,
                "completion": response.usage.completion_tokens,
                "total": response.usage.total_tokens,
            }

        return {
            "content": choice.message.content or "",
            "tokens_used": tokens_used,
        }

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        client = self._ensure_client()
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def embed(self, texts: list[str], model: str) -> dict:
        client = self._ensure_client()
        response = await client.embeddings.create(
            model=model,
            input=texts,
        )
        embeddings = [item.embedding for item in response.data]
        return {"embeddings": embeddings}

    async def is_available(self) -> bool:
        key = runtime_config.openai_api_key
        return bool(key and key != "sk-your-key-here")
