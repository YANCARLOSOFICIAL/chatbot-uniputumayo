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

    # Answer cache: sirve respuestas completas ya generadas para preguntas con
    # significado similar (no solo texto exacto), saltándose RAG + LLM por
    # completo en un acierto. Clave en Ollama sin AVX2/GPU, donde la generación
    # es el cuello de botella real (~3-5 tok/s) — un acierto responde en el
    # tiempo de un embedding (~1-2s) en vez de minutos.
    answer_cache_enabled: bool = True
    # Modelo de embeddings dedicado para similitud de preguntas en la caché —
    # separado de `ollama_embedding_model` (nomic-embed-text), que está
    # afinado para RAG (buscar en documentos largos), no para distinguir
    # parafraseos de preguntas cortas. Medido empíricamente con pares reales
    # en español: nomic-embed-text no separaba "parafraseo profundo" (~0.58-
    # 0.69) de "pregunta distinta" (~0.51-0.55) — margen casi nulo. Con
    # embeddinggemma: "distinta" cae a ~0.35-0.37 y "parafraseo profundo" sube
    # a ~0.69-0.80 — separación real y amplia.
    answer_cache_embedding_model: str = "embeddinggemma"
    # Umbral de similitud coseno para considerar un acierto de caché (ver
    # medición arriba). 0.65 deja margen amplio por debajo del parafraseo
    # profundo más bajo medido (0.69) y muy por encima de preguntas distintas
    # (máx 0.37). Ajustar según los logs de "Answer cache HIT (similarity=...)"
    # en producción.
    answer_cache_similarity_threshold: float = 0.65
    # 30 días — es solo una red de seguridad: la invalidación real ocurre al
    # subir/borrar documentos (answer_cache.invalidate_all() en
    # document_service.py), así que un TTL largo no arriesga servir
    # respuestas desactualizadas mientras la base de conocimiento no cambie.
    answer_cache_ttl_seconds: int = 2592000
    # Subido junto con el TTL: con 30 días de vida, se acumulan más entradas
    # antes de expirar. 1000 entradas ≈ 17 MB en Redis — insignificante
    # frente al límite de 384 MB del contenedor.
    answer_cache_max_entries: int = 1000

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Number of trusted reverse-proxy hops in front of the backend (nginx = 1).
    # Used to pick the right entry in X-Forwarded-For for rate limiting —
    # nginx appends the real client IP rather than replacing the header, so
    # the trustworthy value is `trusted_proxy_count` entries from the end.
    trusted_proxy_count: int = 1

    # Document Upload
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"

    # Redis (optional — enables persistent RAG cache across restarts)
    # Set to empty string "" to use in-memory fallback
    redis_url: str = ""

    # Auth / JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    admin_email: str = "admin@iup.edu.co"
    admin_password: str = "admin123"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
