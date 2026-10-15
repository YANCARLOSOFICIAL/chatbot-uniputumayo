"""Singleton rate limiter for the FastAPI app (slowapi / limits).

Usage in routers:
    from app.utils.rate_limit import limiter
    from fastapi import Request

    @router.post("/endpoint")
    @limiter.limit("10/minute")
    async def handler(request: Request, ...):
        ...

The key function resolves the real client IP behind our reverse
proxies (nginx, plus an outer proxy/Cloudflare in production), then falls
back to the raw peer IP. Each distinct IP gets its own slowapi bucket —
a wrong resolution collapses all users into one shared counter (429s).
"""
from fastapi import Request
from slowapi import Limiter

from app.config import settings


def _first_valid_ip(value: str | None) -> str | None:
    """Return the first non-empty IP-like token in a header value."""
    if not value:
        return None
    for part in value.split(","):
        part = part.strip()
        if part and part.lower() != "unknown":
            return part
    return None


def _peer_is_private(request: Request) -> bool:
    """True si la conexión TCP viene de red privada/proxy local."""
    host = (request.client.host if request.client else "") or ""
    return (
        host.startswith("10.")
        or host.startswith("192.168.")
        or host.startswith("172.16.")
        or host.startswith("172.17.")
        or host.startswith("172.18.")
        or host.startswith("172.19.")
        or host.startswith("172.2")
        or host.startswith("172.3")
        or host in ("127.0.0.1", "::1")
        or host.startswith("10.")
    )


def _client_ip(request: Request) -> str:
    """Return the real client IP, honoring our proxy chain.

    Priority (first hit wins):

    1. ``CF-Connecting-IP`` / ``True-Client-IP`` — SOLO si el peer es un
        proxy privado de confianza. Si se confían incondicionalmente, un
        atacante con conexión directa rota la IP por request y bypasea
        todos los límites (login/register/forgot).
    2. ``X-Forwarded-For`` — every proxy APPENDS (``$proxy_add_x_forwarded_for``),
       it never replaces. A client can therefore inject a fake first entry
       (``"1.2.3.4"`` becomes ``"1.2.3.4, <real ip>"``), so the trustworthy
       value is ``trusted_proxy_count`` hops from the END of the chain:
       dev (single nginx) = 1, prod (outer proxy + nginx) = 2.
    3. ``X-Real-IP`` (set by our nginx to its ``$remote_addr``) and finally
       the TCP peer IP.
    """
    # Solo confiar en headers seteados por el edge si el peer es proxy privado.
    # Conexión directa desde internet pública => ignorarlos (spoof trivial).
    if _peer_is_private(request):
        for header in ("CF-Connecting-IP", "True-Client-IP"):
            ip = _first_valid_ip(request.headers.get(header))
            if ip:
                return ip
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [
            p.strip()
            for p in forwarded.split(",")
            if p.strip() and p.strip().lower() != "unknown"
        ]
        if parts:
            index = max(len(parts) - settings.trusted_proxy_count, 0)
            return parts[index]
    real_ip = _first_valid_ip(request.headers.get("X-Real-IP"))
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "unknown"


limiter = Limiter(key_func=_client_ip)
