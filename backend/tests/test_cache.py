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

    @pytest.mark.asyncio
    async def test_invalidate_all_does_not_log_success_when_redis_fails(self, caplog):
        # Confirmed live before the fix: invalidate_all() logged "RAG cache
        # invalidated" unconditionally, even from inside the except branch —
        # a failed Redis delete looked identical to a successful one in the
        # logs, right after a document upload/edit (the one place this
        # matters: stale RAG results could keep being served with no trace).
        cache = AsyncRAGCache()

        class FailingRedis:
            def scan_iter(self, _pattern):
                raise RuntimeError("redis unavailable")

        cache._redis = FailingRedis()
        with caplog.at_level("WARNING", logger="app.utils.cache"):
            await cache.invalidate_all()

        assert "invalidate FAILED" in caplog.text
        assert "RAG cache invalidated" not in caplog.text


class TestAnswerCacheEntityGuard:
    def _entry(self, sources, question="q"):
        return {"sources": sources, "question": question, "embedding": []}

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

    def test_falls_back_to_document_title_when_program_and_faculty_unset(self):
        # Every document currently uploaded has program/faculty empty (both
        # are optional, admin-filled fields) — the guard must still catch a
        # cross-program collision using the document title instead of
        # silently doing nothing.
        entry = self._entry([{
            "program": None, "faculty": None,
            "document_title": "07_DesarrolloSoftware_e_IngSistemas",
        }])
        assert AsyncAnswerCache._entity_guard_passes(
            entry, "que materias hay en quinto semestre de contaduria"
        ) is False
        assert AsyncAnswerCache._entity_guard_passes(
            entry, "que materias hay en quinto semestre de sistemas"
        ) is True

    def test_title_fallback_splits_camel_case(self):
        # "IngSistemas" must be recognized as the word "sistemas", not one
        # opaque "ingsistemas" token that never matches a real query.
        entry = self._entry([{
            "program": None, "faculty": None,
            "document_title": "09_GestionContable_e_ContaduriaPublica",
        }])
        assert AsyncAnswerCache._entity_guard_passes(
            entry, "cuantos creditos tiene contaduria"
        ) is True

    def test_question_overlap_bypasses_title_fallback_on_general_document(self):
        # Confirmed live: "cuales son los requisitos para admision?" scored
        # 0.995 similarity against the cached "...de admision?" (same
        # question) but the title fallback rejected it anyway, because
        # neither question mentions the source document's title words
        # ("estatuto", "estudiantil") — a general institutional document has
        # no single program/faculty to protect. Every significant word in
        # the new query already appearing in the cached question is direct
        # same-topic evidence, so the title check should be skipped.
        entry = self._entry(
            [{
                "program": None, "faculty": None,
                "document_title": "ESTATUTO ESTUDIANTIL 25 DE FEBRERO 2025",
            }],
            question="Cuales son los requisitos de admision?",
        )
        assert AsyncAnswerCache._entity_guard_passes(
            entry, "Cuales son los requisitos para admision?"
        ) is True

    def test_question_overlap_bypass_never_skips_program_field_check(self):
        # The bypass must be scoped to the title fallback ONLY. If the cached
        # answer has an explicit program field, a subset query that never
        # names that program must still be rejected — even though it's a
        # textual subset of the cached question, "requisitos de admision"
        # (generic) says nothing about medicina and could just as easily be
        # someone asking about a different program.
        entry = self._entry(
            [{"program": "Medicina", "faculty": None}],
            question="requisitos de admision para medicina",
        )
        assert AsyncAnswerCache._entity_guard_passes(
            entry, "requisitos de admision"
        ) is False

    def test_question_overlap_bypass_does_not_reopen_cross_program_collision(self):
        # The bypass must not undermine the exact protection
        # test_falls_back_to_document_title_when_program_and_faculty_unset
        # exists for: a query naming a DIFFERENT program than the cached
        # question always introduces a new significant word ("contaduria")
        # that isn't in the cached question's words, so it can never satisfy
        # the subset check and must still fall through to the title check.
        entry = self._entry(
            [{
                "program": None, "faculty": None,
                "document_title": "07_DesarrolloSoftware_e_IngSistemas",
            }],
            question="que materias hay en quinto semestre de sistemas",
        )
        assert AsyncAnswerCache._entity_guard_passes(
            entry, "que materias hay en quinto semestre de contaduria"
        ) is False


class TestAnswerCacheSemesterGuard:
    def _entry(self, question):
        return {"question": question, "sources": [], "embedding": []}

    def test_blocks_different_semester_same_program(self):
        # Confirmed live: this exact pair scores 0.9250 cosine similarity
        # with the answer-cache embedding model — above the default 0.90
        # threshold — despite being about different semesters.
        entry = self._entry("que veo en tercer semestre de obras civiles")
        assert AsyncAnswerCache._semester_guard_passes(
            entry, "que veo en cuarto semestre de obras civiles"
        ) is False

    def test_passes_same_semester_different_phrasing(self):
        entry = self._entry("cuales son las materias de quinto semestre de ingenieria de sistemas")
        assert AsyncAnswerCache._semester_guard_passes(
            entry, "que asignaturas veo en el quinto semestre de sistemas"
        ) is True

    def test_passes_when_neither_mentions_a_semester(self):
        entry = self._entry("cuantos creditos tiene el programa de gastronomia")
        assert AsyncAnswerCache._semester_guard_passes(
            entry, "cuantos creditos suma toda la carrera de gastronomia"
        ) is True

    def test_blocks_numeric_semestre_n_form(self):
        entry = self._entry("creditos del semestre 1 de contaduria")
        assert AsyncAnswerCache._semester_guard_passes(
            entry, "creditos del semestre 2 de contaduria"
        ) is False

    def test_blocks_ultimo_semestre_against_specific_number(self):
        entry = self._entry("materias del primer semestre de gastronomia")
        assert AsyncAnswerCache._semester_guard_passes(
            entry, "materias del ultimo semestre de gastronomia"
        ) is False


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

    @pytest.mark.asyncio
    async def test_semester_guard_rejects_hit_despite_high_similarity(self):
        cache = AsyncAnswerCache(similarity_threshold=0.9)
        await cache.store(
            embedding=[1.0, 0.0],
            question="que veo en tercer semestre de obras civiles",
            answer="Respuesta sobre tercer semestre",
            sources=[],
            llm_provider="ollama",
            llm_model="qwen3:8b",
        )
        # Same embedding vector (similarity 1.0) simulates the real 0.9250
        # measured similarity between these two questions.
        result = await cache.find_similar([1.0, 0.0], query_text="que veo en cuarto semestre de obras civiles")
        assert result is None


class TestAnswerCacheInvalidate:
    @pytest.mark.asyncio
    async def test_invalidate_all_does_not_log_success_when_redis_fails(self, caplog):
        # Same fix and same reason as AsyncRAGCache's equivalent test: a
        # failed Redis delete was previously logged as "Answer cache
        # invalidated" unconditionally, from inside the except branch.
        cache = AsyncAnswerCache()

        class FailingRedis:
            async def delete(self, _key):
                raise RuntimeError("redis unavailable")

        cache._redis = FailingRedis()
        with caplog.at_level("WARNING", logger="app.utils.cache"):
            await cache.invalidate_all()

        assert "invalidate FAILED" in caplog.text
        assert "Answer cache invalidated" not in caplog.text
