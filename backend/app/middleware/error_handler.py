import logging
from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_ORIGINS = frozenset(o.strip() for o in settings.cors_origins.split(",") if o.strip())

_SAFE_MESSAGES: dict[type, str] = {
    ValueError: "Solicitud inválida.",
    PermissionError: "No tienes permiso para realizar esta acción.",
    FileNotFoundError: "Recurso no encontrado.",
    TimeoutError: "El servicio tardó demasiado en responder. Intenta de nuevo.",
}


async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)

    safe_message = _SAFE_MESSAGES.get(type(exc), "Error interno del servidor.")
    origin = request.headers.get("origin", "")

    response = JSONResponse(
        status_code=500,
        content={"detail": safe_message},
    )

    # Echo CORS headers only for whitelisted origins so browser can read the error
    if origin and origin in _ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response
