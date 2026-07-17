import logging
import time

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.rag import SearchRequest, SearchResponse, SearchResultItem
from app.services.llm_service import LLMService
from app.schemas.llm import EmbedRequest
from app.config import settings
from app.models.retrieval_log import RetrievalLog
from app.providers.provider_factory import ProviderFactory
from app.runtime_config import runtime_config
from app.utils.cache import rag_cache
from app.utils.query_utils import keyword_score

logger = logging.getLogger(__name__)

_RERANK_WEIGHT_SEMANTIC = 0.80
_RERANK_WEIGHT_KEYWORD = 0.20


class RAGService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── HyDE ────────────────────────────────────────────────────────────────

    async def _generate_hyde_doc(self, query: str) -> str:
        """Generate a hypothetical answer to embed instead of the raw query.

        HyDE embeds a plausible response rather than the question itself, reducing
        the semantic distance between the query vector and stored document vectors.
        """
        try:
            provider_name = runtime_config.default_llm_provider
            provider = ProviderFactory.get_provider(provider_name)
            model = runtime_config.resolve_model(provider_name)

            result = await provider.generate(
                messages=[{
                    "role": "user",
                    "content": (
                        "Eres un asistente de Uniputumayo (Institución Universitaria del Putumayo). "
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
            logger.debug("HyDE generation failed, using original query: %s", e)
            return query

    # ── Diversity filter ─────────────────────────────────────────────────────

    def _apply_diversity(
        self,
        results: list[SearchResultItem],
        max_per_doc: int = 10,
        top_k: int = 5,
    ) -> list[SearchResultItem]:
        """Limit to max_per_doc chunks per source document to diversify results.

        Was 2, then 3 — too aggressive for row-aware-chunked spreadsheets/
        slide decks, which routinely produce 20-60+ chunks per document (a
        curriculum with many semesters/subjects). A question needing broad
        coverage of one such document (e.g. "todas las materias de tal
        programa") could only ever surface 2-3 of them, no matter how many
        actually scored well — confirmed live via /admin/rag-eval on a real
        uploaded curriculum.

        Bounded by top_k overall, but measured live that max_per_doc alone
        does nothing once it exceeds top_k: a 25-chunk curriculum still
        missed "séptimo"/"décimo semestre" at top_k=5 with max_per_doc as
        high as 20, because the final list is truncated to top_k before
        those lower-ranked-but-relevant chunks ever get in. Raising top_k
        (see settings.rag_top_k) alongside this is what actually fixed it —
        this alone is not a complete answer to "not enough of document X's
        chunks are showing up".
        """
        seen: dict[str, int] = {}
        filtered: list[SearchResultItem] = []
        for item in results:
            doc = item.document_title or ""
            count = seen.get(doc, 0)
            if count < max_per_doc:
                filtered.append(item)
                seen[doc] = count + 1
            if len(filtered) >= top_k:
                break
        return filtered

    # ── Keyword (full-text) search — recall widener ──────────────────────────

    async def _keyword_search(
        self,
        query: str,
        where_clause: str,
        base_params: dict,
        exclude_ids: set,
        limit: int,
    ) -> list[SearchResultItem]:
        """Postgres full-text search over chunk content.

        Catches chunks that share exact terms with the query (program names,
        codes, acronyms) but whose embedding drifted below the cosine
        threshold — pure-vector search has no way to recover these. Results
        get a baseline score (the passing threshold) rather than ts_rank_cd
        directly, since that score isn't on the same scale as cosine
        similarity; `_rerank()` differentiates them afterwards using the same
        keyword-overlap function applied to vector-sourced candidates.
        """
        params = {k: v for k, v in base_params.items() if k not in ("embedding", "top_k")}
        params["query_text"] = query
        params["limit"] = limit

        sql = text(f"""
            SELECT
                dc.id          AS chunk_id,
                dc.content,
                d.title        AS document_title,
                d.program,
                d.faculty,
                dc.metadata
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE dc.embedding IS NOT NULL
              AND {where_clause}
              AND to_tsvector('spanish', dc.content) @@ plainto_tsquery('spanish', :query_text)
            ORDER BY ts_rank_cd(to_tsvector('spanish', dc.content), plainto_tsquery('spanish', :query_text)) DESC
            LIMIT :limit
        """)
        result = await self.db.execute(sql, params)

        items: list[SearchResultItem] = []
        for row in result.fetchall():
            if row.chunk_id in exclude_ids:
                continue
            items.append(SearchResultItem(
                chunk_id=row.chunk_id,
                content=row.content,
                score=settings.rag_score_threshold,
                document_title=row.document_title,
                program=row.program,
                faculty=row.faculty,
                metadata=row.metadata,
            ))
        return items

    # ── Re-ranking ───────────────────────────────────────────────────────────

    def _rerank(
        self,
        query: str,
        results: list[SearchResultItem],
    ) -> list[SearchResultItem]:
        """Re-rank results by combining semantic score with keyword overlap.

        Uses a weighted hybrid: 80% semantic (cosine) + 20% keyword overlap.
        This promotes chunks that both semantically and lexically match the query,
        reducing false positives from pure-vector retrieval.
        """
        if not results:
            return results

        scored: list[tuple[float, SearchResultItem]] = []
        for item in results:
            kw = keyword_score(query, item.content)
            hybrid = _RERANK_WEIGHT_SEMANTIC * item.score + _RERANK_WEIGHT_KEYWORD * kw
            scored.append((hybrid, item))

        scored.sort(key=lambda x: x[0], reverse=True)
        reranked = [item for _, item in scored]

        if len(results) > 1 and reranked[0].chunk_id != results[0].chunk_id:
            logger.debug(
                "Re-ranking changed top result: '%s' → '%s'",
                results[0].document_title, reranked[0].document_title,
            )
        return reranked

    # ── Context deduplication ────────────────────────────────────────────────

    def _deduplicate(
        self, results: list[SearchResultItem]
    ) -> list[SearchResultItem]:
        """Remove near-duplicate chunks (>70% Jaccard word overlap on first 300 chars).

        Duplicate chunks waste LLM context window tokens and degrade quality
        by repeating the same information.
        """
        unique: list[SearchResultItem] = []
        seen_tokens: list[frozenset[str]] = []

        for item in results:
            tokens = frozenset(item.content[:300].lower().split())
            is_dup = False
            for seen in seen_tokens:
                intersection = tokens & seen
                union = tokens | seen
                if union and len(intersection) / len(union) > 0.70:
                    is_dup = True
                    logger.debug(
                        "Deduplicated near-duplicate chunk from '%s'",
                        item.document_title,
                    )
                    break
            if not is_dup:
                unique.append(item)
                seen_tokens.append(tokens)

        return unique

    # ── Context quality validation ────────────────────────────────────────────

    def evaluate_context_quality(self, results: list[SearchResultItem]) -> str:
        """Classify the retrieval quality for downstream prompt selection.

        The "good" cutoff mirrors settings.rag_score_threshold — the same bar
        candidates already had to clear to survive retrieval (see `search()`).
        Using a stricter, independent cutoff here previously caused chunks that
        passed retrieval (and were shown to the user as sources) to be silently
        dropped from the LLM prompt, producing false "no tengo información"
        refusals even when relevant context had been found.

        Returns:
            "none"   — no results
            "weak"   — results found but all scores below the retrieval threshold
                       (only reachable if a caller passes a lower score_threshold
                       to search() than settings.rag_score_threshold)
            "good"   — at least one result meets the retrieval threshold
        """
        if not results:
            return "none"
        top = results[0].score
        if top < settings.rag_score_threshold:
            return "weak"
        return "good"

    # ── Search ───────────────────────────────────────────────────────────────

    async def search(self, request: SearchRequest) -> SearchResponse:
        t0 = time.time()

        # HyDE — skipped when the active chat provider is Ollama: HyDE issues a
        # full extra generate() call before every non-cached search, which on
        # CPU-only Ollama roughly doubles the time to answer. On OpenAI the extra
        # call is fast/cheap enough that the retrieval-quality gain is worth it.
        hyde_active = settings.rag_hyde_enabled and runtime_config.default_llm_provider != "ollama"

        # Cache check (key = query + retrieval params). `hyde_active` (not the
        # static setting) so entries built with/without HyDE never collide.
        cache_key = rag_cache.make_key(
            query=request.query,
            top_k=request.top_k,
            threshold=request.score_threshold,
            filters=request.filters.model_dump() if request.filters else None,
            hyde=hyde_active,
        )
        cached = await rag_cache.get(cache_key)
        if cached is not None:
            logger.debug("RAG cache hit: %.60s…", request.query)
            return cached

        llm_service = LLMService()

        embed_start = time.time()
        embed_query = request.query
        if hyde_active:
            embed_query = await self._generate_hyde_doc(request.query)
            logger.debug("HyDE doc generated (%d chars)", len(embed_query))

        embed_response = await llm_service.embed(EmbedRequest(texts=[embed_query]))
        query_embedding = embed_response.embeddings[0]
        embed_time = int((time.time() - embed_start) * 1000)

        # 2. Vector search — fetch extra candidates for post-processing
        search_start = time.time()
        candidate_k = request.top_k * settings.rag_candidates_multiplier

        filters: list[str] = []
        params: dict = {
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

        sql = text(f"""
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

        result = await self.db.execute(sql, params)
        rows = result.fetchall()
        search_time = int((time.time() - search_start) * 1000)

        # 3. Apply score threshold
        candidates: list[SearchResultItem] = []
        seen_chunk_ids: set = set()
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
                seen_chunk_ids.add(row.chunk_id)

        # 3b. Full-text keyword search — widens recall beyond what cosine
        # similarity found. Pure-vector retrieval can miss chunks that share
        # exact terms (program names, codes) with the query but whose overall
        # embedding drifts below threshold. Candidates found here get a
        # baseline score (the passing threshold) so they clear the quality
        # gate below; `_rerank()` then differentiates them by actual keyword
        # overlap against the real query, same as vector-sourced candidates.
        try:
            fts_candidates = await self._keyword_search(
                request.query, where_clause, params, exclude_ids=seen_chunk_ids,
                limit=request.top_k,
            )
            for item in fts_candidates:
                candidates.append(item)
                seen_chunk_ids.add(item.chunk_id)
        except Exception as e:
            logger.debug("Full-text keyword search skipped: %s", e)

        # 4. Re-rank with keyword overlap boost
        candidates = self._rerank(request.query, candidates)

        # 5. Deduplicate near-identical chunks
        candidates = self._deduplicate(candidates)

        # 6. Diversity filter (max N chunks per document)
        if settings.rag_diversity_enabled and candidates:
            final_results = self._apply_diversity(candidates, max_per_doc=10, top_k=request.top_k)
        else:
            final_results = candidates[:request.top_k]

        total_ms = int((time.time() - t0) * 1000)
        top_score = final_results[0].score if final_results else 0.0
        quality = self.evaluate_context_quality(final_results)

        logger.info(
            "RAG | query=%.50s… | results=%d | quality=%s | top_score=%.3f | "
            "embed_ms=%d | search_ms=%d | total_ms=%d",
            request.query, len(final_results), quality, top_score,
            embed_time, search_time, total_ms,
        )

        response = SearchResponse(
            results=final_results,
            query_embedding_time_ms=embed_time,
            search_time_ms=search_time,
        )

        if final_results:
            await rag_cache.set(cache_key, response)

        # Write retrieval log — enables analytics on query patterns and RAG quality over time
        try:
            self.db.add(RetrievalLog(
                query_text=request.query[:2000],
                chunks_retrieved=[
                    {"chunk_id": str(r.chunk_id), "score": r.score, "title": r.document_title}
                    for r in final_results
                ],
                top_score=top_score if final_results else None,
                retrieval_time_ms=total_ms,
            ))
            # flush without commit — caller's transaction boundary handles the commit
            await self.db.flush()
        except Exception as log_err:
            logger.debug("Retrieval log write skipped: %s", log_err)

        return response
