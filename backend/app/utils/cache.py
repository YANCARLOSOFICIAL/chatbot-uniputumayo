"""Simple in-memory TTL cache for RAG query results.

Avoids re-embedding and re-searching identical (or near-identical) queries
within the TTL window.  Thread-safe for a single asyncio event loop.
"""
import hashlib
import json
import time
import logging

logger = logging.getLogger(__name__)

_SENTINEL = object()


class TTLCache:
    """Dict-backed cache with per-entry TTL and a max-size LRU eviction."""

    def __init__(self, ttl_seconds: int = 1800, max_size: int = 512):
        self._ttl = ttl_seconds
        self._max = max_size
        # {key: (value, inserted_at)}
        self._store: dict[str, tuple] = {}

    # ── Public API ────────────────────────────────────────────────────────────

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
        logger.info("RAG cache invalidated")

    # ── Internals ─────────────────────────────────────────────────────────────

    def _evict_oldest(self) -> None:
        if not self._store:
            return
        oldest_key = min(self._store, key=lambda k: self._store[k][1])
        del self._store[oldest_key]


# Module-level singletons — shared across requests in the same process
rag_cache = TTLCache(ttl_seconds=1800, max_size=512)

# Embedding cache: stores individual text → vector mappings.
# TTL is longer (6h) because embedding models are deterministic — same text = same vector.
embedding_cache = TTLCache(ttl_seconds=21600, max_size=2048)
