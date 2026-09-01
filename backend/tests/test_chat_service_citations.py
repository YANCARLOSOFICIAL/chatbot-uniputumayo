import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.providers.provider_factory import ProviderFactory
from app.schemas.chat import SourceInfo
from app.schemas.llm import LLMMessage
from app.services.chat_service import ChatService, _RAGContext
from app.utils.prompts import REFUSAL_MARKER, CLARIFICATION_MARKER


def make_rag_ctx(n_sources: int, programs: list[str | None] | None = None,
                  faculties: list[str | None] | None = None,
                  scores: list[float] | None = None, quality: str = "good") -> _RAGContext:
    programs = programs or [None] * n_sources
    faculties = faculties or [None] * n_sources
    scores = scores or [0.5] * n_sources
    source_infos = [
        SourceInfo(
            chunk_id=uuid.uuid4(),
            document_title=f"Doc {i + 1}",
            content_preview="preview",
            score=scores[i],
            program=programs[i],
            faculty=faculties[i],
            citation_number=i + 1,
        )
        for i in range(n_sources)
    ]
    sources_payload = [
        {"citation_number": i + 1, "document_title": f"Doc {i + 1}"} for i in range(n_sources)
    ]
    return _RAGContext(
        context_text="context",
        sources_payload=sources_payload,
        source_infos=source_infos,
        quality=quality,
        embed_ms=0,
        search_ms=0,
    )


@pytest.fixture
def service():
    return ChatService(db=None)


class TestFilterCitedSources:
    def test_refusal_marker_yields_zero_sources(self, service):
        rag_ctx = make_rag_ctx(3)
        payload, infos = service._filter_cited_sources(REFUSAL_MARKER, rag_ctx)
        assert payload == []
        assert infos == []

    def test_no_sources_available_yields_zero_sources(self, service):
        rag_ctx = make_rag_ctx(0)
        payload, infos = service._filter_cited_sources("Respuesta sin contexto [1]", rag_ctx)
        assert payload == []
        assert infos == []

    def test_uncited_answer_has_no_best_guess_fallback(self, service):
        rag_ctx = make_rag_ctx(3)
        payload, infos = service._filter_cited_sources("Hola, ¿en qué puedo ayudarte?", rag_ctx)
        assert payload == []
        assert infos == []

    def test_cited_sources_are_kept(self, service):
        rag_ctx = make_rag_ctx(3)
        payload, infos = service._filter_cited_sources("La respuesta está en [1] y [3].", rag_ctx)
        assert {p["citation_number"] for p in payload} == {1, 3}
        assert {i.citation_number for i in infos} == {1, 3}

    def test_out_of_range_citation_numbers_are_ignored(self, service):
        rag_ctx = make_rag_ctx(2)
        payload, infos = service._filter_cited_sources("Ver [1] y también [99].", rag_ctx)
        assert {p["citation_number"] for p in payload} == {1}

    def test_non_contiguous_citations_preserve_original_numbers(self, service):
        rag_ctx = make_rag_ctx(5)
        payload, infos = service._filter_cited_sources("Datos en [2] y [4].", rag_ctx)
        assert {p["citation_number"] for p in payload} == {2, 4}
        # Not renumbered to 1/2 by position — original citation_number is kept.
        assert all(p["citation_number"] in {2, 4} for p in payload)


class TestDetectAmbiguity:
    def test_triggers_with_two_programs_and_varying_topic(self, service):
        rag_ctx = make_rag_ctx(
            2, programs=["Ingeniería de Sistemas", "Ingeniería Agroindustrial"],
        )
        result = service._detect_ambiguity("¿Cuáles son las materias del pensum?", rag_ctx)
        assert result == ("program", ["Ingeniería Agroindustrial", "Ingeniería de Sistemas"])

    def test_does_not_trigger_for_institution_wide_topic(self, service):
        # Confirmed by the institution: admission requirements are the same
        # for every program — must NOT ask for clarification even with 2
        # distinct programs in the retrieved results.
        rag_ctx = make_rag_ctx(
            2, programs=["Ingeniería de Sistemas", "Ingeniería Agroindustrial"],
        )
        result = service._detect_ambiguity("¿Cuáles son los requisitos de admisión?", rag_ctx)
        assert result is None

    def test_does_not_trigger_when_program_already_named(self, service):
        rag_ctx = make_rag_ctx(
            2, programs=["Ingeniería de Sistemas", "Ingeniería Agroindustrial"],
        )
        result = service._detect_ambiguity(
            "¿Cuáles son las materias de Ingeniería de Sistemas?", rag_ctx
        )
        assert result is None

    def test_does_not_trigger_with_single_program(self, service):
        rag_ctx = make_rag_ctx(2, programs=["Ingeniería de Sistemas", "Ingeniería de Sistemas"])
        result = service._detect_ambiguity("¿Cuáles son las materias?", rag_ctx)
        assert result is None

    def test_weak_second_program_outside_margin_does_not_count(self, service):
        # Second program's best score (0.30) is far below the top score
        # (0.60) — outside the 0.15 margin, so it's not a real competing
        # candidate, just a weak/noisy match.
        rag_ctx = make_rag_ctx(
            2,
            programs=["Ingeniería de Sistemas", "Ingeniería Agroindustrial"],
            scores=[0.60, 0.30],
        )
        result = service._detect_ambiguity("¿Cuáles son las materias?", rag_ctx)
        assert result is None

    def test_falls_back_to_faculty_when_no_program_ambiguity(self, service):
        rag_ctx = make_rag_ctx(
            2,
            programs=["Ingeniería de Sistemas", "Ingeniería de Sistemas"],
            faculties=["Facultad de Ingeniería", "Facultad de Ciencias de la Salud"],
        )
        result = service._detect_ambiguity("¿Cuál es la misión?", rag_ctx)
        assert result == ("faculty", ["Facultad de Ciencias de la Salud", "Facultad de Ingeniería"])

    def test_no_ambiguity_when_no_sources(self, service):
        rag_ctx = make_rag_ctx(0)
        result = service._detect_ambiguity("¿Cuáles son las materias?", rag_ctx)
        assert result is None

    def test_named_program_suppresses_faculty_ambiguity_from_unrelated_top_score(self, service):
        # Real incident (2026-08-15 GoldStandard eval, GS-025): the query
        # already names its program exactly ("Gestión Pública") and the
        # program-level check correctly finds no ambiguity — but an
        # unrelated program from a different faculty (Ingeniería de
        # Sistemas) still scored within the margin of the top match, purely
        # from this embedding model's known score-compression behavior.
        # Nobody phrases a question naming a faculty, so the old
        # faculty-level check fired anyway. A query that already named an
        # exact program has nothing left to clarify.
        rag_ctx = make_rag_ctx(
            2,
            programs=["Gestión Pública", "Ingeniería de Sistemas"],
            faculties=["Ciencias Administrativas y Económicas", "Ingeniería"],
            scores=[0.711, 0.663],
        )
        result = service._detect_ambiguity(
            "¿Qué asignaturas incluye la Tecnología en Gestión Pública?", rag_ctx
        )
        assert result is None

    def test_faculty_ambiguity_still_fires_when_no_program_named(self, service):
        # Same shape as test_falls_back_to_faculty_when_no_program_ambiguity
        # (same program on both sources, so the program-level check never
        # fires) but the query doesn't name that program either — the
        # faculty-level fallback should still work for its genuine use case.
        rag_ctx = make_rag_ctx(
            2,
            programs=["Gestión Pública", "Gestión Pública"],
            faculties=["Ciencias Administrativas y Económicas", "Ingeniería"],
            scores=[0.711, 0.663],
        )
        result = service._detect_ambiguity("¿Qué asignaturas hay disponibles?", rag_ctx)
        assert result == ("faculty", ["Ciencias Administrativas y Económicas", "Ingeniería"])

    def test_does_not_trigger_when_quality_is_weak(self, service):
        # Real incident (2026-08-08 GoldStandard eval): a thinly-indexed
        # program ("Tecnología en Desarrollo de Software") retrieves only
        # weak/noisy matches spread across several UNRELATED programs —
        # quality="weak" (top score below rag_score_threshold). Without this
        # gate, the margin check below still sees ">=2 candidates within
        # margin of the top score" (everything is equally mediocre) and asks
        # a nonsensical "which program?" instead of admitting the retrieval
        # just didn't find anything good.
        rag_ctx = make_rag_ctx(
            2,
            programs=["Ingeniería de Sistemas", "Ingeniería Agroindustrial"],
            scores=[0.30, 0.28],
            quality="weak",
        )
        result = service._detect_ambiguity("¿Cuáles son las materias del pensum?", rag_ctx)
        assert result is None


class TestResolveFollowupQuery:
    @pytest.fixture
    def conv_id(self):
        return uuid.uuid4()

    @pytest.mark.asyncio
    async def test_detects_reply_to_clarification(self, service, conv_id):
        history = [
            LLMMessage(role="user", content="¿Cuáles son las materias del pensum?"),
            LLMMessage(
                role="assistant",
                content=f"{CLARIFICATION_MARKER} programas académicos de Uniputumayo...",
            ),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "Ingeniería de Sistemas", "ollama", conv_id
        )
        assert is_followup is True
        assert query == "¿Cuáles son las materias del pensum? Ingeniería de Sistemas"

    @pytest.mark.asyncio
    async def test_not_a_followup_when_last_turn_is_a_normal_answer(self, service, monkeypatch, conv_id):
        monkeypatch.setattr(service, "_get_known_programs", AsyncMock(return_value=[]))
        monkeypatch.setattr(service, "_get_program_aliases", AsyncMock(return_value={}))
        history = [
            LLMMessage(role="user", content="hola"),
            LLMMessage(role="assistant", content="¡Hola! ¿En qué puedo ayudarte?"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "materias de sistemas", "ollama", conv_id
        )
        assert is_followup is False
        assert query == "materias de sistemas"

    @pytest.mark.asyncio
    async def test_not_a_followup_with_empty_history(self, service, conv_id):
        is_followup, query = await service._resolve_followup_query([], "hola", "ollama", conv_id)
        assert is_followup is False
        assert query == "hola"

    @pytest.mark.asyncio
    async def test_carries_forward_program_named_in_an_earlier_turn(self, service, monkeypatch, conv_id):
        # Real bug found live 2026-08-31: "primer semestre de Tecnología en
        # Desarrollo de Software" then "ahora dime las de tercer semestre" —
        # the second question alone names no program, so bare retrieval on
        # "tercer semestre" matched noisily across every program's curriculum
        # instead of staying on the one the conversation was already about.
        # provider="ollama" exercises the entity-heuristic fallback directly
        # (no LLM condensation call to mock).
        monkeypatch.setattr(service, "_get_known_programs", AsyncMock(return_value=["ingenieria de sistemas"]))
        monkeypatch.setattr(
            service, "_get_program_aliases",
            AsyncMock(return_value={"tecnologia en desarrollo de software": "ingenieria de sistemas"}),
        )
        history = [
            LLMMessage(role="user", content="¿Qué asignaturas se ven en primer semestre de Tecnología en Desarrollo de Software?"),
            LLMMessage(role="assistant", content="En primer semestre se ven... [1]"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "ahora dime las de tercer semestre", "ollama", conv_id
        )
        assert is_followup is True
        assert query.startswith("¿Qué asignaturas se ven en primer semestre de Tecnología en Desarrollo de Software?")
        assert query.endswith("ahora dime las de tercer semestre")

    @pytest.mark.asyncio
    async def test_current_message_already_naming_a_program_is_not_a_followup(self, service, monkeypatch, conv_id):
        monkeypatch.setattr(service, "_get_known_programs", AsyncMock(return_value=["ingenieria civil"]))
        monkeypatch.setattr(service, "_get_program_aliases", AsyncMock(return_value={}))
        history = [
            LLMMessage(role="user", content="¿Qué materias tiene Ingeniería de Sistemas?"),
            LLMMessage(role="assistant", content="Tiene... [1]"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "¿y las materias de Ingeniería Civil?", "ollama", conv_id
        )
        assert is_followup is False
        assert query == "¿y las materias de Ingeniería Civil?"

    @pytest.mark.asyncio
    async def test_institution_wide_followup_is_not_contaminated_with_a_program_name(
        self, service, monkeypatch, conv_id,
    ):
        # is_varying_topic_query gate: "requisitos de admisión" is
        # institution-wide, so it must never get a stray program name
        # prepended even though an earlier turn named one — that could make
        # _detect_program_filter wrongly hard-filter to a single program.
        get_programs = AsyncMock(return_value=["ingenieria de sistemas"])
        monkeypatch.setattr(service, "_get_known_programs", get_programs)
        monkeypatch.setattr(service, "_get_program_aliases", AsyncMock(return_value={}))
        history = [
            LLMMessage(role="user", content="¿Qué materias tiene Ingeniería de Sistemas?"),
            LLMMessage(role="assistant", content="Tiene... [1]"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "¿y los requisitos de admisión?", "ollama", conv_id
        )
        assert is_followup is False
        assert query == "¿y los requisitos de admisión?"
        get_programs.assert_not_called()

    @pytest.mark.asyncio
    async def test_openai_condenses_a_non_program_followup(self, service, monkeypatch, conv_id):
        # The real gap the entity-heuristic can never close: "¿y los
        # costos?" names no program, so strategy #3 alone would never carry
        # context forward for it — only an LLM that actually reads the
        # history can. provider="openai" routes here instead of the
        # heuristic, matching the Conversational-Retrieval-Chain pattern.
        fake_provider = AsyncMock()
        fake_provider.generate = AsyncMock(return_value={"content": (
            '{"needs_rewrite": true, "rewritten_query": '
            '"¿Cuáles son los costos de Ingeniería de Sistemas?", "confidence": "alta"}'
        )})
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: fake_provider)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=None))
        history = [
            LLMMessage(role="user", content="¿Qué materias tiene Ingeniería de Sistemas?"),
            LLMMessage(role="assistant", content="Tiene... [1]"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "¿y los costos?", "openai", conv_id
        )
        assert is_followup is True
        assert query == "¿Cuáles son los costos de Ingeniería de Sistemas?"

    @pytest.mark.asyncio
    async def test_openai_condensation_leaves_a_standalone_question_untouched(self, service, monkeypatch, conv_id):
        fake_provider = AsyncMock()
        fake_provider.generate = AsyncMock(return_value={"content": (
            '{"needs_rewrite": false, "rewritten_query": '
            '"¿Cuáles son los requisitos de admisión?", "confidence": "alta"}'
        )})
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: fake_provider)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=None))
        history = [
            LLMMessage(role="user", content="¿Qué materias tiene Ingeniería de Sistemas?"),
            LLMMessage(role="assistant", content="Tiene... [1]"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "¿Cuáles son los requisitos de admisión?", "openai", conv_id
        )
        assert is_followup is False
        assert query == "¿Cuáles son los requisitos de admisión?"

    @pytest.mark.asyncio
    async def test_openai_low_confidence_falls_back_to_program_entity_heuristic(
        self, service, monkeypatch, conv_id,
    ):
        fake_provider = AsyncMock()
        fake_provider.generate = AsyncMock(return_value={"content": (
            '{"needs_rewrite": true, "rewritten_query": '
            '"¿algo poco confiable?", "confidence": "baja"}'
        )})
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: fake_provider)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=None))
        monkeypatch.setattr(
            service, "_get_program_aliases",
            AsyncMock(return_value={"tecnologia en desarrollo de software": "ingenieria de sistemas"}),
        )
        monkeypatch.setattr(service, "_get_known_programs", AsyncMock(return_value=["ingenieria de sistemas"]))
        history = [
            LLMMessage(role="user", content="¿Qué asignaturas se ven en primer semestre de Tecnología en Desarrollo de Software?"),
            LLMMessage(role="assistant", content="En primer semestre se ven... [1]"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "ahora dime las de tercer semestre", "openai", conv_id
        )
        assert is_followup is True
        assert query.endswith("ahora dime las de tercer semestre")

    @pytest.mark.asyncio
    async def test_openai_condensation_failure_falls_back_to_program_entity_heuristic(
        self, service, monkeypatch, conv_id,
    ):
        fake_provider = AsyncMock()
        fake_provider.generate = AsyncMock(side_effect=RuntimeError("provider down"))
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: fake_provider)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=None))
        monkeypatch.setattr(
            service, "_get_program_aliases",
            AsyncMock(return_value={"tecnologia en desarrollo de software": "ingenieria de sistemas"}),
        )
        monkeypatch.setattr(service, "_get_known_programs", AsyncMock(return_value=["ingenieria de sistemas"]))
        history = [
            LLMMessage(role="user", content="¿Qué asignaturas se ven en primer semestre de Tecnología en Desarrollo de Software?"),
            LLMMessage(role="assistant", content="En primer semestre se ven... [1]"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "ahora dime las de tercer semestre", "openai", conv_id
        )
        assert is_followup is True
        assert query.endswith("ahora dime las de tercer semestre")

    @pytest.mark.asyncio
    async def test_openai_condensation_malformed_json_falls_back(self, service, monkeypatch, conv_id):
        fake_provider = AsyncMock()
        fake_provider.generate = AsyncMock(return_value={"content": "esto no es JSON"})
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: fake_provider)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=None))
        monkeypatch.setattr(service, "_get_known_programs", AsyncMock(return_value=[]))
        monkeypatch.setattr(service, "_get_program_aliases", AsyncMock(return_value={}))
        history = [
            LLMMessage(role="user", content="hola"),
            LLMMessage(role="assistant", content="¡Hola!"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "¿y los créditos?", "openai", conv_id
        )
        assert is_followup is False
        assert query == "¿y los créditos?"


def _fake_db_with_messages(messages):
    class FakeScalars:
        def all(self):
            return messages

    class FakeResult:
        def scalars(self):
            return FakeScalars()

    class FakeDB:
        async def execute(self, *args, **kwargs):
            return FakeResult()

    return FakeDB()


class TestRefreshContextSummary:
    @pytest.fixture
    def conv_id(self):
        return uuid.uuid4()

    def _messages(self, n):
        return [
            SimpleNamespace(role="user" if i % 2 == 0 else "assistant", content=f"mensaje {i}")
            for i in range(n)
        ]

    @pytest.mark.asyncio
    async def test_skips_when_nothing_fell_out_of_the_raw_window(self, service, monkeypatch, conv_id):
        # _MAX_HISTORY_MESSAGES = 10 — with 6 total messages nothing has
        # fallen out of the raw window yet, so no LLM call should happen.
        service.db = _fake_db_with_messages(self._messages(6))
        conv = SimpleNamespace(context_summary=None, summary_covers_messages=0)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=conv))
        generate = AsyncMock()
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: SimpleNamespace(generate=generate))
        await service._refresh_context_summary(conv_id)
        generate.assert_not_called()
        assert conv.context_summary is None

    @pytest.mark.asyncio
    async def test_folds_messages_that_fell_out_of_the_window(self, service, monkeypatch, conv_id):
        service.db = _fake_db_with_messages(self._messages(12))
        conv = SimpleNamespace(context_summary=None, summary_covers_messages=0)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=conv))
        fake_provider = SimpleNamespace(
            generate=AsyncMock(return_value={"content": "Resumen actualizado."})
        )
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: fake_provider)
        await service._refresh_context_summary(conv_id)
        assert conv.context_summary == "Resumen actualizado."
        assert conv.summary_covers_messages == 2  # 12 total - 10 raw window kept = 2 folded

    @pytest.mark.asyncio
    async def test_does_not_resummarize_already_covered_messages(self, service, monkeypatch, conv_id):
        service.db = _fake_db_with_messages(self._messages(12))
        conv = SimpleNamespace(context_summary="ya resumido", summary_covers_messages=2)
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=conv))
        generate = AsyncMock()
        monkeypatch.setattr(ProviderFactory, "get_provider", lambda name: SimpleNamespace(generate=generate))
        await service._refresh_context_summary(conv_id)
        generate.assert_not_called()
        assert conv.context_summary == "ya resumido"

    @pytest.mark.asyncio
    async def test_failure_is_swallowed_not_raised(self, service, monkeypatch, conv_id):
        monkeypatch.setattr(service, "get_conversation", AsyncMock(side_effect=RuntimeError("db down")))
        await service._refresh_context_summary(conv_id)  # must not raise

    @pytest.mark.asyncio
    async def test_no_conversation_found_is_a_noop(self, service, monkeypatch, conv_id):
        monkeypatch.setattr(service, "get_conversation", AsyncMock(return_value=None))
        await service._refresh_context_summary(conv_id)  # must not raise
