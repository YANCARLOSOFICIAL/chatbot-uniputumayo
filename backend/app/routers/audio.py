import asyncio
import logging
import os
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice: str = "es-CO-SalomeNeural"


@router.post("/tts", response_class=Response)
async def text_to_speech(body: TTSRequest):
    """Generate speech audio from text using Microsoft Edge TTS neural voices."""
    try:
        import edge_tts
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Servicio TTS no disponible. Instala edge-tts.",
        )

    try:
        communicate = edge_tts.Communicate(body.text, voice=body.voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]

        if not audio_data:
            raise HTTPException(status_code=500, detail="No se generó audio")

        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-cache"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en TTS: {e}")
        raise HTTPException(status_code=500, detail=f"Error generando audio: {str(e)}")


def _get_whisper_model():
    """Lazy singleton for the Whisper model (loaded once on first STT request)."""
    if not hasattr(_get_whisper_model, "_model"):
        try:
            from faster_whisper import WhisperModel

            logger.info("Cargando modelo Whisper 'tiny'...")
            _get_whisper_model._model = WhisperModel(
                "tiny", device="cpu", compute_type="int8"
            )
            logger.info("Modelo Whisper cargado correctamente")
        except ImportError:
            _get_whisper_model._model = None
    return _get_whisper_model._model


@router.post("/stt")
async def speech_to_text(audio: UploadFile = File(...)):
    """Transcribe audio to text using Whisper (cross-browser STT fallback)."""
    model = _get_whisper_model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Servicio STT no disponible. Instala faster-whisper.",
        )

    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio vacío")

        content_type = audio.content_type or ""
        suffix = ".webm" if "webm" in content_type else ".ogg"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            loop = asyncio.get_event_loop()

            def do_transcribe():
                segments_gen, _ = model.transcribe(temp_path, language="es")
                return " ".join(s.text.strip() for s in segments_gen)

            transcript = await loop.run_in_executor(None, do_transcribe)
        finally:
            os.unlink(temp_path)

        return {"transcript": transcript.strip()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en STT: {e}")
        raise HTTPException(status_code=500, detail=f"Error transcribiendo audio: {str(e)}")
