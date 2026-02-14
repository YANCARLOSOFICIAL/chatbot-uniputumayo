from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.common import HealthResponse, HealthServiceStatus

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    services = {}

    # Check database
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        services["database"] = HealthServiceStatus(status="healthy")
    except Exception:
        services["database"] = HealthServiceStatus(status="unhealthy")

    overall = "healthy" if all(
        s.status == "healthy" for s in services.values()
    ) else "degraded"

    return HealthResponse(
        status=overall,
        services=services,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
