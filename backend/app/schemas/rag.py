from pydantic import BaseModel
from uuid import UUID

from app.config import settings


class SearchFilters(BaseModel):
    program: str | None = None
    faculty: str | None = None
    document_type: str | None = None
    # Opposite of `document_type` (include-only): excludes one document_type
    # instead of restricting to it. Added for administrative/regulatory
    # queries ("aplazamiento", "causales de pérdida de calidad...") getting
    # buried under every curriculum document's "=== RESUMEN DE MATERIAS POR
    # SEMESTRE ===" boilerplate (all document_type='pensum') just for
    # sharing the word "semestre" — see ChatService._is_administrative_query.
    exclude_document_type: str | None = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = settings.rag_top_k
    score_threshold: float = settings.rag_score_threshold
    filters: SearchFilters | None = None
    # Overrides which provider `RAGService.search()` uses to decide/perform
    # HyDE, instead of reading the live `runtime_config.default_llm_provider`.
    # None (default) preserves normal chat behavior (HyDE follows whichever
    # provider is currently active in /admin/config). Callers that need
    # retrieval-quality results to stay stable regardless of the live admin
    # setting (e.g. the GoldStandard eval, which computes retrieval once and
    # compares it against multiple generation providers) should pass a fixed
    # value explicitly.
    hyde_provider_override: str | None = None


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
