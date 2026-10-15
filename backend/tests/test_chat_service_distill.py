import pytest

from app.services import chat_service as chat_service_module
from app.services.chat_service import ChatService

# Live 2026-10-12: the long conversational message below was refused even
# with the multi-query retry, because its preamble ("décimo semestre",
# "terminé todas mis materias") dominates the retrieval embedding; the bare
# question retrieves the Estatuto's opciones-de-grado chunk fine. These tests
# pin the distillation gate, the output guards, and that it only ever touches
# the retrieval query of a message that is NOT a resolved follow-up.

LONG = ("Te comento estoy en decimo semestre y ya termine todas mis materias pero "
        "necesito hacer la opcion de grado, puedes decirme que opciones de grado hay?")


class _FakeProvider:
    def __init__(self, reply):
        self.reply = reply
        self.calls = 0

    async def generate(self, **kwargs):
        self.calls += 1
        return {"content": self.reply}


@pytest.fixture
def service():
    return ChatService(db=None)


def _use_provider(monkeypatch, reply):
    fake = _FakeProvider(reply)
    monkeypatch.setattr(chat_service_module.ProviderFactory, "get_provider", staticmethod(lambda name: fake))
    return fake


class TestNeedsDistillation:
    def test_long_conversational_message(self):
        assert ChatService._needs_distillation(LONG)

    def test_short_direct_question_is_left_alone(self):
        assert not ChatService._needs_distillation("¿Qué materias tiene primer semestre de Gastronomía?")

    def test_marker_triggers_even_when_short(self):
        assert ChatService._needs_distillation("hola, quiero saber los costos")


class TestDistillQuery:
    async def test_returns_model_question_for_long_message(self, service, monkeypatch):
        fake = _use_provider(monkeypatch, "Pregunta: ¿Cuáles son las opciones de grado?")
        assert await service._distill_query(LONG, "openai") == "¿Cuáles son las opciones de grado?"
        assert fake.calls == 1

    async def test_short_question_skips_the_llm(self, service, monkeypatch):
        fake = _use_provider(monkeypatch, "irrelevante")
        q = "¿Qué materias tiene primer semestre de Gastronomía?"
        assert await service._distill_query(q, "openai") == q
        assert fake.calls == 0

    async def test_ollama_skips_the_llm(self, service, monkeypatch):
        fake = _use_provider(monkeypatch, "irrelevante")
        assert await service._distill_query(LONG, "ollama") == LONG
        assert fake.calls == 0

    async def test_unusable_output_keeps_raw_message(self, service, monkeypatch):
        _use_provider(monkeypatch, "")
        assert await service._distill_query(LONG, "openai") == LONG
        _use_provider(monkeypatch, LONG + " y además otra cosa más larga todavía")
        assert await service._distill_query(LONG, "openai") == LONG

    async def test_provider_failure_keeps_raw_message(self, service, monkeypatch):
        class Boom:
            async def generate(self, **kwargs):
                raise RuntimeError("down")
        monkeypatch.setattr(chat_service_module.ProviderFactory, "get_provider", staticmethod(lambda name: Boom()))
        assert await service._distill_query(LONG, "openai") == LONG


class TestResolveFollowupUsesDistillation:
    async def test_first_message_is_distilled(self, service, monkeypatch):
        _use_provider(monkeypatch, "¿Cuáles son las opciones de grado?")
        is_followup, q = await service._resolve_followup_query([], LONG, "openai", None)
        assert (is_followup, q) == (False, "¿Cuáles son las opciones de grado?")

    async def test_first_short_message_unchanged(self, service, monkeypatch):
        fake = _use_provider(monkeypatch, "irrelevante")
        q0 = "¿Cuáles son las opciones de grado?"
        assert await service._resolve_followup_query([], q0, "openai", None) == (False, q0)
        assert fake.calls == 0
