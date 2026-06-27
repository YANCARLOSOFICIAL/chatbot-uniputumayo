"""Tests for app.utils.cache (TTLCache sync + AsyncRAGCache in-memory)."""
import asyncio
import time
from unittest.mock import patch

import pytest

from app.utils.cache import TTLCache, AsyncRAGCache


class TestTTLCache:
    def test_set_and_get(self):
        cache = TTLCache(ttl_seconds=60, max_size=10)
        cache.set("k1", "value1")
        assert cache.get("k1") == "value1"

    def test_get_missing_returns_none(self):
        cache = TTLCache(ttl_seconds=60, max_size=10)
        assert cache.get("nonexistent") is None

    def test_expiration(self):
        cache = TTLCache(ttl_seconds=1, max_size=10)
        cache.set("k1", "value1")
        assert cache.get("k1") == "value1"
        time.sleep(1.1)
        assert cache.get("k1") is None

    def test_eviction_on_max_size(self):
        cache = TTLCache(ttl_seconds=60, max_size=3)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        # All three fit
        assert cache.get("a") == 1
        # Adding fourth should evict the oldest
        cache.set("d", 4)
        assert cache.get("d") == 4
        # One of a, b, c should be evicted (oldest = a)
        assert cache.get("a") is None

    def test_make_key_deterministic(self):
        cache = TTLCache()
        k1 = cache.make_key(text="hello", model="m1")
        k2 = cache.make_key(text="hello", model="m1")
        assert k1 == k2

    def test_make_key_differs_for_different_inputs(self):
        cache = TTLCache()
        k1 = cache.make_key(text="hello", model="m1")
        k2 = cache.make_key(text="world", model="m1")
        assert k1 != k2

    def test_invalidate_all(self):
        cache = TTLCache(ttl_seconds=60, max_size=10)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.invalidate_all()
        assert cache.get("a") is None
        assert cache.get("b") is None

    def test_overwrite_existing_key(self):
        cache = TTLCache(ttl_seconds=60, max_size=10)
        cache.set("k", "old")
        cache.set("k", "new")
        assert cache.get("k") == "new"


class TestAsyncRAGCache:
    @pytest.mark.asyncio
    async def test_set_and_get_in_memory(self):
        cache = AsyncRAGCache(ttl_seconds=60, max_size=10)
        await cache.set("k1", "value1")
        assert await cache.get("k1") == "value1"

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self):
        cache = AsyncRAGCache(ttl_seconds=60, max_size=10)
        assert await cache.get("nonexistent") is None

    @pytest.mark.asyncio
    async def test_expiration(self):
        cache = AsyncRAGCache(ttl_seconds=1, max_size=10)
        await cache.set("k1", "value1")
        assert await cache.get("k1") == "value1"
        await asyncio.sleep(1.1)
        assert await cache.get("k1") is None

    @pytest.mark.asyncio
    async def test_eviction_on_max_size(self):
        cache = AsyncRAGCache(ttl_seconds=60, max_size=3)
        await cache.set("a", 1)
        await cache.set("b", 2)
        await cache.set("c", 3)
        await cache.set("d", 4)
        assert await cache.get("d") == 4
        assert await cache.get("a") is None

    @pytest.mark.asyncio
    async def test_invalidate_all(self):
        cache = AsyncRAGCache(ttl_seconds=60, max_size=10)
        await cache.set("a", 1)
        await cache.set("b", 2)
        await cache.invalidate_all()
        assert await cache.get("a") is None
        assert await cache.get("b") is None

    @pytest.mark.asyncio
    async def test_size_in_memory(self):
        cache = AsyncRAGCache(ttl_seconds=60, max_size=10)
        assert cache.size() == 0
        await cache.set("k1", "v1")
        assert cache.size() == 1
        await cache.set("k2", "v2")
        assert cache.size() == 2

    def test_make_key_deterministic(self):
        cache = AsyncRAGCache()
        k1 = cache.make_key(query="hello", top_k=5)
        k2 = cache.make_key(query="hello", top_k=5)
        assert k1 == k2

    def test_make_key_differs_for_different_inputs(self):
        cache = AsyncRAGCache()
        k1 = cache.make_key(query="hello", top_k=5)
        k2 = cache.make_key(query="world", top_k=5)
        assert k1 != k2

    @pytest.mark.asyncio
    async def test_size_returns_negative_one_for_redis(self):
        cache = AsyncRAGCache()
        cache._redis = object()  # simulate Redis being set
        assert cache.size() == -1
        cache._redis = None  # reset
