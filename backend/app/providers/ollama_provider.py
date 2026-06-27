import asyncio
import json
import logging
import re
from typing import AsyncIterator

import httpx

from app.providers.base import BaseLLMProvider
from app.config import settings, OLLAMA_EMBEDDING_KEYWORDS
from app.utils.cache import embedding_cache

logger = logging.getLogger(__name__)

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


class OllamaProvider(BaseLLMProvider):
    def __init__(self):
        self.base_url = settings.ollama_base_url

    # ── Think-tag helpers ────────────────────────────────────────────────────

    @staticmethod
    def _strip_think(content: str) -> str:
        """Remove <think>…</think> blocks (qwen3, deepseek-r1, etc.) from completed text."""
        return _THINK_RE.sub("", content).strip()

    # ── Generation ───────────────────────────────────────────────────────────

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
                    "total": data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
                }

            content = self._strip_think(data["message"]["content"])
            return {"content": content, "tokens_used": tokens_used}

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> AsyncIterator[str]:
        """Stream tokens, filtering out <think>…</think> reasoning blocks."""
        inside_think = False

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
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if data.get("done") or "message" not in data:
                            continue
                        token = data["message"].get("content", "")
                        if not token:
                            continue

                        if inside_think:
                            if "</think>" in token.lower():
                                close_idx = token.lower().find("</think>")
                                remainder = token[close_idx + len("</think>"):]
                                inside_think = False
                                if remainder:
                                    yield remainder
                            # else: still inside <think>, discard
                        else:
                            if "<think>" in token.lower():
                                open_idx = token.lower().find("<think>")
                                before = token[:open_idx]
                                if before:
                                    yield before
                                rest = token[open_idx + len("<think>"):]
                                if "</think>" in rest.lower():
                                    # Entire think block in one token
                                    close_idx = rest.lower().find("</think>")
                                    remainder = rest[close_idx + len("</think>"):]
                                    if remainder:
                                        yield remainder
                                else:
                                    inside_think = True
                            else:
                                yield token
                    except json.JSONDecodeError:
                        continue

    # ── Embeddings ───────────────────────────────────────────────────────────

    async def _embed_one(
        self, client: httpx.AsyncClient, text: str, model: str
    ) -> list[float]:
        """Embed a single text, using the in-memory cache to avoid redundant API calls."""
        cache_key = embedding_cache.make_key(text=text, model=model)
        cached = embedding_cache.get(cache_key)
        if cached is not None:
            return cached

        response = await client.post(
            f"{self.base_url}/api/embeddings",
            json={"model": model, "prompt": text},
        )
        response.raise_for_status()
        vector = response.json()["embedding"]
        embedding_cache.set(cache_key, vector)
        return vector

    async def embed(self, texts: list[str], model: str) -> dict:
        """Embed all texts in parallel with a shared HTTP client and embedding cache."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            embeddings = await asyncio.gather(
                *[self._embed_one(client, t, model) for t in texts]
            )
        return {"embeddings": list(embeddings)}

    # ── Utilities ────────────────────────────────────────────────────────────

    async def get_installed_models(self) -> list[str]:
        """Return chat models installed in Ollama (excludes embedding models)."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code != 200:
                    return []
                data = response.json()
                all_names = [m["name"] for m in data.get("models", [])]
                return [
                    name for name in all_names
                    if not any(kw in name.lower() for kw in OLLAMA_EMBEDDING_KEYWORDS)
                ]
        except Exception:
            return []

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False
