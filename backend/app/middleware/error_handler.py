import logging
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    # Determine the request origin for CORS headers
    origin = request.headers.get("origin", "")

    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

    # Manually add CORS headers so browsers can read the error response
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response
