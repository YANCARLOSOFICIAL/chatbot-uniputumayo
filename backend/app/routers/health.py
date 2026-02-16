import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.schemas.common import HealthResponse, HealthServiceStatus

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    services = {}

    # Check database
    try:
        start = time.time()
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        latency = round((time.time() - start) * 1000, 1)
        services["database"] = HealthServiceStatus(status="healthy", latency_ms=latency)
    except Exception:
        services["database"] = HealthServiceStatus(status="unhealthy")

    # Check Ollama
    try:
        start = time.time()
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            latency = round((time.time() - start) * 1000, 1)
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                services["ollama"] = HealthServiceStatus(status="healthy", latency_ms=latency)
            else:
                services["ollama"] = HealthServiceStatus(status="unhealthy")
    except Exception:
        services["ollama"] = HealthServiceStatus(status="unhealthy")

    overall = "healthy" if all(
        s.status == "healthy" for s in services.values()
    ) else "degraded"

    return HealthResponse(
        status=overall,
        services=services,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
