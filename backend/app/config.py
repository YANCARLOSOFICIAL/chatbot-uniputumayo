from pydantic_settings import BaseSettings
from typing import Optional

# Modelos OpenAI disponibles para selección desde la UI (verificados mayo 2026)
OPENAI_CHAT_MODELS: list[str] = [
    "gpt-5.4-mini",  # Recomendado: eficiente, $0.75/1M tokens, 400 K ctx
    "gpt-5.4",       # Mayor calidad, $2.50/1M tokens
    "gpt-5.5",       # Flagship, $5/1M tokens
    "gpt-4.1-mini",  # Generación anterior eficiente
    "gpt-4.1",       # Generación anterior completo
]

# Palabras clave para excluir modelos de embedding del selector de chat en Ollama
OLLAMA_EMBEDDING_KEYWORDS: tuple[str, ...] = ("embed", "all-minilm", "bge", "e5-")


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://chatbot_user:chatbot_password@localhost:5433/chatbot_db"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    # qwen3:8b — 5.2 GB, 40 K ctx, razonamiento avanzado. Funciona en local (16 GB) y servidor (64 GB)
    ollama_default_model: str = "qwen3:8b"
    ollama_embedding_model: str = "nomic-embed-text"
    # gemma4:e4b — 7.2 GB, 128 K ctx, texto + imagen + audio. Óptimo para extracción de PDFs
    ollama_vision_model: str = "gemma4:e4b"

    # OpenAI
    openai_api_key: Optional[str] = None
    # gpt-5.4-mini — modelo eficiente más reciente (mayo 2026), 400 K ctx, $0.75/1M tokens input
    openai_default_model: str = "gpt-5.4-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    # LLM Configuration
    default_llm_provider: str = "ollama"
    default_temperature: float = 0.05   # Casi determinista para respuestas RAG factuales
    default_max_tokens: int = 2048
    # Provider de respaldo si el primario no responde (ej: "openai" si ollama falla)
    llm_fallback_provider: str = ""

    # RAG Configuration
    chunk_size: int = 512
    chunk_overlap: int = 77
    rag_top_k: int = 5
    # nomic-embed-text en docs español puntúa ~0.4-0.65; 0.35 captura lo relevante
    rag_score_threshold: float = 0.35
    # Candidatos = top_k × multiplier, luego se filtran por diversidad
    rag_candidates_multiplier: int = 3
    # HyDE: embeder respuesta hipotética en vez de query cruda mejora retrieval
    rag_hyde_enabled: bool = True
    # Diversidad: máximo 2 chunks por documento fuente para evitar respuestas repetitivas
    rag_diversity_enabled: bool = True
    # NO cambiar embedding_provider sin migrar la dimensión del vector en pgvector
    embedding_provider: str = "ollama"
    # nomic-embed-text=768 | text-embedding-3-small=1536
    embedding_dimensions: int = 768

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Document Upload
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"

    # Auth / JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    admin_email: str = "admin@iup.edu.co"
    admin_password: str = "admin123"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
