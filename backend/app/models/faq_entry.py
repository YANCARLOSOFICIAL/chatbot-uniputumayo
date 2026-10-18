import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.database import Base
from app.config import settings


class FaqEntry(Base):
    """A curated frequently-asked question with its official answer.

    Written by an admin, not by the LLM. `embedding` is the answer-cache
    embedding (embeddinggemma, see ChatService._embed_query) of `question`,
    computed once on save so a user question can be matched against every
    FAQ with a single pgvector query and zero extra model calls. NULL when
    Ollama was unreachable at save time — the entry is still shown on the
    public FAQ page, it just can't auto-answer until it is re-indexed.
    """

    __tablename__ = "faq_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Free text: which official document backs the answer ("Estatuto
    # Estudiantil 2025, art. 12", "Tríptico oferta 2026-2"). Shown to users.
    source_document: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Free text: period the answer is valid for ("2026-2", "hasta dic 2026").
    valid_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Optional scoping used by the entity guard (same semantics as
    # documents.program / documents.faculty): when set, a user question that
    # doesn't name this program/faculty is NOT auto-answered with this FAQ.
    program: Mapped[str | None] = mapped_column(String(255), nullable=True)
    faculty: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    embedding = mapped_column(Vector(settings.faq_embedding_dimensions), nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # How many user questions this FAQ answered directly (analytics).
    hit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
