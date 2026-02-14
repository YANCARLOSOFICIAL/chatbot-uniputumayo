import logging

from openai import AsyncOpenAI

from app.providers.base import BaseLLMProvider
from app.config import settings

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> dict:
        response = await self.client.chat.completions.create(
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

    async def embed(self, texts: list[str], model: str) -> dict:
        response = await self.client.embeddings.create(
            model=model,
            input=texts,
        )
        embeddings = [item.embedding for item in response.data]
        return {"embeddings": embeddings}

    async def is_available(self) -> bool:
        return bool(settings.openai_api_key and settings.openai_api_key != "sk-your-key-here")
