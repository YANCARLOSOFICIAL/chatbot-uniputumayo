"""Text-to-speech for voice mode, with a fallback engine.

Primary engine: Microsoft Edge neural voices through `edge-tts` — free, good
Colombian Spanish (es-CO-SalomeNeural), but an UNOFFICIAL endpoint: Microsoft
changes its anti-abuse token now and then and every request starts failing
with 403 until the library is updated. Confirmed live 2026-10-18: production
had been answering every /audio/tts call with "403 Invalid response status"
— voice mode transcribed the user fine (Whisper) and then never spoke.

Fallback engine: OpenAI TTS (`gpt-4o-mini-tts`), using the same API key the
chat already uses. Paid (~US$0.015 per 1 000 characters), but official and
stable — a demo in front of the jury must not depend on an unofficial
endpoint being up that day.

After one edge-tts failure the primary is skipped for `tts_edge_cooldown_
seconds`, so a broken day does not add a failed 1-2 s attempt in front of
every sentence; it is retried once the cooldown expires.
"""
import asyncio
import logging
import time

from app.config import settings
from app.runtime_config import runtime_config

logger = logging.getLogger(__name__)


class TTSUnavailable(Exception):
    """No engine could produce audio (callers answer 503)."""


_edge_disabled_until = 0.0


def reset_circuit() -> None:
    """Re-enable edge-tts immediately (tests, admin)."""
    global _edge_disabled_until
    _edge_disabled_until = 0.0


async def _edge(text: str, voice: str) -> bytes:
    import edge_tts

    data = b""
    async for chunk in edge_tts.Communicate(text, voice=voice).stream():
        if chunk["type"] == "audio":
            data += chunk["data"]
    if not data:
        raise RuntimeError("edge-tts returned no audio")
    return data


async def _openai(text: str) -> bytes:
    if not runtime_config.openai_api_key:
        raise TTSUnavailable("OpenAI no está configurado (clave API ausente)")
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=runtime_config.openai_api_key, max_retries=2)
    response = await client.audio.speech.create(
        model=settings.openai_tts_model,
        voice=settings.openai_tts_voice,
        input=text,
        response_format="mp3",
    )
    data = response.content
    if not data:
        raise RuntimeError("OpenAI TTS returned no audio")
    return data


async def synthesize(text: str, voice: str) -> tuple[bytes, str]:
    """Return (mp3 bytes, engine name). Raises TTSUnavailable when neither
    engine can speak."""
    global _edge_disabled_until
    now = time.monotonic()
    if now >= _edge_disabled_until:
        try:
            audio = await asyncio.wait_for(_edge(text, voice), timeout=settings.tts_edge_timeout_seconds)
            return audio, "edge"
        except Exception as e:
            _edge_disabled_until = now + settings.tts_edge_cooldown_seconds
            logger.warning(
                "edge-tts failed (%s: %s) — switching to OpenAI TTS for %d s",
                type(e).__name__, str(e)[:160], settings.tts_edge_cooldown_seconds,
            )
    if not settings.tts_fallback_enabled:
        raise TTSUnavailable("edge-tts no disponible y el respaldo está desactivado")
    try:
        return await _openai(text), "openai"
    except TTSUnavailable:
        raise
    except Exception as e:
        logger.error("OpenAI TTS failed: %s: %s", type(e).__name__, e)
        raise TTSUnavailable(f"OpenAI TTS: {type(e).__name__}") from e
