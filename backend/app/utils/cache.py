"""Cache layer for RAG results, embeddings, and final chat answers.

- AsyncRAGCache: async-compatible.  Uses Redis when REDIS_URL is configured
  (cache survives restarts, shared across workers); falls back to in-memory TTL
  dict otherwise.  Callers must await get() / set() / invalidate_all().

- AsyncAnswerCache: semantic cache for full chat answers, keyed by embedding
  similarity rather than exact text — see class docstring below.

- TTLCache: sync in-memory cache for embedding vectors.  Redis is NOT used here
  because each embedding call is cheap and session-local; making it async would
  require changes to all provider code for minimal benefit.
"""

import hashlib
import json
import logging
import time

logger = logging.getLogger(__name__)

_SENTINEL = object()


# ── Sync in-memory cache (embeddings) ────────────────────────────────────────

class TTLCache:
    """Dict-backed sync cache with per-entry TTL and LRU eviction."""

    def __init__(self, ttl_seconds: int = 1800, max_size: int = 512):
        self._ttl = ttl_seconds
        self._max = max_size
        self._store: dict[str, tuple] = {}

    def make_key(self, **kwargs) -> str:
        raw = json.dumps(kwargs, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, key: str):
        entry = self._store.get(key, _SENTINEL)
        if entry is _SENTINEL:
            return None
        value, ts = entry
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value) -> None:
        if len(self._store) >= self._max:
            self._evict_oldest()
        self._store[key] = (value, time.monotonic())

    def invalidate_all(self) -> None:
        self._store.clear()
        logger.info("Embedding cache invalidated")

    def _evict_oldest(self) -> None:
        if not self._store:
            return
        oldest = min(self._store, key=lambda k: self._store[k][1])
        del self._store[oldest]


# ── Async RAG cache (Redis-backed or in-memory) ───────────────────────────────

class AsyncRAGCache:
    """Async cache for SearchResponse objects.

    Call `await connect_redis(url)` from the app lifespan to enable Redis.
    If Redis is not configured or unreachable, falls back to in-memory TTL dict.
    Callers must await all public methods.
    """

    def __init__(self, ttl_seconds: int = 1800, max_size: int = 512):
        self._ttl = ttl_seconds
        self._max = max_size
        self._store: dict[str, tuple] = {}  # in-memory fallback
        self._redis = None

    # ── Setup ─────────────────────────────────────────────────────────────────

    async def connect_redis(self, url: str) -> bool:
        """Try to connect to Redis. Returns True on success, False on failure."""
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(url, socket_connect_timeout=3, decode_responses=False)
            await client.ping()
            self._redis = client
            logger.info("RAG cache: connected to Redis at %s", url)
            return True
        except Exception as e:
            logger.warning("Redis unavailable — using in-memory RAG cache: %s", e)
            return False

    # ── Key builder (sync helper, no I/O) ────────────────────────────────────

    def make_key(self, **kwargs) -> str:
        raw = json.dumps(kwargs, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    # ── Core operations ───────────────────────────────────────────────────────

    async def get(self, key: str):
        if self._redis is not None:
            try:
                data = await self._redis.get(f"rag:{key}")
                if data:
                    from app.schemas.rag import SearchResponse
                    return SearchResponse.model_validate_json(data)
            except Exception as e:
                logger.debug("Redis get error (falling through): %s", e)
            return None

        # In-memory path
        entry = self._store.get(key, _SENTINEL)
        if entry is _SENTINEL:
            return None
        value, ts = entry
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            return None
        return value

    async def set(self, key: str, value) -> None:
        if self._redis is not None:
            try:
                await self._redis.setex(f"rag:{key}", self._ttl, value.model_dump_json())
            except Exception as e:
                logger.debug("Redis set error: %s", e)
            return

        # In-memory path
        if len(self._store) >= self._max:
            self._evict_oldest()
        self._store[key] = (value, time.monotonic())

    async def invalidate_all(self) -> None:
        if self._redis is not None:
            try:
                async for k in self._redis.scan_iter("rag:*"):
                    await self._redis.delete(k)
            except Exception as e:
                logger.debug("Redis invalidate error: %s", e)
        else:
            self._store.clear()
        logger.info("RAG cache invalidated")

    def size(self) -> int:
        """Entry count. Returns -1 for Redis (unknown without SCAN)."""
        if self._redis is not None:
            return -1
        return len(self._store)

    # ── Internals ─────────────────────────────────────────────────────────────

    def _evict_oldest(self) -> None:
        if not self._store:
            return
        oldest = min(self._store, key=lambda k: self._store[k][1])
        del self._store[oldest]


# ── Async semantic answer cache (Redis-backed or in-memory) ───────────────────

class AsyncAnswerCache:
    """Semantic cache for final chat answers, keyed by embedding similarity.

    Unlike AsyncRAGCache (which caches *retrieved chunks* under an exact-text
    key), this caches the LLM's *final answer* and matches new questions by
    cosine similarity between query embeddings — so paraphrases like "cuáles
    son las materias de administración" and "qué materias tiene admin de
    empresas" hit the same cached answer instead of re-running RAG + LLM.

    This matters specifically on CPU-only Ollama without AVX2/GPU, where
    generation is the bottleneck (a few tokens/sec): a cache hit answers in
    roughly the time of one embedding call (~1-2s) instead of minutes.

    Entries are stored as a bounded, most-recent-first list (Redis LIST, or an
    in-memory list as fallback) — small enough (a few hundred entries) that a
    linear cosine-similarity scan on every lookup is negligible next to LLM
    latency, without needing a vector-search-capable Redis build.
    """

    _REDIS_KEY = "answer_cache:entries"

    def __init__(
        self,
        ttl_seconds: int = 604800,
        max_size: int = 300,
        similarity_threshold: float = 0.93,
    ):
        self._ttl = ttl_seconds
        self._max = max_size
        self._threshold = similarity_threshold
        self._store: list[dict] = []  # in-memory fallback, most-recent-first
        self._redis = None

    # ── Setup ─────────────────────────────────────────────────────────────────

    async def connect_redis(self, url: str) -> bool:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(url, socket_connect_timeout=3, decode_responses=False)
            await client.ping()
            self._redis = client
            logger.info("Answer cache: connected to Redis at %s", url)
            return True
        except Exception as e:
            logger.warning("Redis unavailable — using in-memory answer cache: %s", e)
            return False

    # ── Similarity ────────────────────────────────────────────────────────────

    @staticmethod
    def _cosine(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(y * y for y in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    async def _load_entries(self) -> list[dict]:
        if self._redis is not None:
            try:
                raw = await self._redis.lrange(self._REDIS_KEY, 0, -1)
                return [json.loads(r) for r in raw]
            except Exception as e:
                logger.debug("Answer cache load error (falling through): %s", e)
                return []
        return list(self._store)

    # ── Core operations ───────────────────────────────────────────────────────

    async def find_similar(self, embedding: list[float]) -> dict | None:
        """Return the best-matching cached entry if similarity clears the
        threshold, else None. Entry dict has: question, answer, sources,
        llm_provider, llm_model."""
        entries = await self._load_entries()
        now = time.time()
        best: dict | None = None
        best_score = 0.0
        for entry in entries:
            if now - entry.get("ts", 0) > self._ttl:
                continue
            score = self._cosine(embedding, entry["embedding"])
            if score > best_score:
                best_score = score
                best = entry
        if best is not None and best_score >= self._threshold:
            logger.info(
                "Answer cache HIT (similarity=%.3f): '%.60s…'",
                best_score, best.get("question", ""),
            )
            return best
        return None

    async def store(
        self,
        embedding: list[float],
        question: str,
        answer: str,
        sources: list[dict],
        llm_provider: str,
        llm_model: str,
    ) -> None:
        entry = {
            "embedding": embedding,
            "question": question,
            "answer": answer,
            "sources": sources,
            "llm_provider": llm_provider,
            "llm_model": llm_model,
            "ts": time.time(),
        }
        if self._redis is not None:
            try:
                await self._redis.lpush(self._REDIS_KEY, json.dumps(entry))
                await self._redis.ltrim(self._REDIS_KEY, 0, self._max - 1)
                # Safety-net expiry on the whole list; find_similar() already
                # filters individually-stale entries by `ts` on every read.
                await self._redis.expire(self._REDIS_KEY, self._ttl)
            except Exception as e:
                logger.debug("Answer cache store error: %s", e)
            return

        self._store.insert(0, entry)
        if len(self._store) > self._max:
            self._store.pop()

    async def invalidate_all(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.delete(self._REDIS_KEY)
            except Exception as e:
                logger.debug("Answer cache invalidate error: %s", e)
        else:
            self._store.clear()
        logger.info("Answer cache invalidated")


# ── Module-level singletons ───────────────────────────────────────────────────

# RAG query cache: async, optionally Redis-backed
rag_cache = AsyncRAGCache(ttl_seconds=1800, max_size=512)

# Answer cache: async, optionally Redis-backed — see Settings for tunables
from app.config import settings  # noqa: E402  (after class defs to avoid import cycles)

answer_cache = AsyncAnswerCache(
    ttl_seconds=settings.answer_cache_ttl_seconds,
    max_size=settings.answer_cache_max_entries,
    similarity_threshold=settings.answer_cache_similarity_threshold,
)

# Embedding cache: sync in-memory only (deterministic, no cross-session benefit from Redis)
embedding_cache = TTLCache(ttl_seconds=21600, max_size=2048)
