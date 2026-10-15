import uuid
from types import SimpleNamespace

import pytest

from app.config import settings
from app.schemas.rag import SearchRequest, SearchResultItem
from app.services import rag_service as rag_service_module
from app.services.rag_service import RAGService

# Live incident (2026-10-12): "¿cuáles son los costos de inscripción y
# matrícula del ciclo tecnológico...?" was answered, but the same question
# with "precios"/"valores" came back "No tengo esa información". The vector
# leg (nomic-embed-text, no prefixes) barely separates paraphrases and the
# FTS leg stems precio/costo/valor to different lexemes, so a one-word
# synonym swap made the first retrieval pass "weak" and the caller refused.
# The multi-query retry asks a cheap model for N reformulations, retrieves
# each, and fuses everything with RRF BEFORE the refusal decision. These
# tests pin the retry contract: it fires only on a weak/none first pass (or
# rag_multiquery_always), never for Ollama, never when disabled, and the
# reformulations' hits can turn "weak" into "good".


def make_item(content, score=0.5, document_title="Doc"):
    return SearchResultItem(
        chunk_id=uuid.uuid4(), content=content, score=score,
        document_title=document_title, program=None, faculty=None, metadata=None,
    )


class _FakeLLMService:
    """Embeds anything to a fixed vector — the fake _vector_search below
    decides what comes back per call, so the embedding values don't matter."""
    embed_calls: list[list[str]] = []

    async def embed(self, request):
        _FakeLLMService.embed_calls.append(list(request.texts))
        return SimpleNamespace(embeddings=[[0.1, 0.2, 0.3] for _ in request.texts])


class _FakeRagCache:
    def make_key(self, **kwargs):
        return "k"

    async def get(self, key):
        return None

    async def set(self, key, value):
        pass


@pytest.fixture
def service(monkeypatch):
    _FakeLLMService.embed_calls = []
    monkeypatch.setattr(rag_service_module, "LLMService", _FakeLLMService)
    monkeypatch.setattr(rag_service_module, "rag_cache", _FakeRagCache())
    monkeypatch.setattr(settings, "rag_hyde_enabled", False)
    monkeypatch.setattr(settings, "rag_reranker_enabled", False)
    monkeypatch.setattr(settings, "rag_multiquery_enabled", True)
    monkeypatch.setattr(settings, "rag_multiquery_always", False)
    monkeypatch.setattr(settings, "rag_multiquery_variants", 3)
    return RAGService(db=None)


def _wire(service, monkeypatch, *, first_vector, variant_vector, variants):
    """Script the two retrieval legs: the first _vector_search call returns
    `first_vector`, every later one (the reformulations) returns
    `variant_vector`. FTS returns nothing. Records how often variants were
    requested."""
    calls = {"vector": 0, "variants": 0}

    async def fake_vector_search(embedding, where_clause, base_params, candidate_k, threshold):
        calls["vector"] += 1
        return list(first_vector) if calls["vector"] == 1 else list(variant_vector)

    async def fake_keyword_search(query, where_clause, base_params, exclude_ids, limit):
        return []

    async def fake_generate_variants(query):
        calls["variants"] += 1
        return list(variants)

    monkeypatch.setattr(service, "_vector_search", fake_vector_search)
    monkeypatch.setattr(service, "_keyword_search", fake_keyword_search)
    monkeypatch.setattr(service, "_generate_query_variants", fake_generate_variants)
    return calls


class TestParseVariants:
    def test_strips_numbering_bullets_quotes_and_dedupes(self):
        raw = (
            '1. "¿Cuánto cuesta la matrícula del ciclo tecnológico?"\n'
            "- ¿Cuál es el valor de inscripción y matrícula del ciclo tecnológico?\n"
            "• ¿cuánto cuesta la matrícula del ciclo tecnológico?\n"   # dup of #1
            "\n"
            "ok\n"                                                      # too short
            "3) ¿Qué derechos pecuniarios aplican al ciclo tecnológico?\n"
        )
        out = RAGService._parse_variants(raw, "¿Cuáles son los costos?", n=5)
        assert out == [
            "¿Cuánto cuesta la matrícula del ciclo tecnológico?",
            "¿Cuál es el valor de inscripción y matrícula del ciclo tecnológico?",
            "¿Qué derechos pecuniarios aplican al ciclo tecnológico?",
        ]

    def test_drops_the_original_question_and_caps_at_n(self):
        original = "¿Cuáles son los costos de matrícula?"
        raw = f"{original}\nvariante uno larga\nvariante dos larga\nvariante tres larga"
        out = RAGService._parse_variants(raw, original, n=2)
        assert out == ["variante uno larga", "variante dos larga"]


class TestMultiQueryRetry:
    async def test_weak_first_pass_is_rescued_by_reformulations(self, service, monkeypatch):
        rescued = make_item("Resolución derechos pecuniarios: matrícula ciclo tecnológico ...", score=0.62)
        calls = _wire(
            service, monkeypatch,
            first_vector=[], variant_vector=[rescued],
            variants=["¿Cuál es el valor de la matrícula?", "¿Cuánto cuesta inscribirse?"],
        )
        response = await service.search(SearchRequest(
            query="¿Cuáles son los precios de inscripción y matrícula del ciclo tecnológico?",
            hyde_provider_override="openai",
        ))
        assert calls["variants"] == 1
        assert calls["vector"] == 3            # original + 2 reformulations
        assert [r.chunk_id for r in response.results] == [rescued.chunk_id]
        assert service.evaluate_context_quality(response.results) == "good"
        # the reformulations were embedded in ONE batched call, not one per variant
        assert _FakeLLMService.embed_calls[-1] == [
            "¿Cuál es el valor de la matrícula?", "¿Cuánto cuesta inscribirse?",
        ]

    async def test_good_first_pass_never_asks_for_variants(self, service, monkeypatch):
        hit = make_item("Costos de inscripción y matrícula ...", score=0.71)
        calls = _wire(service, monkeypatch, first_vector=[hit], variant_vector=[], variants=["x" * 20])
        response = await service.search(SearchRequest(
            query="¿Cuáles son los costos de inscripción y matrícula?",
            hyde_provider_override="openai",
        ))
        assert calls["variants"] == 0
        assert calls["vector"] == 1
        assert [r.chunk_id for r in response.results] == [hit.chunk_id]

    async def test_always_mode_fuses_even_when_first_pass_is_good(self, service, monkeypatch):
        monkeypatch.setattr(settings, "rag_multiquery_always", True)
        hit = make_item("primera pasada", score=0.71)
        extra = make_item("hallado por la reformulación", score=0.55)
        calls = _wire(service, monkeypatch, first_vector=[hit], variant_vector=[extra], variants=["variante larga uno"])
        response = await service.search(SearchRequest(query="¿pregunta?", hyde_provider_override="openai"))
        assert calls["variants"] == 1
        assert {r.chunk_id for r in response.results} == {hit.chunk_id, extra.chunk_id}

    async def test_ollama_provider_skips_the_retry(self, service, monkeypatch):
        calls = _wire(service, monkeypatch, first_vector=[], variant_vector=[make_item("x", 0.6)], variants=["variante larga uno"])
        response = await service.search(SearchRequest(query="¿pregunta?", hyde_provider_override="ollama"))
        assert calls["variants"] == 0
        assert response.results == []

    async def test_disabled_setting_skips_the_retry(self, service, monkeypatch):
        monkeypatch.setattr(settings, "rag_multiquery_enabled", False)
        calls = _wire(service, monkeypatch, first_vector=[], variant_vector=[make_item("x", 0.6)], variants=["variante larga uno"])
        response = await service.search(SearchRequest(query="¿pregunta?", hyde_provider_override="openai"))
        assert calls["variants"] == 0
        assert response.results == []

    async def test_no_variants_returned_keeps_first_pass_result(self, service, monkeypatch):
        calls = _wire(service, monkeypatch, first_vector=[], variant_vector=[make_item("x", 0.6)], variants=[])
        response = await service.search(SearchRequest(query="¿pregunta?", hyde_provider_override="openai"))
        assert calls["variants"] == 1
        assert calls["vector"] == 1            # nothing to retrieve with
        assert response.results == []

    async def test_chunk_found_by_several_reformulations_ranks_first(self, service, monkeypatch):
        consensus = make_item("hallado por todas las variantes", score=0.50)
        lonely = make_item("solo en la primera variante", score=0.58)
        seq = iter([[], [lonely, consensus], [consensus], [consensus]])

        async def fake_vector_search(embedding, where_clause, base_params, candidate_k, threshold):
            return list(next(seq))

        async def fake_keyword_search(*args, **kwargs):
            return []

        async def fake_variants(query):
            return ["variante larga uno", "variante larga dos", "variante larga tres"]

        monkeypatch.setattr(service, "_vector_search", fake_vector_search)
        monkeypatch.setattr(service, "_keyword_search", fake_keyword_search)
        monkeypatch.setattr(service, "_generate_query_variants", fake_variants)
        response = await service.search(SearchRequest(query="¿pregunta?", hyde_provider_override="openai"))
        # RRF: present in 3 lists beats present in 1, regardless of raw cosine
        assert response.results[0].chunk_id == consensus.chunk_id


class TestForcedMultiQuery:
    async def test_force_flag_expands_even_when_first_pass_is_good(self, service, monkeypatch):
        hit = make_item("primera pasada", score=0.71)
        extra = make_item("hallado por la reformulación", score=0.55)
        calls = _wire(service, monkeypatch, first_vector=[hit], variant_vector=[extra], variants=["variante larga uno"])
        response = await service.search(SearchRequest(
            query="¿pregunta?", hyde_provider_override="openai", force_multiquery=True,
        ))
        assert calls["variants"] == 1
        assert response.multiquery_used is True
        assert {r.chunk_id for r in response.results} == {hit.chunk_id, extra.chunk_id}

    async def test_response_reports_when_no_expansion_happened(self, service, monkeypatch):
        hit = make_item("primera pasada", score=0.71)
        _wire(service, monkeypatch, first_vector=[hit], variant_vector=[], variants=["x" * 20])
        response = await service.search(SearchRequest(query="¿pregunta?", hyde_provider_override="openai"))
        assert response.multiquery_used is False


class TestVariantsPromptAsksForShortQuestions:
    def test_prompt_mentions_short_direct_questions(self):
        from app.services.rag_service import _MULTIQUERY_PROMPT
        assert "corta y directa" in _MULTIQUERY_PROMPT
