from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


def _clean(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class FaqBase(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    answer: str = Field(..., min_length=5, max_length=8000)
    category: str | None = Field(None, max_length=100)
    source_document: str | None = Field(None, max_length=255)
    valid_period: str | None = Field(None, max_length=100)
    program: str | None = Field(None, max_length=255)
    faculty: str | None = Field(None, max_length=255)
    is_enabled: bool = True
    sort_order: int = Field(0, ge=0, le=10000)

    @field_validator("question", "answer")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Debe tener al menos 5 caracteres")
        return v

    @field_validator("category", "source_document", "valid_period", "program", "faculty")
    @classmethod
    def _strip_optional(cls, v: str | None) -> str | None:
        return _clean(v)


class FaqCreate(FaqBase):
    pass


class FaqUpdate(BaseModel):
    question: str | None = Field(None, min_length=5, max_length=500)
    answer: str | None = Field(None, min_length=5, max_length=8000)
    category: str | None = Field(None, max_length=100)
    source_document: str | None = Field(None, max_length=255)
    valid_period: str | None = Field(None, max_length=100)
    program: str | None = Field(None, max_length=255)
    faculty: str | None = Field(None, max_length=255)
    is_enabled: bool | None = None
    sort_order: int | None = Field(None, ge=0, le=10000)

    @field_validator("question", "answer")
    @classmethod
    def _strip_required(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Debe tener al menos 5 caracteres")
        return v

    @field_validator("category", "source_document", "valid_period", "program", "faculty")
    @classmethod
    def _strip_optional(cls, v: str | None) -> str | None:
        return _clean(v)


class FaqPublic(BaseModel):
    """What guests see on the FAQ page and in chat — never the embedding."""
    id: UUID
    question: str
    answer: str
    category: str | None
    source_document: str | None
    valid_period: str | None
    sort_order: int

    model_config = {"from_attributes": True}


class FaqAdmin(FaqPublic):
    program: str | None
    faculty: str | None
    is_enabled: bool
    hit_count: int
    # True when the question has an embedding and can auto-answer; False
    # means Ollama was down at save time — use the "reindexar" action.
    indexed: bool
    embedding_model: str | None
    created_at: datetime
    updated_at: datetime


class FaqImportItem(FaqBase):
    pass


class FaqImportRequest(BaseModel):
    entries: list[FaqImportItem] = Field(..., min_length=1, max_length=200)
    # When True, an entry whose question already exists (case-insensitive)
    # is skipped instead of duplicated.
    skip_duplicates: bool = True


class FaqImportResult(BaseModel):
    created: int
    skipped: int
    not_indexed: int


class FaqReindexResult(BaseModel):
    indexed: int
    failed: int


class FaqMatchCandidate(BaseModel):
    id: UUID
    question: str
    similarity: float
    guards_pass: bool
    lexical_subset: bool


class FaqMatchTest(BaseModel):
    """What the chat would do with this question — admin tuning tool."""
    query: str
    embedding_ok: bool
    decision: str                     # "hit" | "suggestion" | "none"
    matched_id: UUID | None = None
    matched_question: str | None = None
    similarity: float | None = None
    candidates: list[FaqMatchCandidate]
    judge_used: bool
    judge_choice: int | None = None
    judge_error: str | None = None
    thresholds: dict[str, float]


class FaqSuggestion(BaseModel):
    """A related FAQ offered to the user when their question was close to,
    but not confidently the same as, a curated one (see
    settings.faq_suggest_threshold)."""
    id: UUID
    question: str
    similarity: float
