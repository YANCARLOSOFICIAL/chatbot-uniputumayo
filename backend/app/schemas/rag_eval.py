from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class RagEvalCaseResult(BaseModel):
    id: str
    query: str
    passed: bool
    retrieval_quality: str
    retrieval_top_score: float
    retrieval_ms: int
    sources_cited: int
    generation_ms: int
    answer: str
    notes: list[str]


class RagEvalRunSummary(BaseModel):
    """Lightweight row for the run-history list — no case details."""
    id: UUID
    status: str
    created_at: datetime
    completed_at: datetime | None
    passed: int | None
    total: int | None
    avg_retrieval_ms: float | None
    avg_generation_ms: float | None

    model_config = {"from_attributes": True}


class RagEvalRunDetail(RagEvalRunSummary):
    results: list[RagEvalCaseResult] | None
    error_message: str | None

    model_config = {"from_attributes": True}
