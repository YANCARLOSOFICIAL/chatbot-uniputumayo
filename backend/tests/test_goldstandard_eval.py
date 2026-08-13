from types import SimpleNamespace

import httpx
import openai
import pytest

from app.providers.provider_factory import ProviderFactory
from app.schemas.rag import SearchRequest
from app.services.goldstandard_eval_service import (
    GoldQuery,
    _judge_hallucination,
    _run_retrieval_case,
    _split_doc_refs,
)


def _rate_limit_error() -> openai.RateLimitError:
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx.Response(429, request=request)
    return openai.RateLimitError("rate limited", response=response, body=None)


class FakeRAGService:
    """Returns fixed titles regardless of the query — only the matching
    logic in _run_retrieval_case is under test here, not real retrieval."""

    def __init__(self, titles: list[str]):
        self._titles = titles
        self.last_request: SearchRequest | None = None

    async def search(self, request: SearchRequest):
        self.last_request = request
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

    @pytest.mark.asyncio
    async def test_pins_hyde_to_openai_regardless_of_live_admin_provider(self):
        """Retrieval metrics must not depend on whatever provider happens to
        be active in /admin/config at run time — that dependency (via
        RAGService.search()'s hyde_active check) is what collapsed a real
        run's Precision@5/Recall@5/MRR/Hit rate on 2026-08-13 when the live
        provider was Ollama."""
        q = GoldQuery(
            id="5", category="c", query="query",
            query_type="dentro de alcance",
            expected_documents=["doc"],
        )
        rag = FakeRAGService(["doc"])
        await _run_retrieval_case(rag, q, k=5)
        assert rag.last_request.hyde_provider_override == "openai"


class FakeRateLimitedProvider:
    """Raises openai.RateLimitError a fixed number of times, then succeeds —
    simulates the real prod pattern (30k TPM cap hit mid-run, clears within
    a couple seconds) without ever making a real API call."""

    def __init__(self, failures_before_success: int, verdict: str = "NO"):
        self._remaining_failures = failures_before_success
        self._verdict = verdict
        self.call_count = 0

    async def generate(self, **kwargs):
        self.call_count += 1
        if self._remaining_failures > 0:
            self._remaining_failures -= 1
            raise _rate_limit_error()
        return {"content": self._verdict}


class TestJudgeHallucinationRateLimitRetry:
    """The real bug: 5/77 OpenAI judge calls in the 2026-08-05 prod run
    failed with 429 (org TPM cap) and were silently excluded from the
    hallucination rate instead of retried — confirmed via prod logs."""

    @pytest.mark.asyncio
    async def test_retries_and_succeeds_after_transient_rate_limit(self, monkeypatch):
        monkeypatch.setattr("app.services.goldstandard_eval_service.asyncio.sleep", lambda *_: _noop())
        provider = FakeRateLimitedProvider(failures_before_success=2, verdict="NO")
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: provider)

        result = await _judge_hallucination("openai", "gpt-4.1", "query", "context", "answer")

        assert result is False
        assert provider.call_count == 3

    @pytest.mark.asyncio
    async def test_raises_after_exhausting_retries(self, monkeypatch):
        monkeypatch.setattr("app.services.goldstandard_eval_service.asyncio.sleep", lambda *_: _noop())
        provider = FakeRateLimitedProvider(failures_before_success=99)
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: provider)

        with pytest.raises(openai.RateLimitError):
            await _judge_hallucination("openai", "gpt-4.1", "query", "context", "answer")

        assert provider.call_count == 4  # initial attempt + 3 retries


async def _noop():
    return None


class TestClarificationExcludedFromHallucinationJudging:
    """The real bug found via the 2026-08-08 prod run: a "which program?"
    clarification reply (CLARIFICATION_MARKER) isn't a real answer to judge
    against a single-document context — it lists unrelated program names by
    design. The old code only skipped judging for REFUSAL_MARKER, so the
    judge ran on clarification replies too and (confirmed live) marked most
    of them "SI" (hallucinated), inflating the reported rate: 22/27 of
    OpenAI's and 17/25 of Ollama's "hallucinated" cases in that run were
    actually mis-fired clarifications, not real hallucinations."""

    @pytest.mark.asyncio
    async def test_run_generation_case_skips_judge_for_clarification_reply(self, monkeypatch):
        from app.services.goldstandard_eval_service import _run_generation_case

        clarification_answer = (
            "Tu pregunta puede aplicar a varios programas académicos de Uniputumayo. "
            "¿Sobre cuál programa te gustaría saber específicamente?\n\n- Ing. Sistemas\n- Administración"
        )
        fake_response = SimpleNamespace(assistant_message=SimpleNamespace(content=clarification_answer))

        async def fake_process_message(*args, **kwargs):
            return fake_response

        monkeypatch.setattr(
            "app.services.goldstandard_eval_service.ChatService.process_message",
            fake_process_message,
        )

        called = False

        async def fail_if_called(*args, **kwargs):
            nonlocal called
            called = True
            return True

        monkeypatch.setattr(
            "app.services.goldstandard_eval_service._judge_hallucination", fail_if_called,
        )

        fake_db = SimpleNamespace(add=lambda *_: None, flush=_noop)
        q = GoldQuery(
            id="GS-007", category="c", query="¿Qué materias tiene X?",
            query_type="dentro de alcance", expected_documents=["07_x"],
        )

        result = await _run_generation_case(fake_db, q, "some retrieved context", "openai", "gpt-4.1")

        assert called is False, "the judge must never be called for a clarification reply"
        assert result.clarification is True
        assert result.refused is False
        assert result.hallucinated is None


class TestComputeGenerationStatsRecomputesFromCases:
    """_compute_generation_stats (used by the markdown report) must recompute
    hallucination_rate/judged_cases from the per-case answer text rather than
    trusting the stored summary fields — that's what makes the fix retroactive
    for runs stored before the CLARIFICATION_MARKER exclusion existed (their
    stored `hallucinated` value for a clarification case is a stale True/False
    from the old buggy judge call, and they have no `clarification` key at all)."""

    def _case(self, id, answer, hallucinated, refused=False, expected_refusal=False, error=None):
        return {
            "id": id, "query": f"query {id}", "answer": answer, "refused": refused,
            "expected_refusal": expected_refusal, "refusal_ok": refused == expected_refusal,
            "hallucinated": hallucinated, "generation_ms": 100, "error": error,
        }

    def test_old_run_without_clarification_field_is_corrected(self):
        from app.routers.goldstandard_eval import _compute_generation_stats

        gen = {
            "provider": "openai", "model": "gpt-4.1", "avg_generation_ms": 1000, "error_cases": 0,
            "cases": [
                self._case("GS-001", "Real hallucinated answer with fabricated data", hallucinated=True),
                self._case("GS-002", "Correct grounded answer", hallucinated=False),
                self._case(
                    "GS-003",
                    "Tu pregunta puede aplicar a varios programas académicos de Uniputumayo. "
                    "¿Sobre cuál programa te gustaría saber específicamente?\n\n- Ing. Sistemas",
                    hallucinated=True,  # stale verdict from the old buggy judge call
                ),
            ],
        }

        stats = _compute_generation_stats(gen)

        assert stats["judged_cases"] == 2  # GS-003 excluded, not counted as judged at all
        assert stats["hallucination_rate"] == pytest.approx(0.5)  # 1 real hallucination / 2 judged
        assert len(stats["clarification_triggered"]) == 1
        assert stats["clarification_triggered"][0]["id"] == "GS-003"
