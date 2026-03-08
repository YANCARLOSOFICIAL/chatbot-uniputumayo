import json
import logging
from typing import AsyncIterator

import httpx

from app.providers.base import BaseLLMProvider
from app.config import settings

logger = logging.getLogger(__name__)


class OllamaProvider(BaseLLMProvider):
    def __init__(self):
        self.base_url = settings.ollama_base_url

    async def generate(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> dict:
        # 300s: first load of a model on CPU can take 3-5 min
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()

            tokens_used = None
            if "eval_count" in data:
                tokens_used = {
                    "prompt": data.get("prompt_eval_count", 0),
                    "completion": data.get("eval_count", 0),
                    "total": data.get("prompt_eval_count", 0)
                    + data.get("eval_count", 0),
                }

            return {
                "content": data["message"]["content"],
                "tokens_used": tokens_used,
            }

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if not data.get("done") and "message" in data:
                                content = data["message"].get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

    async def embed(self, texts: list[str], model: str) -> dict:
        embeddings = []
        async with httpx.AsyncClient(timeout=120.0) as client:
            for text in texts:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": model, "prompt": text},
                )
                response.raise_for_status()
                data = response.json()
                embeddings.append(data["embedding"])
        return {"embeddings": embeddings}

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False
