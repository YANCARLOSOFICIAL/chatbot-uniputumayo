from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class RetrievalCaseDetail(BaseModel):
    id: str
    query: str
    query_type: str
    expected_documents: list[str]
    retrieved_titles: list[str]
    precision_at_k: float | None
    recall_at_k: float | None
    reciprocal_rank: float | None
    retrieval_ms: int


class RetrievalSummaryDetail(BaseModel):
    k: int
    scored_cases: int
    mean_precision_at_k: float
    mean_recall_at_k: float
    mrr: float
    hit_rate: float
    avg_retrieval_ms: float
    cases: list[RetrievalCaseDetail]


class GenerationCaseDetail(BaseModel):
    id: str
    query: str
    answer: str
    refused: bool
    expected_refusal: bool
    refusal_ok: bool
    hallucinated: bool | None
    generation_ms: int


class GenerationSummaryDetail(BaseModel):
    provider: str
    model: str
    hallucination_rate: float
    judged_cases: int
    safe_rejection_rate: float
    refusal_cases: int
    avg_generation_ms: float
    cases: list[GenerationCaseDetail]


class GoldEvalRunSummary(BaseModel):
    id: UUID
    status: str
    k: int
    total_queries: int
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class GoldEvalRunDetail(GoldEvalRunSummary):
    results: dict | None
    error_message: str | None

    model_config = {"from_attributes": True}
