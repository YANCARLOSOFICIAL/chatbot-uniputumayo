import uuid

import pytest

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


class TestRerank:
    def test_keyword_overlap_can_promote_lower_semantic_score(self, service):
        query = "créditos programa medicina"
        low_semantic_high_keyword = make_item(
            "el programa de medicina tiene 180 créditos", score=0.40
        )
        high_semantic_low_keyword = make_item(
            "informacion general sin relacion aparente", score=0.55
        )
        reranked = service._rerank(query, [high_semantic_low_keyword, low_semantic_high_keyword])
        assert reranked[0].content.startswith("el programa de medicina")

    def test_empty_results_returns_empty(self, service):
        assert service._rerank("query", []) == []

    def test_single_result_is_unaffected(self, service):
        item = make_item("contenido único", score=0.6)
        result = service._rerank("query", [item])
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
