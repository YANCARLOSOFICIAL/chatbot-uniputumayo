from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class ConversationCreate(BaseModel):
    user_id: UUID | None = None
    title: str | None = None


class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID | None
    title: str | None
    language: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str
    input_type: str = "text"
    llm_provider: str | None = None


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    input_type: str
    tokens_used: int | None
    llm_provider: str | None
    llm_model: str | None
    response_time_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SourceInfo(BaseModel):
    chunk_id: UUID
    document_title: str
    content_preview: str
    score: float
    program: str | None
    faculty: str | None


class ChatResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse
    sources: list[SourceInfo]
