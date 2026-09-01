import uuid

import pytest

from app.config import settings
from app.schemas.rag import SearchResultItem
from app.services.rag_service import RAGService


def make_item(content, score=0.5, document_title="Doc", program=None, faculty=None):
    return SearchResultItem(
        chunk_id=uuid.uuid4(),
        content=content,
        score=score,
        document_title=document_title,
        program=program,
        faculty=faculty,
        metadata=None,
    )


@pytest.fixture
def service():
    return RAGService(db=None)


class TestDeduplicate:
    def test_near_duplicate_chunks_are_removed(self, service):
        base = "La institución universitaria del Putumayo ofrece programas académicos de pregrado y posgrado"
        items = [make_item(base, score=0.9), make_item(base, score=0.8)]
        result = service._deduplicate(items)
        assert len(result) == 1
        assert result[0].score == 0.9  # keeps the first (higher-ranked) occurrence

    def test_distinct_chunks_are_kept(self, service):
        items = [
            make_item("Requisitos de admisión para el programa de medicina", score=0.9),
            make_item("Costos de matrícula para el segundo semestre académico", score=0.8),
        ]
        result = service._deduplicate(items)
        assert len(result) == 2

    def test_empty_list_returns_empty(self, service):
        assert service._deduplicate([]) == []


class TestApplyDiversity:
    def test_caps_chunks_per_document(self, service):
        items = [make_item(f"chunk {i}", document_title="DocA") for i in range(5)]
        result = service._apply_diversity(items, max_per_doc=2, top_k=10)
        assert len(result) == 2

    def test_respects_top_k_across_documents(self, service):
        items = (
            [make_item(f"a{i}", document_title="DocA") for i in range(3)]
            + [make_item(f"b{i}", document_title="DocB") for i in range(3)]
        )
        result = service._apply_diversity(items, max_per_doc=2, top_k=3)
        assert len(result) == 3

    def test_diverse_documents_all_represented(self, service):
        items = [
            make_item("a", document_title="DocA"),
            make_item("b", document_title="DocB"),
            make_item("c", document_title="DocC"),
        ]
        result = service._apply_diversity(items, max_per_doc=2, top_k=10)
        titles = {r.document_title for r in result}
        assert titles == {"DocA", "DocB", "DocC"}


class TestFuseRRF:
    def test_item_ranked_high_in_both_lists_wins(self, service):
        a = make_item("a", document_title="A")
        b = make_item("b", document_title="B")
        c = make_item("c", document_title="C")
        vector = [a, b, c]      # A first
        keyword = [c, a, b]     # A second — still the best combined rank
        result = service._fuse_rrf([vector, keyword])
        assert result[0].document_title == "A"

    def test_item_only_in_one_list_is_still_included(self, service):
        a = make_item("a", document_title="A")
        b = make_item("b", document_title="B")
        result = service._fuse_rrf([[a], [b]])
        titles = {r.document_title for r in result}
        assert titles == {"A", "B"}

    def test_single_list_preserves_its_order(self, service):
        a = make_item("a", document_title="A")
        b = make_item("b", document_title="B")
        result = service._fuse_rrf([[a, b]])
        assert [r.document_title for r in result] == ["A", "B"]

    def test_empty_lists_returns_empty(self, service):
        assert service._fuse_rrf([[], []]) == []


class TestRerankCrossEncoder:
    @pytest.mark.asyncio
    async def test_disabled_returns_input_order_unchanged(self, service, monkeypatch):
        monkeypatch.setattr(settings, "rag_reranker_enabled", False)
        a = make_item("a", document_title="A")
        b = make_item("b", document_title="B")
        result = await service._rerank_cross_encoder("query", [a, b], "openai")
        assert result == [a, b]

    @pytest.mark.asyncio
    async def test_ollama_provider_skips_reranking(self, service, monkeypatch):
        # Same CPU-budget rationale as HyDE — see docstring. The prod host
        # runs Ollama with ~zero margin under its 600s timeout, so this must
        # never touch the reranker at all, not even to check availability.
        called = False

        def fake_get_reranker():
            nonlocal called
            called = True
            return None

        monkeypatch.setattr("app.services.rag_service._get_reranker", fake_get_reranker)
        a = make_item("a", document_title="A")
        b = make_item("b", document_title="B")
        result = await service._rerank_cross_encoder("query", [a, b], "ollama")
        assert result == [a, b]
        assert called is False

    @pytest.mark.asyncio
    async def test_reorders_by_cross_encoder_relevance(self, service, monkeypatch):
        a = make_item("informacion general sin relacion aparente", document_title="A")
        b = make_item("el programa de medicina tiene 180 creditos", document_title="B")

        class FakeReranker:
            def rerank(self, query, docs):
                return [0.1, 9.5]  # B is the relevant one

        monkeypatch.setattr("app.services.rag_service._get_reranker", lambda: FakeReranker())
        result = await service._rerank_cross_encoder("créditos programa medicina", [a, b], "openai")
        assert result[0].document_title == "B"

    @pytest.mark.asyncio
    async def test_reranker_unavailable_falls_back_to_input_order(self, service, monkeypatch):
        monkeypatch.setattr("app.services.rag_service._get_reranker", lambda: None)
        a = make_item("a", document_title="A")
        b = make_item("b", document_title="B")
        result = await service._rerank_cross_encoder("query", [a, b], "openai")
        assert result == [a, b]

    @pytest.mark.asyncio
    async def test_reranker_call_failing_falls_back_to_input_order(self, service, monkeypatch):
        class BrokenReranker:
            def rerank(self, query, docs):
                raise RuntimeError("model crashed")

        monkeypatch.setattr("app.services.rag_service._get_reranker", lambda: BrokenReranker())
        a = make_item("a", document_title="A")
        b = make_item("b", document_title="B")
        result = await service._rerank_cross_encoder("query", [a, b], "openai")
        assert result == [a, b]

    @pytest.mark.asyncio
    async def test_empty_results_returns_empty(self, service):
        assert await service._rerank_cross_encoder("query", [], "openai") == []

    @pytest.mark.asyncio
    async def test_single_result_is_unaffected(self, service):
        item = make_item("contenido único", score=0.6)
        result = await service._rerank_cross_encoder("query", [item], "openai")
        assert result == [item]


class TestEvaluateContextQuality:
    def test_no_results_is_none(self, service):
        assert service.evaluate_context_quality([]) == "none"

    def test_top_score_above_threshold_is_good(self, service):
        items = [make_item("x", score=0.9)]
        assert service.evaluate_context_quality(items) == "good"

    def test_top_score_below_threshold_is_weak(self, service):
        items = [make_item("x", score=0.01)]
        assert service.evaluate_context_quality(items) == "weak"
