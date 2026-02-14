import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, chat, rag, llm, documents, config
from app.middleware.error_handler import global_exception_handler

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title="IUP Chatbot API",
    description="API del chatbot de la Institución Universitaria del Putumayo",
    version="1.0.0",
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
