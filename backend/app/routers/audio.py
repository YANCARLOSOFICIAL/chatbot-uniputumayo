import asyncio
import logging
import os
import re
import tempfile

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, field_validator

from app.services import tts_service
from app.utils.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

_ALLOWED_VOICES = {
    "es-CO-SalomeNeural",
    "es-CO-GonzaloNeural",
    "es-MX-DaliaNeural",
    "es-ES-ElviraNeural",
}
_MAX_TTS_CHARS = 2000
_MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB para STT


class TTSRequest(BaseModel):
    text: str
    voice: str = "es-CO-SalomeNeural"

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Texto vacío")
        if len(v) > _MAX_TTS_CHARS:
            raise ValueError(f"Texto demasiado largo (máx {_MAX_TTS_CHARS} caracteres)")
        return v

    @field_validator("voice")
    @classmethod
    def validate_voice(cls, v: str) -> str:
        if v not in _ALLOWED_VOICES:
            raise ValueError("Voz no permitida")
        return v


@router.post("/tts", response_class=Response)
@limiter.limit("60/minute")
async def text_to_speech(request: Request, body: TTSRequest):
    """Generate speech audio from text — Edge neural voices with an OpenAI
    TTS fallback (see app/services/tts_service.py). The `X-TTS-Engine`
    header says which one answered."""
    try:
        audio_data, engine = await tts_service.synthesize(body.text, body.voice)
    except tts_service.TTSUnavailable as e:
        raise HTTPException(status_code=503, detail=f"Servicio de voz no disponible: {e}")
    return Response(
        content=audio_data,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache", "X-TTS-Engine": engine},
    )


# Whisper "hallucinates" these on silence/noise/very short clips — they are
# YouTube-subtitle credits from its training data, not what the user said.
# A transcript that is only one of them is treated as "no speech", otherwise
# the chat runs retrieval on it and answers "no tengo esa información" to a
# user who just said "hola" too quietly.
_WHISPER_ARTIFACT_RE = re.compile(
    r"^\W*(?:"
    r"subt[ií]tulos?\s+(?:realizados?|creados?|hechos?)\s+por.*|"
    r"subt[ií]tulos?\s+por\s+la\s+comunidad.*|"
    r".*amara\.org.*|"
    r"gracias\s+por\s+ver(?:\s+el\s+v[ií]deo)?\.?|"
    r"suscr[ií]b(?:e|a)te(?:\s+al\s+canal)?\.?|"
    r"m[uú]sica\.?|\[m[uú]sica\]|\(m[uú]sica\)|"
    r"transcripci[oó]n\s+por.*|"
    r"cc\s+por.*"
    r")\W*$",
    re.IGNORECASE,
)


def clean_transcript(text: str) -> str:
    """Drop known Whisper artifacts (see _WHISPER_ARTIFACT_RE)."""
    text = (text or "").strip()
    if not text or _WHISPER_ARTIFACT_RE.match(text):
        return ""
    return text


def _get_whisper_model():
    """Lazy singleton for the Whisper model (loaded once on first STT request)."""
    if not hasattr(_get_whisper_model, "_model"):
        try:
            from faster_whisper import WhisperModel

            # "small" trades a bit of latency for meaningfully better Spanish
            # accuracy than "tiny" — worth it since this only runs for the
            # cross-browser fallback path (native Web Speech API covers
            # Chrome/Edge and needs no server-side STT at all).
            logger.info("Cargando modelo Whisper 'small'...")
            _get_whisper_model._model = WhisperModel(
                "small", device="cpu", compute_type="int8"
            )
            logger.info("Modelo Whisper cargado correctamente")
        except ImportError:
            _get_whisper_model._model = None
    return _get_whisper_model._model


@router.post("/stt")
@limiter.limit("20/minute")
async def speech_to_text(request: Request, audio: UploadFile = File(...)):
    """Transcribe audio to text using Whisper (cross-browser STT fallback)."""
    model = _get_whisper_model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Servicio STT no disponible. Instala faster-whisper.",
        )

    try:
        # Lectura con tope (no cargar archivos gigantes a RAM)
        chunks: list[bytes] = []
        total = 0
        while True:
            piece = await audio.read(1024 * 1024)
            if not piece:
                break
            total += len(piece)
            if total > _MAX_AUDIO_BYTES:
                raise HTTPException(status_code=413, detail="Audio demasiado grande (máx 10 MB)")
            chunks.append(piece)
        audio_bytes = b"".join(chunks)
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio vacío")

        # Validar magic-bytes reales, no solo content_type del cliente
        if audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
            suffix = ".webm"
        elif audio_bytes.startswith(b"OggS"):
            suffix = ".ogg"
        elif audio_bytes.startswith(b"RIFF"):
            suffix = ".wav"
        elif audio_bytes.startswith(b"\xff\xfb") or audio_bytes.startswith(b"ID3"):
            suffix = ".mp3"
        else:
            raise HTTPException(status_code=400, detail="Formato de audio no soportado")

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            loop = asyncio.get_running_loop()

            def do_transcribe():
                segments_gen, _ = model.transcribe(temp_path, language="es")
                return " ".join(s.text.strip() for s in segments_gen)

            transcript = await loop.run_in_executor(None, do_transcribe)
        finally:
            try:
                os.unlink(temp_path)
            except OSError:
                pass

        cleaned = clean_transcript(transcript)
        if cleaned != transcript.strip():
            logger.info("STT artifact dropped: %r", transcript[:80])
        return {"transcript": cleaned}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en STT: {e}")
        raise HTTPException(status_code=500, detail=f"Error transcribiendo audio: {str(e)}")
