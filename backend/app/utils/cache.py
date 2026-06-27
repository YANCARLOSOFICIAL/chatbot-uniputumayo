"""Cache layer for RAG results and embeddings.

- AsyncRAGCache: async-compatible.  Uses Redis when REDIS_URL is configured
  (cache survives restarts, shared across workers); falls back to in-memory TTL
  dict otherwise.  Callers must await get() / set() / invalidate_all().

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


# ── Module-level singletons ───────────────────────────────────────────────────

# RAG query cache: async, optionally Redis-backed
rag_cache = AsyncRAGCache(ttl_seconds=1800, max_size=512)

# Embedding cache: sync in-memory only (deterministic, no cross-session benefit from Redis)
embedding_cache = TTLCache(ttl_seconds=21600, max_size=2048)
