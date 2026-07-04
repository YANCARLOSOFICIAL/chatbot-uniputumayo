"""Singleton rate limiter for the FastAPI app (slowapi / limits).

Usage in routers:
    from app.utils.rate_limit import limiter
    from fastapi import Request

    @router.post("/endpoint")
    @limiter.limit("10/minute")
    async def handler(request: Request, ...):
        ...

The key function reads X-Forwarded-For (production behind nginx), then
falls back to the raw client IP.
"""
from fastapi import Request
from slowapi import Limiter

from app.config import settings


def _client_ip(request: Request) -> str:
    """Return the real client IP, honoring X-Forwarded-For from nginx.

    nginx sets this header with `$proxy_add_x_forwarded_for`, which APPENDS
    the real connecting IP to whatever X-Forwarded-For the client already
    sent — it does not replace it. That means the FIRST entry in the header
    is attacker-controlled (a client can send its own fake
    "X-Forwarded-For: 1.2.3.4" and nginx turns it into
    "1.2.3.4, <real ip>"). The trustworthy value is the entry added by our
    own reverse proxy, which is `trusted_proxy_count` hops from the end of
    the chain — with a single nginx hop (the default) that's the last entry.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            index = max(len(parts) - settings.trusted_proxy_count, 0)
            return parts[index]
    if request.client:
        return request.client.host
    return "unknown"


limiter = Limiter(key_func=_client_ip)
