from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://chatbot_user:chatbot_password@localhost:5433/chatbot_db"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_default_model: str = "llama3.1:8b"
    ollama_embedding_model: str = "nomic-embed-text"

    # OpenAI
    openai_api_key: Optional[str] = None
    openai_default_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    # LLM Configuration
    default_llm_provider: str = "ollama"
    default_temperature: float = 0.3
    default_max_tokens: int = 1024

    # RAG Configuration
    chunk_size: int = 512
    chunk_overlap: int = 77
    rag_top_k: int = 5
    rag_score_threshold: float = 0.7
    # nomic-embed-text=768, text-embedding-3-small=1536
    embedding_dimensions: int = 768

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Document Upload
    max_upload_size_mb: int = 50
    upload_dir: str = "./uploads"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
