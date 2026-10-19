import uuid

import pytest

from app.schemas.llm import LLMMessage
from app.schemas.rag import SearchFilters
from app.services.chat_service import ChatService

# Live 2026-10-18: "Competencias específicas ingeniería de sistemas", asked
# after two turns about one course of that program, was rewritten by the
# follow-up condenser into a question about that course and refused — while
# the same message asked alone answered every time. A message that names
# exactly one program and a program-varying topic is standalone by
# construction and must skip condensation.


@pytest.fixture
def service():
    return ChatService(db=None)


def _history():
    return [
        LLMMessage(role="user", content="Cuántos créditos tiene Aplicación de las Matemáticas y Física en ingeniería de sistemas"),
        LLMMessage(role="assistant", content="Tiene 2 créditos académicos."),
    ]


def _wire(service, program):
    calls = {"condense": 0, "distill": []}

    async def fake_detect(query):
        return SearchFilters(program=program) if program else None

    async def fake_condense(history, content, conversation_id):
        calls["condense"] += 1
        return "¿Cuáles son las competencias de Aplicación de las Matemáticas y Física?"

    async def fake_distill(content, provider_name):
        calls["distill"].append(content)
        return content

    service._detect_program_filter = fake_detect
    service._condense_followup_query = fake_condense
    service._distill_query = fake_distill
    return calls


class TestStandaloneProgramMessage:
    async def test_skips_condensation_when_message_names_a_program(self, service):
        calls = _wire(service, "ingenieria de sistemas")
        is_followup, query = await service._resolve_followup_query(
            _history(), "Competencias específicas ingeniería de sistemas", "openai", uuid.uuid4(),
        )
        assert is_followup is False
        assert query == "Competencias específicas ingeniería de sistemas"
        assert calls["condense"] == 0
        assert calls["distill"] == ["Competencias específicas ingeniería de sistemas"]

    async def test_still_condenses_when_no_program_is_named(self, service):
        calls = _wire(service, None)
        is_followup, query = await service._resolve_followup_query(
            _history(), "y cuántas horas tiene?", "openai", uuid.uuid4(),
        )
        assert is_followup is True
        assert calls["condense"] == 1
        assert query.startswith("¿Cuáles son las competencias")

    async def test_clarification_reply_still_wins(self, service):
        from app.utils.prompts import CLARIFICATION_MARKER
        calls = _wire(service, "ingenieria de sistemas")
        history = [
            LLMMessage(role="user", content="qué materias tiene el segundo semestre?"),
            LLMMessage(role="assistant", content=f"{CLARIFICATION_MARKER} ¿Sobre cuál programa?"),
        ]
        is_followup, query = await service._resolve_followup_query(
            history, "ingeniería de sistemas", "openai", uuid.uuid4(),
        )
        assert is_followup is True
        assert query == "qué materias tiene el segundo semestre? ingeniería de sistemas"
        assert calls["condense"] == 0
