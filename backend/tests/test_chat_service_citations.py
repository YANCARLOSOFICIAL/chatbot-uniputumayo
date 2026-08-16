import uuid

import pytest

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
    def test_detects_reply_to_clarification(self, service):
        history = [
            LLMMessage(role="user", content="¿Cuáles son las materias del pensum?"),
            LLMMessage(
                role="assistant",
                content=f"{CLARIFICATION_MARKER} programas académicos de Uniputumayo...",
            ),
        ]
        is_followup, query = service._resolve_followup_query(history, "Ingeniería de Sistemas")
        assert is_followup is True
        assert query == "¿Cuáles son las materias del pensum? Ingeniería de Sistemas"

    def test_not_a_followup_when_last_turn_is_a_normal_answer(self, service):
        history = [
            LLMMessage(role="user", content="hola"),
            LLMMessage(role="assistant", content="¡Hola! ¿En qué puedo ayudarte?"),
        ]
        is_followup, query = service._resolve_followup_query(history, "materias de sistemas")
        assert is_followup is False
        assert query == "materias de sistemas"

    def test_not_a_followup_with_empty_history(self, service):
        is_followup, query = service._resolve_followup_query([], "hola")
        assert is_followup is False
        assert query == "hola"
