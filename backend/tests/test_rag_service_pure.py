"""Tests for pure (non-DB, non-async) methods of RAGService."""
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.rag_service import RAGService
from app.schemas.rag import SearchResultItem


def _make_item(
    score: float = 0.8,
    content: str = "chunk content",
    title: str = "Doc Title",
    chunk_id=None,
    program: str = None,
    faculty: str = None,
) -> SearchResultItem:
    return SearchResultItem(
        chunk_id=chunk_id or uuid4(),
        content=content,
        score=score,
        document_title=title,
        program=program,
        faculty=faculty,
        metadata=None,
    )


class TestEvaluateContextQuality:
    def setup_method(self):
        self.service = RAGService(db=MagicMock())

    def test_none_results(self):
        assert self.service.evaluate_context_quality([]) == "none"

    def test_weak_when_below_threshold(self):
        items = [_make_item(score=0.3)]
        assert self.service.evaluate_context_quality(items) == "weak"

    def test_good_when_above_threshold(self):
        items = [_make_item(score=0.5)]
        assert self.service.evaluate_context_quality(items) == "good"

    def test_boundary_at_042(self):
        items = [_make_item(score=0.42)]
        assert self.service.evaluate_context_quality(items) == "good"

    def test_just_below_042(self):
        items = [_make_item(score=0.419)]
        assert self.service.evaluate_context_quality(items) == "weak"


class TestApplyDiversity:
    def setup_method(self):
        self.service = RAGService(db=MagicMock())

    def test_limits_per_document(self):
        items = [
            _make_item(title="Doc A"),
            _make_item(title="Doc A"),
            _make_item(title="Doc A"),
            _make_item(title="Doc B"),
        ]
        result = self.service._apply_diversity(items, max_per_doc=2, top_k=10)
        doc_a_count = sum(1 for r in result if r.document_title == "Doc A")
        assert doc_a_count == 2

    def test_respects_top_k(self):
        items = [_make_item(title=f"Doc{i}") for i in range(10)]
        result = self.service._apply_diversity(items, max_per_doc=2, top_k=3)
        assert len(result) == 3

    def test_empty_list(self):
        result = self.service._apply_diversity([], max_per_doc=2, top_k=5)
        assert result == []


class TestRerank:
    def setup_method(self):
        self.service = RAGService(db=MagicMock())

    def test_empty_results(self):
        result = self.service._rerank("query", [])
        assert result == []

    def test_single_result(self):
        items = [_make_item(score=0.8, content="query match")]
        result = self.service._rerank("query match", items)
        assert len(result) == 1

    def test_keyword_boost_changes_order(self):
        # Second item has keyword overlap, first doesn't
        item1 = _make_item(score=0.81, content="unrelated content xyz")
        item2 = _make_item(score=0.80, content="materias del programa ingeniería")
        result = self.service._rerank("materias ingeniería", [item1, item2])
        # item2 should be boosted by keyword overlap
        assert result[0].content == "materias del programa ingeniería"


class TestDeduplicate:
    def setup_method(self):
        self.service = RAGService(db=MagicMock())

    def test_no_duplicates(self):
        items = [
            _make_item(content="completely different text one"),
            _make_item(content="another unrelated text two"),
        ]
        result = self.service._deduplicate(items)
        assert len(result) == 2

    def test_removes_near_duplicates(self):
        items = [
            _make_item(content="the quick brown fox jumps over the lazy dog"),
            _make_item(content="the quick brown fox jumps over the lazy cat"),
        ]
        result = self.service._deduplicate(items)
        assert len(result) == 1

    def test_empty_list(self):
        result = self.service._deduplicate([])
        assert result == []

    def test_keeps_dissimilar_content(self):
        items = [
            _make_item(content="ingeniería de sistemas plan de estudios semestres"),
            _make_item(content="requisitos admisión documentación fechas"),
        ]
        result = self.service._deduplicate(items)
        assert len(result) == 2
