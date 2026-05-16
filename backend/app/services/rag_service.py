import logging
import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.rag import SearchRequest, SearchResponse, SearchResultItem
from app.services.llm_service import LLMService
from app.schemas.llm import EmbedRequest
from app.config import settings
from app.providers.provider_factory import ProviderFactory
from app.runtime_config import runtime_config

logger = logging.getLogger(__name__)


class RAGService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── HyDE ────────────────────────────────────────────────────────────────

    async def _generate_hyde_doc(self, query: str) -> str:
        """Genera una respuesta hipotética para usar como query de embedding (HyDE).

        HyDE embeda una respuesta plausible en vez de la pregunta cruda, reduciendo
        la distancia semántica entre query y documentos almacenados.
        """
        try:
            provider_name = runtime_config.default_llm_provider
            provider = ProviderFactory.get_provider(provider_name)
            model = runtime_config.resolve_model(provider_name)

            result = await provider.generate(
                messages=[{
                    "role": "user",
                    "content": (
                        "Eres un asistente de la Institución Universitaria del Putumayo (IUP). "
                        "Responde brevemente en español como si fuera documentación oficial:\n\n"
                        f"{query}"
                    ),
                }],
                model=model,
                temperature=0.1,
                max_tokens=150,
            )
            doc = result.get("content", "").strip()
            return doc if doc else query
        except Exception as e:
            logger.debug(f"HyDE generation failed, using original query: {e}")
            return query

    # ── Diversidad ───────────────────────────────────────────────────────────

    def _apply_diversity(
        self,
        results: list[SearchResultItem],
        max_per_doc: int = 2,
        top_k: int = 5,
    ) -> list[SearchResultItem]:
        """Limita a max_per_doc chunks por documento fuente para diversificar resultados."""
        seen: dict[str, int] = {}
        filtered: list[SearchResultItem] = []
        for item in results:  # ya ordenados por score DESC
            doc = item.document_title or ""
            count = seen.get(doc, 0)
            if count < max_per_doc:
                filtered.append(item)
                seen[doc] = count + 1
            if len(filtered) >= top_k:
                break
        return filtered

    # ── Search ───────────────────────────────────────────────────────────────

    async def search(self, request: SearchRequest) -> SearchResponse:
        llm_service = LLMService()

        # 1. HyDE: embeber respuesta hipotética si está habilitado
        embed_start = time.time()
        embed_query = request.query
        if settings.rag_hyde_enabled:
            embed_query = await self._generate_hyde_doc(request.query)
            logger.debug(f"HyDE doc ({len(embed_query)} chars) generated for retrieval")

        embed_response = await llm_service.embed(EmbedRequest(texts=[embed_query]))
        query_embedding = embed_response.embeddings[0]
        embed_time = int((time.time() - embed_start) * 1000)

        # 2. Construir la búsqueda vectorial con más candidatos para filtrar después
        search_start = time.time()
        candidate_k = request.top_k * settings.rag_candidates_multiplier

        filters: list[str] = []
        params: dict = {
            "threshold": request.score_threshold,
            "top_k": candidate_k,
        }

        if request.filters:
            if request.filters.program:
                filters.append("d.program = :program")
                params["program"] = request.filters.program
            if request.filters.faculty:
                filters.append("d.faculty = :faculty")
                params["faculty"] = request.filters.faculty
            if request.filters.document_type:
                filters.append("d.document_type = :doc_type")
                params["doc_type"] = request.filters.document_type

        where_clause = " AND ".join(filters) if filters else "1=1"
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
        params["embedding"] = embedding_str

        query = text(f"""
            SELECT
                dc.id          AS chunk_id,
                dc.content,
                1 - (dc.embedding <=> CAST(:embedding AS vector)) AS score,
                d.title        AS document_title,
                d.program,
                d.faculty,
                dc.metadata
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE dc.embedding IS NOT NULL
              AND {where_clause}
            ORDER BY dc.embedding <=> CAST(:embedding AS vector)
            LIMIT :top_k
        """)

        result = await self.db.execute(query, params)
        rows = result.fetchall()
        search_time = int((time.time() - search_start) * 1000)

        # 3. Filtrar por threshold de similitud
        candidates: list[SearchResultItem] = []
        for row in rows:
            if row.score >= request.score_threshold:
                candidates.append(SearchResultItem(
                    chunk_id=row.chunk_id,
                    content=row.content,
                    score=round(row.score, 4),
                    document_title=row.document_title,
                    program=row.program,
                    faculty=row.faculty,
                    metadata=row.metadata,
                ))

        # 4. Aplicar filtro de diversidad (max N chunks por documento)
        if settings.rag_diversity_enabled and candidates:
            results = self._apply_diversity(candidates, max_per_doc=2, top_k=request.top_k)
        else:
            results = candidates[: request.top_k]

        return SearchResponse(
            results=results,
            query_embedding_time_ms=embed_time,
            search_time_ms=search_time,
        )
