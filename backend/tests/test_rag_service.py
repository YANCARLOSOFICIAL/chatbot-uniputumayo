import uuid

import pytest

from app.config import settings
from app.schemas.rag import SearchResultItem
from app.services.rag_service import RAGService, _highest_semester_marker, _roman_to_int


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


class TestCapUntaggedShare:
    def test_untagged_capped_program_chunks_kept(self, service, monkeypatch):
        monkeypatch.setattr(settings, "rag_program_filter_untagged_cap", 3)
        items = (
            [make_item("matr", program=None, document_title="Matriculas") for _ in range(5)]
            + [make_item("plan", program="Seguridad Informatica", document_title="Plan") for _ in range(2)]
            + [make_item("estatuto", program=None, document_title="Estatuto")]
        )
        result = service._cap_untagged_share(items, "Seguridad Informatica")
        untagged = [r for r in result if r.program is None]
        tagged = [r for r in result if r.program == "Seguridad Informatica"]
        assert len(untagged) == 3  # capped
        assert len(tagged) == 2    # all program chunks kept

    def test_thin_program_still_backfilled_by_untagged(self, service, monkeypatch):
        # A program with no chunks of its own (título/perfil question) still
        # gets the untagged general-reference doc — up to the cap.
        monkeypatch.setattr(settings, "rag_program_filter_untagged_cap", 3)
        items = [make_item("perfil", program=None, document_title="Perfiles") for _ in range(6)]
        result = service._cap_untagged_share(items, "Ingenieria de Sistemas")
        assert len(result) == 3

    def test_order_is_preserved(self, service, monkeypatch):
        monkeypatch.setattr(settings, "rag_program_filter_untagged_cap", 1)
        items = [
            make_item("u1", program=None),
            make_item("p1", program="P"),
            make_item("u2", program=None),
            make_item("p2", program="P"),
        ]
        result = service._cap_untagged_share(items, "P")
        assert [r.content for r in result] == ["u1", "p1", "p2"]  # u2 dropped, rest in order


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


class TestHighestSemesterMarker:
    """See rag_service.py's _boost_last_semester_chunk — confirmed live
    2026-09-11 (GS-060/GS-064) that plain semantic search can't reliably
    find the true last semester's chunk for "último semestre" queries; this
    is the literal content scan that replaces trusting embedding similarity."""

    def test_finds_roman_numeral(self):
        assert _highest_semester_marker("SEMESTRE VII: Programación Avanzada") == 7

    def test_finds_arabic_numeral(self):
        assert _highest_semester_marker("Semestre 10 — Proyecto de Grado") == 10

    def test_picks_the_max_among_several_mentions(self):
        content = "SEMESTRE III: x\n\nSEMESTRE VIII: y\n\nSEMESTRE V: z"
        assert _highest_semester_marker(content) == 8

    def test_no_semester_mention_returns_none(self):
        assert _highest_semester_marker("Requisitos de admisión para el programa") is None


class TestRomanToInt:
    def test_common_curriculum_values(self):
        assert _roman_to_int("VII") == 7
        assert _roman_to_int("X") == 10
        assert _roman_to_int("IV") == 4
        assert _roman_to_int("I") == 1

    def test_invalid_token_returns_none(self):
        assert _roman_to_int("abc") is None
        assert _roman_to_int("") is None


class _FakeRow:
    def __init__(self, chunk_id, content, document_title="Doc", program=None, faculty=None, metadata=None):
        self.chunk_id = chunk_id
        self.content = content
        self.document_title = document_title
        self.program = program
        self.faculty = faculty
        self.metadata = metadata


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class _FakeDB:
    """Ignores the query text entirely — _boost_last_semester_chunk's SQL is
    a plain content scan, not under test here; only what it does with the
    returned rows is."""

    def __init__(self, rows):
        self._rows = rows

    async def execute(self, *args, **kwargs):
        return _FakeResult(self._rows)


class TestBoostLastSemesterChunk:
    """Confirmed live 2026-09-11: Ollama's HyDE-off retrieval deterministically
    landed on "SEMESTRE VII" (wrong) for a program whose real last semester is
    X, while OpenAI's HyDE-on retrieval got "décimo semestre" (correct) for
    the byte-identical query — see query_utils.is_last_semester_query and the
    goldstandard_eval_wip memory for the full root-cause writeup."""

    @pytest.mark.asyncio
    async def test_promotes_higher_semester_chunk_found_in_db(self):
        wrong = make_item("SEMESTRE VII: materias equivocadas", program="ingenieria de sistemas")
        service = RAGService(db=_FakeDB([
            _FakeRow(uuid.uuid4(), "SEMESTRE X: materias correctas", program="ingenieria de sistemas"),
        ]))

        result = await service._boost_last_semester_chunk([wrong], "ingenieria de sistemas")

        assert len(result) == 1  # replaces, doesn't grow the result set
        assert "SEMESTRE X" in result[0].content

    @pytest.mark.asyncio
    async def test_noop_when_results_already_have_the_true_max(self):
        correct = make_item("SEMESTRE X: materias correctas", program="ingenieria de sistemas")
        service = RAGService(db=_FakeDB([
            _FakeRow(uuid.uuid4(), "SEMESTRE V: otras materias", program="ingenieria de sistemas"),
        ]))

        result = await service._boost_last_semester_chunk([correct], "ingenieria de sistemas")

        assert result[0].content == correct.content
        assert result[0].chunk_id == correct.chunk_id

    @pytest.mark.asyncio
    async def test_preserves_result_count_across_multiple_items(self):
        items = [
            make_item("SEMESTRE 1: x", program="p"),
            make_item("SEMESTRE 2: y", program="p"),
            make_item("SEMESTRE 3: z", program="p"),
        ]
        service = RAGService(db=_FakeDB([
            _FakeRow(uuid.uuid4(), "SEMESTRE 10: la respuesta real", program="p"),
        ]))

        result = await service._boost_last_semester_chunk(items, "p")

        assert len(result) == len(items)
        assert "SEMESTRE 10" in result[0].content

    @pytest.mark.asyncio
    async def test_no_db_row_beats_current_results_returns_unchanged(self):
        items = [make_item("SEMESTRE X: la correcta", program="p")]
        service = RAGService(db=_FakeDB([]))

        result = await service._boost_last_semester_chunk(items, "p")

        assert result == items
