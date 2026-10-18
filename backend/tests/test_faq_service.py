import uuid

import pytest

from app.config import settings
from app.models.faq_entry import FaqEntry
from app.services.faq_service import FaqService

# The FAQ decision step (FaqService.pick) is pure: given candidates sorted by
# similarity it returns a hit, a suggestion, or nothing. These tests pin the
# thresholds and the reuse of the answer cache's entity/semester guards.


def _entry(question, program=None, faculty=None):
    return FaqEntry(
        id=uuid.uuid4(), question=question, answer="respuesta oficial",
        program=program, faculty=faculty, is_enabled=True,
    )


@pytest.fixture(autouse=True)
def thresholds(monkeypatch):
    monkeypatch.setattr(settings, "faq_enabled", True)
    monkeypatch.setattr(settings, "faq_similarity_threshold", 0.90)
    monkeypatch.setattr(settings, "faq_suggest_threshold", 0.80)


class TestPick:
    def test_high_similarity_is_a_hit(self):
        e = _entry("¿Cuáles son los requisitos de grado?")
        out = FaqService.pick([(e, 0.95)], "qué necesito para graduarme")
        assert out.hit is not None and out.hit.entry is e
        assert out.hit.similarity == 0.95
        assert out.suggestion is None

    def test_medium_similarity_is_only_a_suggestion(self):
        e = _entry("¿Cuáles son los requisitos de grado?")
        out = FaqService.pick([(e, 0.85)], "requisitos para el diploma")
        assert out.hit is None
        assert out.suggestion is not None and out.suggestion.entry is e

    def test_low_similarity_is_nothing(self):
        e = _entry("¿Cuáles son los requisitos de grado?")
        out = FaqService.pick([(e, 0.70)], "cuánto cuesta la matrícula")
        assert out.hit is None and out.suggestion is None

    def test_empty_candidates(self):
        out = FaqService.pick([], "hola")
        assert out.hit is None and out.suggestion is None

    def test_exact_threshold_counts_as_hit(self):
        e = _entry("¿Cuánto cuesta la inscripción?")
        out = FaqService.pick([(e, 0.90)], "cuánto vale la inscripción")
        assert out.hit is not None

    def test_program_guard_rejects_other_program_and_falls_back_to_suggestion(self):
        # Same phrasing, different program: the cache's entity guard must
        # block the auto-answer; the entry is still offered as a suggestion.
        e = _entry("¿Cuántos créditos tiene Ingeniería de Sistemas?", program="ingenieria de sistemas")
        out = FaqService.pick([(e, 0.96)], "cuántos créditos tiene ingeniería ambiental")
        assert out.hit is None
        assert out.suggestion is not None and out.suggestion.entry is e

    def test_program_guard_passes_when_query_names_the_program(self):
        e = _entry("¿Cuántos créditos tiene Ingeniería de Sistemas?", program="ingenieria de sistemas")
        out = FaqService.pick([(e, 0.96)], "créditos de ingeniería de sistemas")
        assert out.hit is not None

    def test_program_guard_requires_the_whole_program_name(self):
        # "ingeniería" alone must not be enough — it is shared by every
        # engineering program (the answer cache's one-word overlap would pass).
        e = _entry("¿Cuántos créditos tiene Ingeniería de Sistemas?", program="ingenieria de sistemas")
        out = FaqService.pick([(e, 0.96)], "cuántos créditos tiene ingeniería")
        assert out.hit is None and out.suggestion is not None

    def test_program_guard_accepts_ciclo_tecnologico_alias(self):
        e = _entry("¿En qué sedes se ofrece Ingeniería de Sistemas?", program="ingenieria de sistemas")
        aliases = {"Tecnología en Desarrollo de Software": "ingenieria de sistemas"}
        out = FaqService.pick([(e, 0.92)], "sedes de tecnología en desarrollo de software", aliases)
        assert out.hit is not None

    def test_unscoped_entry_matches_paraphrase_without_shared_words(self):
        # No program/faculty on the entry → no entity to guard, and
        # source_document is deliberately NOT used as a title fallback.
        e = _entry("¿Cuáles son los requisitos de grado?")
        e.source_document = "ESTATUTO ESTUDIANTIL 2025"
        out = FaqService.pick([(e, 0.93)], "qué necesito para graduarme")
        assert out.hit is not None

    def test_semester_guard_rejects_different_semester(self):
        e = _entry("¿Qué materias tiene el primer semestre de Ingeniería de Sistemas?")
        out = FaqService.pick([(e, 0.93)], "qué materias tiene el tercer semestre de ingeniería de sistemas")
        assert out.hit is None
        assert out.suggestion is not None

    def test_second_candidate_can_win_when_first_is_guarded_out(self):
        first = _entry("¿Cuánto cuesta la matrícula de Contaduría?", program="contaduria publica")
        second = _entry("¿Cuánto cuesta la matrícula de Ingeniería de Sistemas?", program="ingenieria de sistemas")
        out = FaqService.pick(
            [(first, 0.95), (second, 0.94)], "cuánto cuesta la matrícula de ingeniería de sistemas",
        )
        assert out.hit is not None and out.hit.entry is second

    def test_disabled_feature_short_circuits_match(self, monkeypatch):
        monkeypatch.setattr(settings, "faq_enabled", False)
        # pick() itself still works (pure), but match() must not touch the DB.
        service = FaqService(db=None)

        import asyncio
        out = asyncio.run(service.match([0.1] * 4, "pregunta"))
        assert out.hit is None and out.suggestion is None
