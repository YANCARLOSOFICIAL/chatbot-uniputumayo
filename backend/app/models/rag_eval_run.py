import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Float, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RagEvalRun(Base):
    """One run of the RAG evaluation harness (scripts/eval_rag.py / admin panel).

    `results` holds the full per-case breakdown (query, pass/fail, retrieval
    score, cited sources, answer text, failure notes) as JSONB — the admin UI
    reads it directly rather than needing a separate results table, since a
    run's case set can change over time (see eval_rag.py's CASES list).
    """
    __tablename__ = "rag_eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    status: Mapped[str] = mapped_column(String(20), default="running")  # running | completed | failed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    passed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_retrieval_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_generation_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    results: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
