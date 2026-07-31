from types import SimpleNamespace

import pytest

from app.schemas.rag import SearchRequest
from app.services.goldstandard_eval_service import (
    GoldQuery,
    _run_retrieval_case,
    _split_doc_refs,
)


class FakeRAGService:
    """Returns fixed titles regardless of the query — only the matching
    logic in _run_retrieval_case is under test here, not real retrieval."""

    def __init__(self, titles: list[str]):
        self._titles = titles

    async def search(self, request: SearchRequest):
        results = [
            SimpleNamespace(document_title=t, content=f"chunk from {t}")
            for t in self._titles
        ]
        return SimpleNamespace(results=results)


class TestSplitDocRefs:
    def test_strips_extension_and_parenthetical_notes(self):
        assert _split_doc_refs("07_X.xlsx; sitio web / 09_Y.xls (nota)") == ["07_x", "09_y"]

    def test_drops_generic_non_file_references(self):
        assert _split_doc_refs("sitio web / verificar si está cargado") == []


class TestRetrievalMatchingIsSubstring:
    """The real bug: xlsx doc names are shortened/differently-cased
    fragments of the DB's document.title (e.g. gold-set
    "FICB024-RESPUESTA SOLICITUD" vs actual title
    "FICB024-RESPUESTA SOLICITUD INFORMACIÓN ACADÉMICA INSTITUCIONAL").
    Exact-equality matching made every case silently score as ~0 even when
    retrieval was correct — must be a substring match in either direction."""

    @pytest.mark.asyncio
    async def test_shortened_gold_set_name_matches_longer_real_title(self):
        q = GoldQuery(
            id="1", category="c", query="query",
            query_type="dentro de alcance",
            expected_documents=["ficb024 respuesta solicitud"],
        )
        rag = FakeRAGService(["ficb024 respuesta solicitud informacion academica institucional"])
        result = await _run_retrieval_case(rag, q, k=5)
        assert result.precision_at_k == pytest.approx(1 / 5)
        assert result.recall_at_k == pytest.approx(1.0)
        assert result.reciprocal_rank == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_longer_gold_set_name_matches_shorter_real_title(self):
        q = GoldQuery(
            id="2", category="c", query="query",
            query_type="dentro de alcance",
            expected_documents=["reglamento estudiantil version larga del nombre"],
        )
        rag = FakeRAGService(["reglamento estudiantil"])
        result = await _run_retrieval_case(rag, q, k=5)
        assert result.recall_at_k == pytest.approx(1.0)

    @pytest.mark.asyncio
    async def test_unrelated_titles_do_not_match(self):
        q = GoldQuery(
            id="3", category="c", query="query",
            query_type="dentro de alcance",
            expected_documents=["reglamento estudiantil"],
        )
        rag = FakeRAGService(["costos de matricula 2026"])
        result = await _run_retrieval_case(rag, q, k=5)
        assert result.precision_at_k == 0.0
        assert result.recall_at_k == 0.0
        assert result.reciprocal_rank == 0.0

    @pytest.mark.asyncio
    async def test_only_scored_for_dentro_de_alcance_with_expected_docs(self):
        q = GoldQuery(
            id="4", category="c", query="query",
            query_type="fuera de alcance",
            expected_documents=[],
        )
        rag = FakeRAGService(["cualquier documento"])
        result = await _run_retrieval_case(rag, q, k=5)
        assert result.precision_at_k is None
        assert result.recall_at_k is None
        assert result.reciprocal_rank is None
