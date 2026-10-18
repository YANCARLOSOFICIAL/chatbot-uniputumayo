import uuid

import pytest

from app.config import settings
from app.models.faq_entry import FaqEntry
from app.runtime_config import runtime_config
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
    monkeypatch.setattr(settings, "faq_judge_threshold", 0.70)
    monkeypatch.setattr(settings, "faq_judge_enabled", True)
    monkeypatch.setattr(runtime_config, "openai_api_key", "sk-test")


class TestLexicalSubset:
    def test_subset_with_price_synonyms(self):
        e = _entry("¿Cuánto cuesta la inscripción en Uniputumayo?")
        assert FaqService._lexical_subset(e, "cuánto cuesta la inscripción")
        assert FaqService._lexical_subset(e, "cuánto vale la inscripción")

    def test_new_word_breaks_subset(self):
        e = _entry("¿Cuánto cuesta la inscripción en Uniputumayo?")
        assert not FaqService._lexical_subset(e, "cuánto cuesta la matrícula")

    def test_single_word_is_not_enough(self):
        e = _entry("¿Cuánto cuesta la inscripción en Uniputumayo?")
        assert not FaqService._lexical_subset(e, "inscripción")


class TestConfirmParaphrase:
    """Medium band (0.70-0.90): free lexical confirmation first, then the
    auxiliary-model judge; guards and thresholds still apply."""

    def _service(self, judge_choice=None, calls=None):
        svc = FaqService(db=None)

        async def fake_judge(query_text, entries, trace=None):
            if calls is not None:
                calls.append([e.question for e in entries])
            return judge_choice

        svc._judge = fake_judge
        return svc

    async def test_lexical_subset_confirms_without_judge(self):
        calls = []
        svc = self._service(judge_choice=None, calls=calls)
        e = _entry("¿Cuánto cuesta la inscripción en Uniputumayo?")
        out = await svc._confirm_paraphrase([(e, 0.78)], "cuánto cuesta la inscripción", None)
        assert out is not None and out.entry is e
        assert calls == []

    async def test_judge_confirms_paraphrase(self):
        calls = []
        svc = self._service(judge_choice=0, calls=calls)
        e = _entry("¿Cuáles son los medios de pago de la matrícula?")
        out = await svc._confirm_paraphrase([(e, 0.875)], "cómo puedo pagar la matrícula", None)
        assert out is not None and out.entry is e
        assert calls == [[e.question]]

    async def test_judge_rejects(self):
        svc = self._service(judge_choice=None)
        e = _entry("¿Cuánto cuesta la matrícula del ciclo tecnológico?")
        out = await svc._confirm_paraphrase([(e, 0.75)], "cuántos créditos tiene el ciclo tecnológico", None)
        assert out is None

    async def test_below_judge_threshold_is_never_sent_to_judge(self):
        calls = []
        svc = self._service(judge_choice=0, calls=calls)
        e = _entry("¿Cuánto cuesta la inscripción en Uniputumayo?")
        out = await svc._confirm_paraphrase([(e, 0.60)], "qué hay de almuerzo", None)
        assert out is None and calls == []

    async def test_guarded_out_candidates_are_excluded(self):
        calls = []
        svc = self._service(judge_choice=0, calls=calls)
        e = _entry("¿Cuántos créditos tiene Ingeniería de Sistemas?", program="ingenieria de sistemas")
        out = await svc._confirm_paraphrase([(e, 0.85)], "cuántos créditos tiene ingeniería ambiental", None)
        assert out is None and calls == []

    async def test_judge_disabled_or_no_key(self, monkeypatch):
        calls = []
        svc = self._service(judge_choice=0, calls=calls)
        e = _entry("¿Cuáles son los medios de pago de la matrícula?")
        monkeypatch.setattr(settings, "faq_judge_enabled", False)
        assert await svc._confirm_paraphrase([(e, 0.85)], "cómo puedo pagar la matrícula", None) is None
        monkeypatch.setattr(settings, "faq_judge_enabled", True)
        monkeypatch.setattr(runtime_config, "openai_api_key", None)
        assert await svc._confirm_paraphrase([(e, 0.85)], "cómo puedo pagar la matrícula", None) is None
        assert calls == []

    async def test_judge_parses_number_and_ignores_out_of_range(self, monkeypatch):
        svc = FaqService(db=None)
        answers = iter(["2", "0", "7", "La número 1."])

        class FakeProvider:
            async def generate(self, messages, model, temperature, max_tokens):
                return {"content": next(answers)}

        from app.services import faq_service as module
        monkeypatch.setattr(module.ProviderFactory, "get_provider", staticmethod(lambda name: FakeProvider()))
        entries = [_entry("¿Pregunta uno?"), _entry("¿Pregunta dos?")]
        assert await svc._judge("q", entries) == 1
        assert await svc._judge("q", entries) is None
        assert await svc._judge("q", entries) is None
        assert await svc._judge("q", entries) == 0


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
