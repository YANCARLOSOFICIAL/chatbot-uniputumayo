import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GoldEvalRun(Base):
    """One run of the GoldStandard evaluation (admin-uploaded .xlsx query bank).

    Unlike `RagEvalRun` (a small fixed set, single config), this compares two
    LLM providers on the same retrieval — `results` holds a single shared
    "retrieval" block (Precision@k/Recall@k/MRR don't depend on the answering
    LLM, only on embedding-based search — see goldstandard_eval_service.py)
    plus one "generation" block per provider (hallucination rate, safe
    rejection rate, timing — these DO depend on the answering LLM).
    """
    __tablename__ = "gold_eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    status: Mapped[str] = mapped_column(String(20), default="running")  # running | completed | failed
    k: Mapped[int] = mapped_column(Integer, default=5)
    total_queries: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
