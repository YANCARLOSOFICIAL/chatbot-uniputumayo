import asyncio
import logging
import re
import time
from typing import AsyncIterator

import openai
from openai import AsyncOpenAI

from app.config import settings
from app.providers.base import BaseLLMProvider
from app.runtime_config import runtime_config
from app.utils.cache import embedding_cache

logger = logging.getLogger(__name__)

# Same chars-per-token heuristic already used for context sizing elsewhere
# in this codebase (goldstandard_eval_service.py, verification_graph.py) —
# no tokenizer dependency, good enough for pacing purposes.
_CHARS_PER_TOKEN = 4
_RATE_LIMIT_RETRIES = 3
_RATE_LIMIT_BACKOFF_S = 3.0

# Families that use the newer completion-param shape: `max_completion_tokens`
# instead of `max_tokens`, and no arbitrary `temperature` (only the default 1
# is accepted). Confirmed live 2026-08-31: gpt-5.4-mini returns a 400
# ("Unsupported parameter: 'max_tokens'... Use 'max_completion_tokens'
# instead"). A model this doesn't match falls through to the legacy shape,
# which is also what a freshly-added unrecognized model gets until this
# pattern is updated — the add-model validation call surfaces a hard
# incompatibility immediately if the guess is wrong.
_NEW_PARAM_FAMILY_RE = re.compile(r"^(gpt-5|gpt-6|o1|o3|o4)", re.IGNORECASE)


def _completion_params(model: str, temperature: float, max_tokens: int) -> dict:
    """Model-family-appropriate kwargs for `chat.completions.create`."""
    if _NEW_PARAM_FAMILY_RE.match((model or "").strip()):
        params: dict = {"max_completion_tokens": max_tokens}
        # These families reject any temperature other than the default; pass
        # it only when the caller explicitly wants the default anyway.
        if temperature == 1:
            params["temperature"] = 1
        return params
    return {"max_tokens": max_tokens, "temperature": temperature}


class _TokenRateLimiter:
    """Paces requests against a rolling 60s token budget so this process
    stops short of OpenAI's TPM ceiling instead of firing a burst and
    reacting to 429s afterwards.

    One instance is shared by every call this provider makes — chat
    generation, verification grading, and the GoldStandard eval's
    hallucination judge all resolve to the same `OpenAIProvider` singleton
    (via `ProviderFactory`) and therefore the same budget, which is the
    point: those three call sites used to pace themselves independently (or
    not at all), so their combined traffic could burst well past the
    account's real limit even though any one of them looked fine in
    isolation (confirmed live 2026-08-22: 10 generation failures + several
    "approving by default" verification fallbacks, all 429 rate_limit_exceeded).
    """

    def __init__(self, tokens_per_minute: int):
        self._budget = tokens_per_minute
        self._window: list[tuple[float, int]] = []
        self._lock = asyncio.Lock()

    async def reserve(self, estimated_tokens: int) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                cutoff = now - 60.0
                while self._window and self._window[0][0] < cutoff:
                    self._window.pop(0)
                used = sum(tokens for _, tokens in self._window)
                if used + estimated_tokens <= self._budget or not self._window:
                    # Always let a request through when the window is empty,
                    # even if it alone exceeds the budget (e.g. one very long
                    # context) — pacing prevents pile-ups, it shouldn't wedge
                    # a lone oversized request forever.
                    self._window.append((now, estimated_tokens))
                    return
                oldest_ts = self._window[0][0]
                await asyncio.sleep(max(60.0 - (now - oldest_ts), 0.5))


def _estimate_tokens(messages: list[dict], max_tokens: int) -> int:
    prompt_chars = sum(len(m.get("content") or "") for m in messages)
    return (prompt_chars // _CHARS_PER_TOKEN) + max_tokens


class OpenAIProvider(BaseLLMProvider):
    def __init__(self):
        self.client = None
        self._rate_limiter = _TokenRateLimiter(settings.openai_tpm_limit)

    def _ensure_client(self) -> AsyncOpenAI:
        """Lazily initialize the OpenAI client only when an API key is available."""
        if not runtime_config.openai_api_key:
            raise ValueError(
                "OpenAI is not configured. Please configure your OpenAI API key from the admin panel."
            )

        if self.client is None:
            # max_retries above the SDK default (2) — a batch workload like
            # the GoldStandard eval can still hit a handful of 429s in a row
            # even with proactive pacing (estimation isn't exact, and other
            # traffic against the same org shares the real limit). The SDK
            # already parses OpenAI's "try again in Ns" hint correctly for
            # its own backoff, so raising the ceiling is cheaper and more
            # correct than reimplementing that here.
            self.client = AsyncOpenAI(api_key=runtime_config.openai_api_key, max_retries=6)

        return self.client

    async def _create_completion(self, client: AsyncOpenAI, **kwargs):
        """Safety net on top of the SDK's own retries and this provider's
        proactive pacing — a burst that outlasts both still shouldn't take
        down the caller outright for a recoverable, known-transient error.
        """
        for attempt in range(_RATE_LIMIT_RETRIES + 1):
            try:
                return await client.chat.completions.create(**kwargs)
            except openai.RateLimitError:
                if attempt == _RATE_LIMIT_RETRIES:
                    raise
                await asyncio.sleep(_RATE_LIMIT_BACKOFF_S * (attempt + 1))

    async def generate(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> dict:
        client = self._ensure_client()
        await self._rate_limiter.reserve(_estimate_tokens(messages, max_tokens))
        response = await self._create_completion(
            client,
            model=model,
            messages=messages,
            **_completion_params(model, temperature, max_tokens),
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
            "finish_reason": choice.finish_reason,
        }

    async def generate_stream(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
        meta: dict | None = None,
    ) -> AsyncIterator[str]:
        client = self._ensure_client()
        await self._rate_limiter.reserve(_estimate_tokens(messages, max_tokens))
        # Safe to retry-on-429 here too: the error happens on the initial
        # request that opens the stream, before any chunk is yielded.
        stream = await self._create_completion(
            client,
            model=model,
            messages=messages,
            stream=True,
            **_completion_params(model, temperature, max_tokens),
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            if chunk.choices[0].finish_reason and meta is not None:
                meta["finish_reason"] = chunk.choices[0].finish_reason
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def embed(self, texts: list[str], model: str) -> dict:
        client = self._ensure_client()

        # Check cache for each text; only call API for uncached ones
        results: list[list[float] | None] = [None] * len(texts)
        uncached_indices: list[int] = []
        uncached_texts: list[str] = []

        for i, text in enumerate(texts):
            cache_key = embedding_cache.make_key(text=text, model=model)
            cached = embedding_cache.get(cache_key)
            if cached is not None:
                results[i] = cached
            else:
                uncached_indices.append(i)
                uncached_texts.append(text)

        if uncached_texts:
            response = await client.embeddings.create(model=model, input=uncached_texts)
            for idx, item in zip(uncached_indices, response.data):
                vector = item.embedding
                results[idx] = vector
                cache_key = embedding_cache.make_key(text=texts[idx], model=model)
                embedding_cache.set(cache_key, vector)

        return {"embeddings": results}

    async def is_available(self) -> bool:
        key = runtime_config.openai_api_key
        return bool(key and key != "sk-your-key-here")

    async def list_models(self) -> list[str]:
        """Every model id the configured API key can see (chat, embedding,
        audio, … — the caller filters). Used by the admin 'discover models'
        action so new OpenAI releases can be added without a code change."""
        client = self._ensure_client()
        resp = await client.models.list()
        return [m.id for m in resp.data]
