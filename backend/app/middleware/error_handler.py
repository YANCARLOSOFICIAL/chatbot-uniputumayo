import logging
from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_ORIGINS = frozenset(o.strip() for o in settings.cors_origins.split(",") if o.strip())


async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    origin = request.headers.get("origin", "")

    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

    # Only echo CORS headers for whitelisted origins so errors are readable cross-origin
    if origin and origin in _ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response
