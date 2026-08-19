import pytest

from app.schemas.rag import SearchFilters
from app.services.chat_service import ChatService, _CICLO_TECNOLOGICO_RE
from app.utils.cache import program_alias_cache


@pytest.fixture
def service():
    svc = ChatService(db=None)
    svc._get_known_programs = _fake_known_programs
    svc._get_program_aliases = _fake_empty_aliases
    return svc


@pytest.fixture
def service_with_aliases():
    svc = ChatService(db=None)
    svc._get_known_programs = _fake_known_programs
    svc._get_program_aliases = _fake_program_aliases
    return svc


async def _fake_known_programs():
    return ["ingenieria civil", "ingenieria de sistemas", "Gestion publica"]


async def _fake_empty_aliases():
    return {}


async def _fake_program_aliases():
    # Real values parsed live from Civil/Sistemas' own "Primer ciclo de
    # formación: ..." intro text — see _get_program_aliases.
    return {
        "Tecnología en Obras Civiles": "ingenieria civil",
        "Tecnología en Desarrollo de Software": "ingenieria de sistemas",
    }


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


class TestDetectProgramFilterAliases:
    # Real incident (GoldStandard smoke test, 2026-08-17): GS-007/GS-009
    # phrase their question around the "ciclo tecnológico" name, never
    # mentioning "Ingeniería de Sistemas"/"Ingeniería Civil" at all.

    async def test_query_naming_only_the_ciclo_tecnologico_alias_still_filters(
        self, service_with_aliases
    ):
        result = await service_with_aliases._detect_program_filter(
            "¿Qué materias se cursan en el primer semestre de Tecnología en "
            "Desarrollo de Software?"
        )
        assert result == SearchFilters(program="ingenieria de sistemas")

    async def test_alias_and_canonical_name_dont_double_count_as_two_matches(
        self, service_with_aliases
    ):
        # Naming both the ciclo-tecnológico alias AND the canonical program
        # in the same question must still resolve to ONE program, not be
        # treated as two distinct matches (which would fall back to
        # unfiltered search).
        result = await service_with_aliases._detect_program_filter(
            "¿Qué materias tiene Ingeniería Civil, articulada con Tecnología "
            "en Obras Civiles, en su primer semestre?"
        )
        assert result == SearchFilters(program="ingenieria civil")

    async def test_alias_matching_two_different_programs_is_unfiltered(
        self, service_with_aliases
    ):
        result = await service_with_aliases._detect_program_filter(
            "¿Cuántos créditos tiene Tecnología en Obras Civiles comparado "
            "con Tecnología en Desarrollo de Software?"
        )
        assert result is None


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDB:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, query):
        return _FakeResult(self._rows)


class TestGetProgramAliasesQuery:
    # Real incident (2026-08-17): _get_program_aliases originally restricted
    # its query to `DocumentChunk.chunk_index == 0`. The same session's
    # `_enrich_curriculum_text` input-budget fix (4000->20000 chars) made the
    # generated "RESUMEN DE MATERIAS POR SEMESTRE" summary long enough to
    # span 2-3 chunks once prepended to the document (see
    # document_service.py's _build_enriched_text), pushing the "Primer ciclo
    # de formación" intro line out of chunk 0 for every reindexed curriculum
    # document. A GoldStandard smoke test re-run kept failing GS-007/GS-009
    # even after this alias logic had deployed, tracing back to this. The
    # fix removed the chunk_index filter entirely — these tests guard
    # against reintroducing any chunk-position assumption.

    def setup_method(self):
        program_alias_cache.invalidate_all()

    async def test_alias_found_when_intro_line_is_not_in_first_chunk(self):
        rows = [
            (
                "ingenieria de sistemas",
                "=== RESUMEN DE MATERIAS POR SEMESTRE ===\nSEMESTRE 1: ...",
            ),
            (
                "ingenieria de sistemas",
                "SEMESTRE 6: ...\n=== FIN DEL RESUMEN ===\n\nDatos generales del programa...",
            ),
            (
                "ingenieria de sistemas",
                "Primer ciclo de formación: Tecnología en Desarrollo de Software "
                "— Semestres I a VI — 85 créditos académicos.",
            ),
        ]
        svc = ChatService(db=_FakeDB(rows))
        aliases = await svc._get_program_aliases()
        assert aliases == {"Tecnología en Desarrollo de Software": "ingenieria de sistemas"}

    async def test_program_without_ciclo_propedeutico_contributes_no_alias(self):
        rows = [
            ("contaduria publica", "=== RESUMEN DE MATERIAS POR SEMESTRE ===\nSEMESTRE 1: ..."),
            ("contaduria publica", "Programa académico: Contaduría Pública. Total de créditos: 160."),
        ]
        svc = ChatService(db=_FakeDB(rows))
        aliases = await svc._get_program_aliases()
        assert aliases == {}


class TestCicloTecnologicoRegex:
    # Real text pulled from prod (Civil, Sistemas) after this session's
    # earlier document_service.py fix regenerated their full "Datos
    # generales del programa" intro.

    def test_matches_parenthesis_style_civil(self):
        text = (
            "Primer ciclo de formación: Tecnología en Obras Civiles "
            "(Semestres I a VI) — 97 créditos."
        )
        m = _CICLO_TECNOLOGICO_RE.search(text)
        assert m and m.group(1).strip() == "Tecnología en Obras Civiles"

    def test_matches_em_dash_style_sistemas(self):
        text = (
            "Primer ciclo de formación: Tecnología en Desarrollo de Software "
            "— Semestres I a VI — 85 créditos académicos."
        )
        m = _CICLO_TECNOLOGICO_RE.search(text)
        assert m and m.group(1).strip() == "Tecnología en Desarrollo de Software"

    def test_no_match_for_program_without_ciclo_propedeutico(self):
        # Contaduría/Gastronomía-style documents have no such split — must
        # not produce a false alias.
        text = "Programa académico: Contaduría Pública. Total de créditos: 160."
        assert _CICLO_TECNOLOGICO_RE.search(text) is None
