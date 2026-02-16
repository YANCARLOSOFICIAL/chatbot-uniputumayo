import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.rag import SearchRequest, SearchResponse, SearchResultItem
from app.services.llm_service import LLMService
from app.schemas.llm import EmbedRequest
from app.config import settings


class RAGService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(self, request: SearchRequest) -> SearchResponse:
        # 1. Embed the query
        embed_start = time.time()
        llm_service = LLMService()
        embed_response = await llm_service.embed(
            EmbedRequest(texts=[request.query])
        )
        query_embedding = embed_response.embeddings[0]
        embed_time = int((time.time() - embed_start) * 1000)

        # 2. Build similarity search query
        search_start = time.time()

        # Build filter conditions
        filters = []
        params = {
            "embedding": query_embedding,
            "threshold": request.score_threshold,
            "top_k": request.top_k,
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

        # Convert embedding list to PostgreSQL array format
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
        params["embedding"] = embedding_str

        query = text(f"""
            SELECT
                dc.id AS chunk_id,
                dc.content,
                1 - (dc.embedding <=> CAST(:embedding AS vector)) AS score,
                d.title AS document_title,
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

        # 3. Filter by score threshold and build results
        results = []
        for row in rows:
            if row.score >= request.score_threshold:
                results.append(
                    SearchResultItem(
                        chunk_id=row.chunk_id,
                        content=row.content,
                        score=round(row.score, 4),
                        document_title=row.document_title,
                        program=row.program,
                        faculty=row.faculty,
                        metadata=row.metadata,
                    )
                )

        return SearchResponse(
            results=results,
            query_embedding_time_ms=embed_time,
            search_time_ms=search_time,
        )
