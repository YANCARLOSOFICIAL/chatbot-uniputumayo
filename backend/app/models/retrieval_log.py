import uuid
from datetime import datetime, timezone

from sqlalchemy import Text, Float, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.database import Base
from app.config import settings


class RetrievalLog(Base):
    __tablename__ = "retrieval_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    query_embedding = mapped_column(
        Vector(settings.embedding_dimensions), nullable=True
    )
    chunks_retrieved: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    top_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    retrieval_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
