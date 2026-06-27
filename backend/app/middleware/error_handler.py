import logging
from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_ORIGINS = frozenset(o.strip() for o in settings.cors_origins.split(",") if o.strip())

_SAFE_RESPONSES: dict[type, tuple[int, str]] = {
    ValueError: (400, "Solicitud inválida."),
    PermissionError: (403, "No tienes permiso para realizar esta acción."),
    FileNotFoundError: (404, "Recurso no encontrado."),
    TimeoutError: (504, "El servicio tardó demasiado en responder. Intenta de nuevo."),
}


async def global_exception_handler(request: Request, exc: Exception):
    status_code, safe_message = _SAFE_RESPONSES.get(type(exc), (500, "Error interno del servidor."))

    if status_code >= 500:
        logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    else:
        logger.warning("Handled exception on %s %s: %s", request.method, request.url.path, exc)

    origin = request.headers.get("origin", "")

    response = JSONResponse(
        status_code=status_code,
        content={"detail": safe_message},
    )

    # Echo CORS headers only for whitelisted origins so browser can read the error
    if origin and origin in _ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response
