import pytest

from app.schemas.rag import SearchFilters
from app.services.chat_service import ChatService


@pytest.fixture
def service():
    svc = ChatService(db=None)
    svc._get_known_programs = _fake_known_programs
    return svc


async def _fake_known_programs():
    return ["ingenieria civil", "ingenieria de sistemas", "Gestion publica"]


class TestDetectProgramFilter:
    async def test_institution_wide_topic_is_never_filtered(self, service):
        # "requisitos de admisión" is the same process for every program —
        # naming one in passing must not narrow retrieval to it.
        result = await service._detect_program_filter(
            "¿Cuáles son los requisitos de admisión para Ingeniería Civil?"
        )
        assert result is None

    async def test_varying_topic_with_no_named_program_is_unfiltered(self, service):
        result = await service._detect_program_filter(
            "¿Cuáles son las materias del pensum?"
        )
        assert result is None

    async def test_varying_topic_naming_one_program_filters_to_it(self, service):
        result = await service._detect_program_filter(
            "¿Qué materias tiene el primer semestre de Ingeniería Civil?"
        )
        assert result == SearchFilters(program="ingenieria civil")

    async def test_varying_topic_naming_two_programs_is_unfiltered(self, service):
        # A genuine comparison question — filtering to either program alone
        # would silently drop the other's data.
        result = await service._detect_program_filter(
            "¿Cuál es la diferencia de créditos entre Ingeniería Civil e "
            "Ingeniería de Sistemas?"
        )
        assert result is None
