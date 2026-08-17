import pytest

from app.providers.provider_factory import ProviderFactory
from app.runtime_config import runtime_config
from app.services.document_service import DocumentService, _ENRICHMENT_INPUT_CHARS


class FakeProvider:
    def __init__(self, response_content: str):
        self._response_content = response_content
        self.calls: list[list[dict]] = []

    async def generate(self, messages, model, temperature, max_tokens):
        self.calls.append(messages)
        return {"content": self._response_content}


@pytest.fixture
def service():
    return DocumentService(db=None)


def patch_provider(monkeypatch, response_content: str) -> FakeProvider:
    # _enrich_curriculum_text imports ProviderFactory/runtime_config locally
    # (inside the function, not at module level), so patching document_service's
    # module namespace wouldn't take effect — patch the real objects instead,
    # same ones the local `from ... import` fetches at call time.
    fake = FakeProvider(response_content)
    monkeypatch.setattr(ProviderFactory, "get_provider", classmethod(lambda cls, name: fake))
    monkeypatch.setattr(runtime_config, "resolve_model", lambda provider_name: "qwen3:8b")
    return fake


async def test_enrichment_sees_text_past_old_4000_char_cap(monkeypatch, service):
    # Real incident (2026-08-17): a flat 4000-char cap here silently cut off
    # a 10-semester curriculum's input partway through Semestre 1-2, so the
    # LLM never even saw the later semesters' text — producing a resumen
    # that looked truncated even though the source document was complete.
    marker = "MARCADOR_DESPUES_DE_4000_CHARS_SEMESTRE_5"
    padding = "x" * 4500
    text = f"{padding}{marker}"
    assert len(text) > 4000

    fake = patch_provider(monkeypatch, "SEMESTRE 1: Materia A, Materia B")

    await service._enrich_curriculum_text(text)

    sent_content = fake.calls[0][0]["content"]
    assert marker in sent_content


async def test_enrichment_input_budget_is_generous_enough_for_real_curricula():
    # The two real documents that surfaced this bug (Ingeniería Civil,
    # Ingeniería de Sistemas) are both ~22,000 chars — the budget must clear
    # that comfortably, not just squeak past the old 4000-char cap.
    assert _ENRICHMENT_INPUT_CHARS >= 20000
