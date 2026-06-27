"""Singleton rate limiter for the FastAPI app (slowapi / limits).

Usage in routers:
    from app.utils.rate_limit import limiter
    from fastapi import Request

    @router.post("/endpoint")
    @limiter.limit("10/minute")
    async def handler(request: Request, ...):
        ...

The key function checks X-Forwarded-For first (production behind nginx),
then falls back to the raw client IP.
"""
from fastapi import Request
from slowapi import Limiter


def _client_ip(request: Request) -> str:
    """Return the real client IP, honoring X-Forwarded-For from nginx."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


limiter = Limiter(key_func=_client_ip)
