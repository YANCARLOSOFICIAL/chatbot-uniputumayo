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
    # Evita que Ollama descargue el modelo de RAM tras 5 min de inactividad (default).
    # En CPU pura, recargar el modelo desde disco puede tardar minutos — con 64 GB en
    # el servidor no hay necesidad de liberar esa memoria entre consultas.
    ollama_keep_alive: str = "30m"
    # Sin este valor, Ollama usa su default (2048 tokens) para TODO el prompt —
    # system prompt + contexto RAG (hasta 5 fragmentos de 512 tokens) + historial
    # puede superarlo fácilmente, y Ollama trunca el sobrante EN SILENCIO. Con
    # OpenAI (400K ctx) esto nunca pasa, lo que hace que la misma respuesta RAG
    # "se sienta distinta" entre proveedores sin que el retrieval esté roto.
    ollama_num_ctx: int = 8192
    # qwen3:8b es un modelo híbrido de razonamiento: por defecto genera un bloque
    # <think>...</think> largo antes de la respuesta visible, y ese bloque cuenta
    # contra num_predict y el tiempo de generación real, aunque _strip_think lo
    # descarte después. Ollama soporta "think": false en /api/chat para saltarse
    # ese razonamiento en el origen — medido: una sola consulta con el modelo ya
    # cargado tardaba >300s con thinking habilitado.
    ollama_think_enabled: bool = False

    # OpenAI
    openai_api_key: Optional[str] = None
    # gpt-5.4-mini — modelo eficiente más reciente (mayo 2026), 400 K ctx, $0.75/1M tokens input
    openai_default_model: str = "gpt-5.4-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    # LLM Configuration
    default_llm_provider: str = "ollama"
    default_temperature: float = 0.05   # Casi determinista para respuestas RAG factuales
    # 2048 era excesivo para respuestas factuales típicas y, en Ollama CPU, cada
    # token extra permitido es tiempo extra de espera en el peor caso.
    default_max_tokens: int = 1024

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
    # Umbral de similitud coseno para considerar un acierto de caché.
    # 0.65 (valor original, ver medición arriba) causó colisiones reales
    # detectadas por scripts/eval_rag.py el 2026-07-10: "¿cuántos créditos
    # tiene...?" devolvió la respuesta cacheada de "¿cuál es el costo de la
    # matrícula...?" (similarity=0.721), y "segundo semestre" devolvió la de
    # "primer semestre" (similarity=0.781) — ambas caen DENTRO del rango de
    # "parafraseo profundo" (0.69-0.80) que la medición original consideró
    # seguro, porque esa medición comparó parafraseos reales contra preguntas
    # de tema totalmente distinto, no contra preguntas de MISMO tema pero
    # HECHO distinto (costo vs créditos, semestre 1 vs 2) — el caso que de
    # hecho más se repite en un chatbot universitario real. La similitud
    # coseno sola no separa limpiamente esas dos categorías; subir el umbral
    # es la mitigación disponible sin agregar un segundo guard heurístico.
    # 0.90 rechaza ambas colisiones observadas con margen y prioriza nunca
    # servir una respuesta incorrecta sobre maximizar el acierto de caché
    # (una respuesta lenta pero correcta es mejor que una rápida pero falsa).
    answer_cache_similarity_threshold: float = 0.90
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
