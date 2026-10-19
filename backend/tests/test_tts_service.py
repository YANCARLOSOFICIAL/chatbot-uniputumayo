import pytest

from app.config import settings
from app.runtime_config import runtime_config
from app.services import tts_service

# Live 2026-10-18: every /audio/tts call failed with "403 Invalid response
# status" from Microsoft's unofficial endpoint, so voice mode transcribed the
# user and then never spoke. The service now falls back to OpenAI TTS and
# skips edge-tts for a cooldown after a failure.

_REAL_OPENAI = tts_service._openai


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    tts_service.reset_circuit()
    monkeypatch.setattr(settings, "tts_fallback_enabled", True)
    monkeypatch.setattr(settings, "tts_edge_cooldown_seconds", 600)
    monkeypatch.setattr(settings, "tts_edge_timeout_seconds", 2.0)
    monkeypatch.setattr(runtime_config, "openai_api_key", "sk-test")
    yield
    tts_service.reset_circuit()


def _wire(monkeypatch, edge_ok=True, openai_ok=True):
    calls = {"edge": 0, "openai": 0}

    async def fake_edge(text, voice):
        calls["edge"] += 1
        if not edge_ok:
            raise RuntimeError("403, message='Invalid response status'")
        return b"EDGE"

    async def fake_openai(text):
        calls["openai"] += 1
        if not openai_ok:
            raise RuntimeError("boom")
        return b"OPENAI"

    monkeypatch.setattr(tts_service, "_edge", fake_edge)
    monkeypatch.setattr(tts_service, "_openai", fake_openai)
    return calls


class TestSynthesize:
    async def test_edge_first_when_it_works(self, monkeypatch):
        calls = _wire(monkeypatch)
        audio, engine = await tts_service.synthesize("hola", "es-CO-SalomeNeural")
        assert (audio, engine) == (b"EDGE", "edge")
        assert calls == {"edge": 1, "openai": 0}

    async def test_falls_back_to_openai_and_opens_the_circuit(self, monkeypatch):
        calls = _wire(monkeypatch, edge_ok=False)
        audio, engine = await tts_service.synthesize("hola", "es-CO-SalomeNeural")
        assert (audio, engine) == (b"OPENAI", "openai")
        # Within the cooldown edge-tts is not even tried again.
        await tts_service.synthesize("otra frase", "es-CO-SalomeNeural")
        assert calls == {"edge": 1, "openai": 2}

    async def test_edge_is_retried_once_the_circuit_is_reset(self, monkeypatch):
        _wire(monkeypatch, edge_ok=False)
        await tts_service.synthesize("hola", "es-CO-SalomeNeural")
        tts_service.reset_circuit()
        calls = _wire(monkeypatch, edge_ok=True)
        _, engine = await tts_service.synthesize("hola", "es-CO-SalomeNeural")
        assert engine == "edge" and calls == {"edge": 1, "openai": 0}

    async def test_unavailable_when_fallback_disabled(self, monkeypatch):
        _wire(monkeypatch, edge_ok=False)
        monkeypatch.setattr(settings, "tts_fallback_enabled", False)
        with pytest.raises(tts_service.TTSUnavailable):
            await tts_service.synthesize("hola", "es-CO-SalomeNeural")

    async def test_unavailable_when_both_fail(self, monkeypatch):
        _wire(monkeypatch, edge_ok=False, openai_ok=False)
        with pytest.raises(tts_service.TTSUnavailable):
            await tts_service.synthesize("hola", "es-CO-SalomeNeural")

    async def test_unavailable_without_openai_key(self, monkeypatch):
        _wire(monkeypatch, edge_ok=False)
        monkeypatch.setattr(tts_service, "_openai", _REAL_OPENAI)
        monkeypatch.setattr(runtime_config, "openai_api_key", None)
        with pytest.raises(tts_service.TTSUnavailable):
            await tts_service.synthesize("hola", "es-CO-SalomeNeural")
