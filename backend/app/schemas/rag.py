from pydantic import BaseModel
from uuid import UUID


class SearchFilters(BaseModel):
    program: str | None = None
    faculty: str | None = None
    document_type: str | None = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    score_threshold: float = 0.7
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
