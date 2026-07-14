import time

import pytest

from app.utils.cache import AsyncAnswerCache, AsyncRAGCache, TTLCache


class TestTTLCache:
    def test_set_and_get_roundtrip(self):
        cache = TTLCache(ttl_seconds=10, max_size=10)
        key = cache.make_key(query="hola")
        cache.set(key, {"answer": "mundo"})
        assert cache.get(key) == {"answer": "mundo"}

    def test_missing_key_returns_none(self):
        cache = TTLCache(ttl_seconds=10, max_size=10)
        assert cache.get("nope") is None

    def test_expired_entry_returns_none(self):
        cache = TTLCache(ttl_seconds=0, max_size=10)
        key = cache.make_key(q="x")
        cache.set(key, "value")
        time.sleep(0.01)
        assert cache.get(key) is None

    def test_lru_eviction_when_max_size_exceeded(self):
        cache = TTLCache(ttl_seconds=100, max_size=2)
        cache.set("a", 1)
        time.sleep(0.01)
        cache.set("b", 2)
        time.sleep(0.01)
        cache.set("c", 3)  # should evict "a" (oldest)
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_invalidate_all_clears_store(self):
        cache = TTLCache()
        cache.set("a", 1)
        cache.invalidate_all()
        assert cache.get("a") is None

    def test_same_kwargs_produce_same_key(self):
        cache = TTLCache()
        assert cache.make_key(a=1, b=2) == cache.make_key(b=2, a=1)


class TestAsyncRAGCache:
    @pytest.mark.asyncio
    async def test_set_and_get_in_memory(self):
        cache = AsyncRAGCache(ttl_seconds=10, max_size=10)
        key = cache.make_key(query="hola")

        class FakeValue:
            def model_dump_json(self):
                return '{"results": []}'

        # In-memory path stores the raw object, no serialization required.
        await cache.set(key, "cached-value")
        assert await cache.get(key) == "cached-value"

    @pytest.mark.asyncio
    async def test_invalidate_all_clears_in_memory_store(self):
        cache = AsyncRAGCache()
        key = cache.make_key(q="x")
        await cache.set(key, "value")
        await cache.invalidate_all()
        assert await cache.get(key) is None


class TestAnswerCacheEntityGuard:
    def _entry(self, sources):
        return {"sources": sources, "question": "q", "embedding": []}

    def test_passes_when_no_sources_scoped_to_single_program(self):
        entry = self._entry([{"program": None, "faculty": None}])
        assert AsyncAnswerCache._entity_guard_passes(entry, "cualquier pregunta") is True

    def test_passes_when_sources_span_multiple_programs(self):
        entry = self._entry([{"program": "Medicina"}, {"program": "Enfermería"}])
        assert AsyncAnswerCache._entity_guard_passes(entry, "cuánto cuesta la matrícula") is True

    def test_blocks_mismatched_single_program(self):
        entry = self._entry([{"program": "Medicina", "faculty": None}])
        assert AsyncAnswerCache._entity_guard_passes(entry, "requisitos para enfermería") is False

    def test_passes_matching_single_program(self):
        entry = self._entry([{"program": "Medicina", "faculty": None}])
        assert AsyncAnswerCache._entity_guard_passes(entry, "requisitos de admisión para medicina") is True

    def test_blocks_mismatched_faculty(self):
        entry = self._entry([{"program": None, "faculty": "Ingeniería"}])
        assert AsyncAnswerCache._entity_guard_passes(entry, "quiero estudiar salud pública") is False


class TestAnswerCacheFindSimilar:
    @pytest.mark.asyncio
    async def test_hit_above_threshold_returns_entry(self):
        cache = AsyncAnswerCache(similarity_threshold=0.9)
        await cache.store(
            embedding=[1.0, 0.0],
            question="cuántos créditos tiene medicina",
            answer="180 créditos",
            sources=[{"program": "Medicina"}],
            llm_provider="ollama",
            llm_model="qwen3:8b",
        )
        result = await cache.find_similar([1.0, 0.0], query_text="cuántos créditos tiene medicina")
        assert result is not None
        assert result["answer"] == "180 créditos"

    @pytest.mark.asyncio
    async def test_miss_below_threshold_returns_none(self):
        cache = AsyncAnswerCache(similarity_threshold=0.9)
        await cache.store(
            embedding=[1.0, 0.0],
            question="costo de matrícula",
            answer="X pesos",
            sources=[],
            llm_provider="ollama",
            llm_model="qwen3:8b",
        )
        result = await cache.find_similar([0.0, 1.0], query_text="algo completamente distinto")
        assert result is None

    @pytest.mark.asyncio
    async def test_entity_guard_rejects_cross_program_hit_despite_high_similarity(self):
        cache = AsyncAnswerCache(similarity_threshold=0.9)
        await cache.store(
            embedding=[1.0, 0.0],
            question="requisitos de admisión para medicina",
            answer="Respuesta sobre medicina",
            sources=[{"program": "Medicina", "faculty": None}],
            llm_provider="ollama",
            llm_model="qwen3:8b",
        )
        # Same embedding vector (similarity 1.0) simulates a near-identical
        # phrasing that differs only in the named program.
        result = await cache.find_similar([1.0, 0.0], query_text="requisitos de admisión para enfermería")
        assert result is None
