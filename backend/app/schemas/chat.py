from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID

_MAX_MESSAGE_LEN = 4_000   # chars — prevents token abuse
_VALID_INPUT_TYPES = {"text", "voice"}


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
    llm_model: str | None = None   # Modelo específico elegido por el usuario en la UI

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("El mensaje no puede estar vacío")
        if len(stripped) > _MAX_MESSAGE_LEN:
            raise ValueError(
                f"El mensaje no puede superar los {_MAX_MESSAGE_LEN} caracteres"
            )
        return stripped

    @field_validator("input_type")
    @classmethod
    def valid_input_type(cls, v: str) -> str:
        if v not in _VALID_INPUT_TYPES:
            raise ValueError(f"input_type debe ser uno de: {_VALID_INPUT_TYPES}")
        return v


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


class ConversationUpdate(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("El título no puede estar vacío")
        return stripped[:100]


class ChatResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse
    sources: list[SourceInfo]
