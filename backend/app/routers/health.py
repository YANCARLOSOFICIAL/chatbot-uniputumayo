import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.schemas.common import HealthResponse, HealthServiceStatus
from app.utils.cache import rag_cache, embedding_cache

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    services = {}

    # Database
    try:
        start = time.time()
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        latency = round((time.time() - start) * 1000, 1)
        services["database"] = HealthServiceStatus(status="healthy", latency_ms=latency)
    except Exception:
        services["database"] = HealthServiceStatus(status="unhealthy")

    # Ollama
    try:
        start = time.time()
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            latency = round((time.time() - start) * 1000, 1)
            if resp.status_code == 200:
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


@router.get("/metrics")
async def metrics(db: AsyncSession = Depends(get_db)):
    """Observable pipeline metrics: cache stats, vector index info, DB counts."""
    # Cache stats
    rag_entries = len(rag_cache._store)
    emb_entries = len(embedding_cache._store)

    # DB counts
    counts: dict = {}
    try:
        for table in ("documents", "document_chunks", "conversations", "messages"):
            row = await db.execute(text(f"SELECT COUNT(*) FROM {table}"))
            counts[table] = row.scalar()
    except Exception:
        pass

    # Vector index presence
    index_exists = False
    try:
        row = await db.execute(text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename='document_chunks' AND indexname='idx_dc_embedding_hnsw'"
        ))
        index_exists = row.scalar() is not None
    except Exception:
        pass

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cache": {
            "rag_entries": rag_entries,
            "embedding_entries": emb_entries,
        },
        "database": counts,
        "vector_index": {
            "hnsw_index_present": index_exists,
        },
    }
