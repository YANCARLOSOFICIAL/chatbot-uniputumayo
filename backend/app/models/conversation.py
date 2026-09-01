import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="es")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Incremental "summary buffer" memory (see chat_service.py::_refresh_context_summary)
    # — lets query condensation see the whole conversation, not just the last
    # _MAX_HISTORY_MESSAGES raw messages, at ~constant cost per turn: only the
    # messages that just fell out of the raw window get folded in, not the
    # whole conversation re-summarized from scratch every time.
    context_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # How many of this conversation's earliest messages are already folded
    # into `context_summary` — the next refresh only summarizes messages
    # after this point, keeping each refresh call's input small regardless
    # of how long the conversation has grown.
    summary_covers_messages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )
