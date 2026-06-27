import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy import select, delete as sql_delete

from app.config import settings
from app.routers import health, chat, rag, llm, documents, config, auth, audio, analytics
from app.middleware.error_handler import global_exception_handler
from app.utils.rate_limit import limiter

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def _pull_single_model(model: str) -> None:
    """Pull one Ollama model; each runs in its own task so failures are independent."""
    try:
        async with httpx.AsyncClient(timeout=1800.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/pull",
                json={"name": model, "stream": False},
            )
            if resp.status_code == 200:
                logger.info(f"Modelo '{model}' descargado correctamente")
            else:
                logger.warning(f"Error descargando modelo '{model}': {resp.status_code}")
    except Exception as e:
        logger.warning(f"No se pudo descargar '{model}': {e}")


async def _ensure_ollama_models():
    """Pull required Ollama models concurrently if not already present."""
    import asyncio

    models_needed = [
        m for m in [
            settings.ollama_default_model,
            settings.ollama_embedding_model,
            settings.ollama_vision_model,
        ] if m
    ]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code != 200:
                logger.warning("Ollama no disponible, omitiendo descarga de modelos")
                return
            existing = {m["name"] for m in resp.json().get("models", [])}
    except Exception as e:
        logger.warning(f"No se pudo conectar con Ollama: {e}")
        return

    # Launch each missing model as an independent concurrent task
    for model in models_needed:
        if model in existing or f"{model}:latest" in existing:
            logger.info(f"Modelo Ollama '{model}' ya disponible")
        else:
            logger.info(f"Descargando modelo Ollama '{model}'...")
            asyncio.create_task(_pull_single_model(model))


async def _cleanup_guest_conversations() -> None:
    """Delete guest conversations (user_id IS NULL) older than 2 hours."""
    from app.database import async_session
    from app.models.conversation import Conversation

    cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
    try:
        async with async_session() as db:
            result = await db.execute(
                sql_delete(Conversation)
                .where(Conversation.user_id.is_(None))
                .where(Conversation.created_at < cutoff)
            )
            await db.commit()
            if result.rowcount:
                logger.info("Guest cleanup: %d conversaciones huérfanas eliminadas", result.rowcount)
    except Exception as e:
        logger.warning("Guest conversation cleanup failed: %s", e)


async def _periodic_guest_cleanup() -> None:
    """Repeat guest cleanup every 2 hours as a background task."""
    while True:
        await asyncio.sleep(7200)
        await _cleanup_guest_conversations()


async def _seed_admin():
    """Create default admin user if it doesn't exist."""
    from app.database import async_session
    from app.models.user import User
    from app.auth import hash_password

    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == settings.admin_email))
        existing = result.scalar_one_or_none()
        if existing:
            logger.info(f"Admin user already exists: {settings.admin_email}")
            return
        admin = User(
            email=settings.admin_email,
            display_name="Administrador",
            password_hash=hash_password(settings.admin_password),
            role="admin",
        )
        db.add(admin)
        await db.commit()
        logger.info(f"Admin user created: {settings.admin_email}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando Nexus UniPutumayo API...")
    
    # Check provider availability
    from app.providers.openai_provider import OpenAIProvider
    from app.providers.ollama_provider import OllamaProvider
    
    openai_available = await OpenAIProvider().is_available()
    ollama_available = await OllamaProvider().is_available()
    
    logger.info(f"Provider Status: OpenAI={'✓' if openai_available else '✗'}, Ollama={'✓' if ollama_available else '✗'}")
    
    default_provider = settings.default_llm_provider
    if default_provider == "openai" and not openai_available:
        logger.warning(
            "⚠ Default provider is OpenAI but API key not configured. "
            "Configure it from /admin/config or switch to Ollama."
        )
    elif default_provider == "ollama" and not ollama_available:
        logger.warning(
            "⚠ Default provider is Ollama but not running. "
            "Start Ollama or configure OpenAI from /admin/config."
        )
    
    if not (openai_available or ollama_available):
        logger.error(
            "❌ NO LLM PROVIDERS AVAILABLE! Configure OpenAI from /admin/config or start Ollama."
        )

    # Ensure HNSW vector index exists (idempotent - safe to call on every startup)
    try:
        from app.database import async_session
        from sqlalchemy import text as sql_text
        async with async_session() as db:
            await db.execute(sql_text("""
                CREATE INDEX IF NOT EXISTS idx_dc_embedding_hnsw
                ON document_chunks
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64)
                WHERE embedding IS NOT NULL
            """))
            await db.commit()
        logger.info("HNSW index verified/created on document_chunks.embedding")
    except Exception as e:
        logger.warning("Could not ensure HNSW index (non-fatal): %s", e)

    # Seed admin user
    try:
        await _seed_admin()
    except Exception as e:
        logger.warning(f"No se pudo crear admin seed (DB no disponible?): {e}")
    # Delete orphaned guest conversations from previous sessions
    await _cleanup_guest_conversations()
    # Repeat cleanup every 2 h in background
    asyncio.create_task(_periodic_guest_cleanup())
    # Connect RAG cache to Redis if configured
    from app.utils.cache import rag_cache
    if settings.redis_url:
        await rag_cache.connect_redis(settings.redis_url)
    else:
        logger.info("REDIS_URL not set — RAG cache using in-memory store")

    # Pull models in background so it doesn't block startup/healthcheck
    asyncio.create_task(_ensure_ollama_models())
    yield
    logger.info("Cerrando Nexus UniPutumayo API...")


app = FastAPI(
    title="Nexus UniPutumayo API",
    description="API del asistente virtual Nexus de la Institución Universitaria del Putumayo",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
origins = [origin.strip() for origin in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
app.add_exception_handler(Exception, global_exception_handler)

# Routers (SOA service modules)
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(rag.router, prefix="/api/v1/rag", tags=["rag"])
app.include_router(llm.router, prefix="/api/v1/llm", tags=["llm"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(config.router, prefix="/api/v1/config", tags=["config"])
app.include_router(audio.router, prefix="/api/v1/audio", tags=["audio"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])


@app.get("/")
async def root():
    return {
        "name": "Nexus UniPutumayo API",
        "version": "1.0.0",
        "docs": "/docs",
    }
