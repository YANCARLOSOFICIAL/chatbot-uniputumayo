from pydantic import BaseModel
from uuid import UUID

from app.config import settings


class SearchFilters(BaseModel):
    program: str | None = None
    faculty: str | None = None
    document_type: str | None = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = settings.rag_top_k
    score_threshold: float = settings.rag_score_threshold
    filters: SearchFilters | None = None


class SearchResultItem(BaseModel):
    chunk_id: UUID
    content: str
    score: float
    document_title: str
    program: str | None
    faculty: str | None
    metadata: dict | None


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    query_embedding_time_ms: int
    search_time_ms: int
