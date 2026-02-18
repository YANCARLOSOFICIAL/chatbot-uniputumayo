import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.routers import health, chat, rag, llm, documents, config, auth
from app.middleware.error_handler import global_exception_handler

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def _ensure_ollama_models():
    """Pull required Ollama models if not already present."""
    models_needed = [settings.ollama_default_model, settings.ollama_embedding_model]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code != 200:
                logger.warning("Ollama no disponible, omitiendo descarga de modelos")
                return
            existing = {m["name"] for m in resp.json().get("models", [])}

        for model in models_needed:
            # Check both exact name and name:latest
            if model in existing or f"{model}:latest" in existing:
                logger.info(f"Modelo Ollama '{model}' ya disponible")
                continue
            logger.info(f"Descargando modelo Ollama '{model}'...")
            async with httpx.AsyncClient(timeout=600.0) as client:
                resp = await client.post(
                    f"{settings.ollama_base_url}/api/pull",
                    json={"name": model, "stream": False},
                )
                if resp.status_code == 200:
                    logger.info(f"Modelo '{model}' descargado correctamente")
                else:
                    logger.warning(f"Error descargando modelo '{model}': {resp.status_code}")
    except Exception as e:
        logger.warning(f"No se pudo conectar con Ollama: {e}")


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
    logger.info("Iniciando IUP Chatbot API...")
    # Seed admin user
    try:
        await _seed_admin()
    except Exception as e:
        logger.warning(f"No se pudo crear admin seed (DB no disponible?): {e}")
    # Pull models in background so it doesn't block startup/healthcheck
    import asyncio
    asyncio.create_task(_ensure_ollama_models())
    yield
    logger.info("Cerrando IUP Chatbot API...")


app = FastAPI(
    title="IUP Chatbot API",
    description="API del chatbot de la Institución Universitaria del Putumayo",
    version="1.0.0",
    lifespan=lifespan,
)

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


@app.get("/")
async def root():
    return {
        "name": "IUP Chatbot API",
        "version": "1.0.0",
        "docs": "/docs",
    }
