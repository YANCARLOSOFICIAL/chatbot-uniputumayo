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


class TokenBudgetExhausted(Exception):
    """Raised when pacing for the shared OpenAI token budget would wait
    longer than `openai_budget_wait_timeout_seconds`.

    Mapped to HTTP 429 (see main.py) so concurrent users get a fast
    "sistema ocupado, reintenta" instead of hanging minutes on a spinner.
    """


class _TokenRateLimiter:
    """Paces requests against a rolling 60s token budget so this process
    stops short of OpenAI's TPM ceiling instead of firing a burst and
    reacting to 429s afterwards.

    One instance is shared by every call paced through it — it used to be a
    single process-wide budget (chat generation + verification grading +
    the GoldStandard eval's hallucination judge), which collapsed under 5+
    simultaneous users (~9k tokens per chat message vs a 27k budget ≈ 3
    mensajes/minuto). Since OpenAI enforces TPM per model, budgets are now
    split per model (see `OpenAIProvider._limiter_for`) and the background
    eval judge paces on its own instance (see goldstandard_eval_service) so
    bulk evals can't starve interactive chat. What remains shared still
    waits — but bounded (see `wait_timeout_s`), never minutes.
    """

    def __init__(self, tokens_per_minute: int, wait_timeout_s: float | None = None):
        self._budget = tokens_per_minute
        # Entries are mutable [timestamp, tokens] so `settle` can true-up an
        # over-reserved estimate with the real usage once the response lands.
        self._window: list[list] = []
        self._lock = asyncio.Lock()
        self._wait_timeout_s = wait_timeout_s

    async def reserve(self, estimated_tokens: int) -> list:
        """Reserve budget, returning a lease for `settle`/`release`.

        Never sleeps while holding the lock (previous versions did, serializing
        every waiter behind the longest sleeper). Raises TokenBudgetExhausted
        instead of waiting past `wait_timeout_s`.
        """
        waited = 0.0
        while True:
            async with self._lock:
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
                    lease = [now, estimated_tokens]
                    self._window.append(lease)
                    if waited >= 1.0:
                        logger.warning(
                            "OpenAI token budget wait | waited=%.1fs | used=%d | estimate=%d | budget=%d",
                            waited, used, estimated_tokens, self._budget,
                        )
                    return lease
                delay = max(60.0 - (now - self._window[0][0]), 0.5)
            if self._wait_timeout_s is not None and waited + delay > self._wait_timeout_s:
                raise TokenBudgetExhausted(
                    f"Sistema ocupado (presupuesto OpenAI agotado tras {waited:.0f}s de espera). "
                    "Intenta de nuevo en un minuto."
                )
            await asyncio.sleep(delay)
            waited += delay

    async def settle(self, lease: list | None, actual_tokens: int) -> None:
        """True-up an over-reserved estimate with the real token usage.

        `reserve` books prompt estimate + FULL max_tokens, but answers are
        usually much shorter — without this correction every message holds
        ~1k phantom tokens for a full minute, needlessly throttling the next
        users. No-op for unknown/expired leases (e.g. streams, which settle
        nothing, or fakes in tests).
        """
        if lease is None:
            return
        async with self._lock:
            if any(entry is lease for entry in self._window):
                lease[1] = actual_tokens

    async def release(self, lease: list | None) -> None:
        """Drop a lease without consuming budget (failed calls)."""
        if lease is None:
            return
        async with self._lock:
            self._window[:] = [entry for entry in self._window if entry is not lease]


def _estimate_tokens(messages: list[dict], max_tokens: int) -> int:
    prompt_chars = sum(len(m.get("content") or "") for m in messages)
    return (prompt_chars // _CHARS_PER_TOKEN) + max_tokens


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, wait_timeout_s: float | None = None):
        self.client = None
        # One pacing budget per model: OpenAI enforces TPM per model, so the
        # cheap condensation/summary model (gpt-4.1-mini) must not eat the
        # main chat model's budget and vice versa. Each pool keeps the same
        # conservative cap (`openai_tpm_limit`, ~10% under the observed org
        # ceiling). The background eval judge gets its OWN provider instance
        # (see goldstandard_eval_service) so bulk evals don't queue behind
        # interactive chat on the same lock.
        self._limiters: dict[str, _TokenRateLimiter] = {}
        self._wait_timeout_s = (
            settings.openai_budget_wait_timeout_seconds
            if wait_timeout_s is None else wait_timeout_s
        )

    def _limiter_for(self, model: str) -> _TokenRateLimiter:
        key = (model or "").strip() or "default"
        limiter = self._limiters.get(key)
        if limiter is None:
            limiter = _TokenRateLimiter(
                settings.openai_tpm_limit, wait_timeout_s=self._wait_timeout_s,
            )
            self._limiters[key] = limiter
        return limiter

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
        limiter = self._limiter_for(model)
        lease = await limiter.reserve(_estimate_tokens(messages, max_tokens))
        try:
            response = await self._create_completion(
                client,
                model=model,
                messages=messages,
                **_completion_params(model, temperature, max_tokens),
            )
        except Exception:
            await limiter.release(lease)
            raise

        choice = response.choices[0]
        tokens_used = None
        if response.usage:
            tokens_used = {
                "prompt": response.usage.prompt_tokens,
                "completion": response.usage.completion_tokens,
                "total": response.usage.total_tokens,
            }
            # Free the over-reserved (max_tokens - actual) headroom so the
            # next concurrent users don't wait on phantom tokens.
            await limiter.settle(lease, response.usage.total_tokens)

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
        limiter = self._limiter_for(model)
        # Streams can't true-up (usage, if any, only arrives in a trailing
        # chunk this code doesn't parse) — the full estimate is held for
        # 60s. Non-stream calls settle the difference once the response
        # lands (see generate above).
        lease = await limiter.reserve(_estimate_tokens(messages, max_tokens))
        try:
            # Safe to retry-on-429 here too: the error happens on the initial
            # request that opens the stream, before any chunk is yielded.
            stream = await self._create_completion(
                client,
                model=model,
                messages=messages,
                stream=True,
                **_completion_params(model, temperature, max_tokens),
            )
        except Exception:
            await limiter.release(lease)
            raise
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
