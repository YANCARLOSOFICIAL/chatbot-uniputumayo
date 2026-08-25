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
        self.calls: list[dict] = []

    async def generate(self, **kwargs):
        self.call_count += 1
        self.calls.append(kwargs)
        if self._remaining_failures > 0:
            self._remaining_failures -= 1
            raise _rate_limit_error()
        return {"content": self._verdict}


# Rate-limit retry-on-429 for OpenAI calls (originally hand-rolled here to
# fix 5/77 judge calls silently excluded by a 429 in the 2026-08-05 prod
# run) moved into `OpenAIProvider` itself on 2026-08-22, so every OpenAI
# call site (this judge, verification grading, chat generation) shares one
# pacing budget and retry policy instead of three uncoordinated ones — see
# tests/test_openai_provider.py's `test_generate_retries_once_on_rate_limit_
# then_succeeds` / `test_generate_raises_after_exhausting_rate_limit_retries`
# for the equivalent coverage, now at the provider level.


async def _noop():
    return None


class TestJudgeHallucinationContextSizing:
    """Real bug found via GoldStandard eval 2026-08-21 (case GS-007): a flat
    3000-char cap on the judge's context silently dropped the one chunk (of
    up to rag_top_k=10) an answer was actually grounded in whenever it
    wasn't among the first ~2 — verified live: the answer's course codes
    (TD101, TD102, TD103, TD104, COM01, INST01) all exist verbatim in the
    real corpus, in a chunk ranked 4th. The cap must scale with
    chunk_size * rag_top_k, same as verification_graph.py's grader."""

    @pytest.mark.asyncio
    async def test_context_beyond_old_3000_char_cap_reaches_the_judge(self, monkeypatch):
        from app.config import settings

        marker = "MARCADOR_DESPUES_DE_3000_CHARS"
        padding = "x" * 3500
        context = f"{padding}{marker}"
        assert len(context) > 3000
        assert len(context) < settings.chunk_size * 4 * settings.rag_top_k

        provider = FakeRateLimitedProvider(failures_before_success=0, verdict="NO")
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: provider)

        await _judge_hallucination("openai", "gpt-4.1", "query", context, "answer")

        assert provider.calls and marker in provider.calls[0]["messages"][0]["content"]


class TestJudgeHallucinationUsesIndependentGrader:
    """Self-judging was the original design (see module docstring) but proved
    both unreliable and biased the Ollama-vs-OpenAI comparison — see
    resolve_grader's docstring in verification_graph.py. When OpenAI is
    configured, judging must route there regardless of which provider
    generated the answer being judged."""

    @pytest.mark.asyncio
    async def test_routes_to_openai_even_when_judging_an_ollama_answer(self, monkeypatch):
        from app.runtime_config import runtime_config

        monkeypatch.setattr(runtime_config, "openai_api_key", "sk-real-key")
        monkeypatch.setattr(runtime_config, "openai_default_model", "gpt-5.4-mini")

        requested_names = []

        def get_provider(name):
            requested_names.append(name)
            return FakeRateLimitedProvider(failures_before_success=0, verdict="NO")

        monkeypatch.setattr(ProviderFactory, "get_provider", get_provider)

        await _judge_hallucination("ollama", "qwen2.5:7b", "query", "context", "answer")

        assert requested_names == ["openai"]

    @pytest.mark.asyncio
    async def test_falls_back_to_self_when_openai_not_configured(self, monkeypatch):
        from app.runtime_config import runtime_config

        monkeypatch.setattr(runtime_config, "openai_api_key", None)

        requested_names = []

        def get_provider(name):
            requested_names.append(name)
            return FakeRateLimitedProvider(failures_before_success=0, verdict="NO")

        monkeypatch.setattr(ProviderFactory, "get_provider", get_provider)

        await _judge_hallucination("ollama", "qwen2.5:7b", "query", "context", "answer")

        assert requested_names == ["ollama"]


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

        result = await _run_generation_case(fake_db, q, "openai", "gpt-4.1")

        assert called is False, "the judge must never be called for a clarification reply"
        assert result.clarification is True
        assert result.refused is False
        assert result.hallucinated is None


class TestJudgeUsesActualChatContext:
    """Real bug found live 2026-08-20: the judge was scoring answers against
    goldstandard_eval_service's own separate retrieval pass (fixed k, HyDE
    pinned to "openai"), not the context chat_service.process_message()
    actually fed the LLM (production top_k, HyDE tied to the live admin
    default provider) — those two can diverge, and manual review of a real
    run's "hallucinated" cases showed well-grounded answers being misjudged
    because the judge was reading different context than the model saw.
    _run_generation_case must judge against ChatService.last_rag_context_text."""

    @pytest.mark.asyncio
    async def test_judges_against_chat_service_last_rag_context_not_a_separate_pass(self, monkeypatch):
        from app.services.goldstandard_eval_service import _run_generation_case

        real_answer = "El programa tiene 10 semestres [1]."
        actual_chat_context = "[1] Malla real\nEl programa tiene 10 semestres."

        async def fake_process_message(self, *args, **kwargs):
            self.last_rag_context_text = actual_chat_context
            return SimpleNamespace(assistant_message=SimpleNamespace(content=real_answer))

        monkeypatch.setattr(
            "app.services.goldstandard_eval_service.ChatService.process_message",
            fake_process_message,
        )

        seen_context = None

        async def capture_judge(provider_name, model, query, context, answer):
            nonlocal seen_context
            seen_context = context
            return False

        monkeypatch.setattr(
            "app.services.goldstandard_eval_service._judge_hallucination", capture_judge,
        )

        fake_db = SimpleNamespace(add=lambda *_: None, flush=_noop)
        q = GoldQuery(
            id="GS-006", category="c", query="¿Cuántos semestres tiene X?",
            query_type="dentro de alcance", expected_documents=["07_x"],
        )

        result = await _run_generation_case(fake_db, q, "openai", "gpt-4.1")

        assert seen_context == actual_chat_context
        assert result.hallucinated is False


class TestJudgeContextNarrowedToCitedSources:
    """Real false positives found live 2026-08-25 (GS-004, GS-084 from the
    2026-08-23 run): the eval's judge graded against the FULL retrieved
    context (all chunks, un-narrowed), while verification_graph._grade (the
    production safety net) narrows to only the draft's cited [N] blocks —
    manual re-check confirmed the flagged answers WERE grounded in their
    cited chunk, but the full context (multiple large chunks) risked
    truncating past it under the judge's char budget. _run_generation_case
    must narrow the judge's context the same way production's grader does."""

    @pytest.mark.asyncio
    async def test_judge_receives_only_the_cited_chunk_not_the_full_context(self, monkeypatch):
        from app.services.goldstandard_eval_service import _run_generation_case

        real_answer = "El programa tiene 10 semestres [2]."
        full_context = (
            "[1] Documento irrelevante\nContenido que no tiene nada que ver con la pregunta."
            "\n\n---\n\n"
            "[2] Malla real\nEl programa tiene 10 semestres."
        )

        async def fake_process_message(self, *args, **kwargs):
            self.last_rag_context_text = full_context
            return SimpleNamespace(assistant_message=SimpleNamespace(content=real_answer))

        monkeypatch.setattr(
            "app.services.goldstandard_eval_service.ChatService.process_message",
            fake_process_message,
        )

        seen_context = None

        async def capture_judge(provider_name, model, query, context, answer):
            nonlocal seen_context
            seen_context = context
            return False

        monkeypatch.setattr(
            "app.services.goldstandard_eval_service._judge_hallucination", capture_judge,
        )

        fake_db = SimpleNamespace(add=lambda *_: None, flush=_noop)
        q = GoldQuery(
            id="GS-006", category="c", query="¿Cuántos semestres tiene X?",
            query_type="dentro de alcance", expected_documents=["07_x"],
        )

        await _run_generation_case(fake_db, q, "openai", "gpt-4.1")

        assert seen_context == "[2] Malla real\nEl programa tiene 10 semestres."
        assert "Documento irrelevante" not in seen_context


class TestRagQualityPropagatesToGenerationCaseResult:
    """Real bug found live 2026-08-24: a refused case with no verification_reason
    could mean two different things — retrieval came back weak/empty (zero LLM
    calls) or the LLM had good context and self-refused anyway (REFUSAL_MARKER
    short-circuit in verification_graph._grade approves without ever grading,
    leaving grade_reason=None too) — and the stored eval data couldn't tell them
    apart. _run_generation_case must carry ChatService.last_rag_quality through
    so the report can split the two."""

    @pytest.mark.asyncio
    async def test_carries_last_rag_quality_into_result(self, monkeypatch):
        from app.services.goldstandard_eval_service import _run_generation_case
        from app.utils.prompts import REFUSAL_MARKER

        async def fake_process_message(self, *args, **kwargs):
            self.last_rag_quality = "good"
            return SimpleNamespace(assistant_message=SimpleNamespace(content=REFUSAL_MARKER))

        monkeypatch.setattr(
            "app.services.goldstandard_eval_service.ChatService.process_message",
            fake_process_message,
        )

        fake_db = SimpleNamespace(add=lambda *_: None, flush=_noop)
        q = GoldQuery(
            id="GS-063", category="c", query="¿Cuál es el perfil profesional del Ingeniero Civil?",
            query_type="dentro de alcance", expected_documents=["01_x"],
        )

        result = await _run_generation_case(fake_db, q, "openai", "gpt-4.1")

        assert result.refused is True
        assert result.rag_quality == "good"


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
