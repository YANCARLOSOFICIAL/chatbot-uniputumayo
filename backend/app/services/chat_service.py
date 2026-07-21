import asyncio
import json
import logging
import random
import re
import time
from dataclasses import dataclass
from typing import AsyncIterator
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.document import Document
from app.schemas.chat import (
    ConversationCreate,
    MessageCreate,
    ChatResponse,
    MessageResponse,
    SourceInfo,
)
from app.services.rag_service import RAGService
from app.services.llm_service import LLMService
from app.services.verification_graph import generate_verified
from app.schemas.rag import SearchRequest
from app.schemas.llm import GenerateRequest, LLMMessage
from app.utils.prompts import build_chat_prompt, REFUSAL_MARKER, GREETING_PROMPT
from app.utils.query_utils import detect_temperature, is_greeting
from app.utils.cache import answer_cache, suggestion_cache
from app.runtime_config import runtime_config
from app.config import settings
from app.providers.provider_factory import ProviderFactory

logger = logging.getLogger(__name__)

_MAX_HISTORY_MESSAGES = 10
_MAX_HISTORY_CHARS = 600  # truncate long messages in history to save tokens

_SUGGESTION_TEMPLATES: dict[str, str] = {
    "pensum": "¿Cuáles son las materias del plan de estudios de {subject}?",
    "admision": "¿Cuáles son los requisitos de admisión para {subject}?",
    "perfil": "¿Cuál es el perfil profesional de {subject}?",
    "mision": "¿Cuál es la misión y visión de Uniputumayo?",
    "reglamento": "¿Qué establece el reglamento sobre {subject}?",
}

_SUGGESTION_FALLBACK: list[dict] = [
    {"label": "Programas académicos", "query": "¿Qué programas académicos ofrece Uniputumayo?", "document_type": None},
    {"label": "Proceso de admisión", "query": "¿Cómo es el proceso de admisión en Uniputumayo?", "document_type": None},
    {"label": "Sedes", "query": "¿Cuáles son las sedes de Uniputumayo?", "document_type": None},
    {"label": "Contacto", "query": "¿Cómo puedo contactar a Uniputumayo?", "document_type": None},
]

_SUGGESTION_CACHE_KEY = "suggested_questions"


@dataclass
class _RAGContext:
    context_text: str
    sources_payload: list[dict]
    source_infos: list[SourceInfo]
    quality: str          # "none" | "weak" | "good"
    embed_ms: int
    search_ms: int


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Conversation CRUD ────────────────────────────────────────────────────

    async def create_conversation(self, data: ConversationCreate) -> Conversation:
        conversation = Conversation(
            user_id=data.user_id,
            title=data.title or "Nueva conversación",
        )
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def list_conversations(
        self, limit: int = 20, offset: int = 0, user_id=None
    ) -> list[Conversation]:
        query = select(Conversation).where(Conversation.is_active.is_(True))
        if user_id is not None:
            query = query.where(Conversation.user_id == user_id)
        query = query.order_by(desc(Conversation.updated_at)).limit(limit).offset(offset)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_conversation(self, conversation_id: UUID) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def delete_conversation(self, conversation_id: UUID) -> bool:
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            return False
        conversation.is_active = False
        await self.db.commit()
        return True

    async def update_conversation_title(
        self, conversation_id: UUID, title: str
    ) -> Conversation | None:
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            return None
        conversation.title = title.strip()
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def get_messages(
        self, conversation_id: UUID, limit: int = 50, offset: int = 0
    ) -> list[Message]:
        result = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def get_suggested_questions(self, limit: int = 4) -> list[dict]:
        """Welcome-screen suggestions generated from what's actually indexed,
        instead of hardcoded claims that may not match the real knowledge base.

        No LLM call — cheap template substitution keyed by document_type, since
        this runs on every guest's first page load and the project targets
        modest CPU-only hardware for local inference. Cached briefly (see
        suggestion_cache) so cards don't reshuffle within a session.
        """
        cached = suggestion_cache.get(_SUGGESTION_CACHE_KEY)
        if cached is not None:
            return cached

        result = await self.db.execute(
            select(Document.title, Document.program, Document.faculty, Document.document_type)
            .where(Document.ingestion_status == "completed")
        )
        rows = result.all()

        if not rows:
            suggestions = _SUGGESTION_FALLBACK[:limit]
            suggestion_cache.set(_SUGGESTION_CACHE_KEY, suggestions)
            return suggestions

        # Dedup by (subject, type) case-insensitively — a program's pensum is
        # often split across several chunks/documents, don't suggest it twice.
        seen: set[tuple[str, str | None]] = set()
        candidates: list[tuple[str, str | None]] = []
        for title, program, faculty, doc_type in rows:
            subject = program or faculty or title
            key = (subject.lower(), doc_type)
            if key in seen:
                continue
            seen.add(key)
            candidates.append((subject, doc_type))

        random.shuffle(candidates)

        suggestions: list[dict] = []
        for subject, doc_type in candidates:
            if len(suggestions) >= limit:
                break
            template = _SUGGESTION_TEMPLATES.get(doc_type or "")
            query = template.format(subject=subject) if template else f"¿Qué información hay disponible sobre {subject}?"
            suggestions.append({"label": subject[:48], "query": query, "document_type": doc_type})

        for fallback in _SUGGESTION_FALLBACK:
            if len(suggestions) >= limit:
                break
            suggestions.append(fallback)

        suggestion_cache.set(_SUGGESTION_CACHE_KEY, suggestions)
        return suggestions

    # ── Shared pipeline helpers ──────────────────────────────────────────────

    @staticmethod
    def _empty_rag_ctx() -> _RAGContext:
        """Placeholder context for messages that skip RAG entirely (greetings)."""
        return _RAGContext(
            context_text="", sources_payload=[], source_infos=[],
            quality="none", embed_ms=0, search_ms=0,
        )

    async def _run_rag(self, query: str) -> _RAGContext:
        """Run RAG search and return structured context ready for prompt building."""
        rag_service = RAGService(self.db)
        search_results = await rag_service.search(SearchRequest(query=query))
        quality = rag_service.evaluate_context_quality(search_results.results)

        # Numbered so the LLM can cite which fragment(s) it actually used
        # (see _SYSTEM_WITH_CONTEXT) — _filter_cited_sources() below then
        # trims sources_payload/source_infos down to only what was cited.
        context_text = "\n\n---\n\n".join(
            f"[{i + 1}] {r.document_title}\n{r.content}"
            for i, r in enumerate(search_results.results)
        )

        sources_payload = [
            {
                "chunk_id": str(r.chunk_id),
                "document_title": r.document_title,
                "content_preview": r.content[:200],
                "score": r.score,
                "program": r.program,
                "faculty": r.faculty,
                "citation_number": i + 1,
            }
            for i, r in enumerate(search_results.results)
        ]

        source_infos = [
            SourceInfo(
                chunk_id=r.chunk_id,
                document_title=r.document_title or "Documento Uniputumayo",
                content_preview=r.content[:200],
                score=r.score,
                program=r.program,
                faculty=r.faculty,
                citation_number=i + 1,
            )
            for i, r in enumerate(search_results.results)
        ]

        return _RAGContext(
            context_text=context_text,
            sources_payload=sources_payload,
            source_infos=source_infos,
            quality=quality,
            embed_ms=search_results.query_embedding_time_ms,
            search_ms=search_results.search_time_ms,
        )

    _CITATION_RE = re.compile(r"\[(\d{1,2})\]")

    def _filter_cited_sources(
        self, content: str, rag_ctx: "_RAGContext"
    ) -> tuple[list[dict], list[SourceInfo]]:
        """Keep only the sources the LLM actually cited (`[N]` markers) in `content`.

        `quality != "good"` is handled by the caller (context was never given
        to the LLM, so nothing could have been cited from it). Here, quality
        is already "good" (context WAS retrieved and passed above threshold),
        but the model may still correctly refuse if that context doesn't
        actually answer the question — that refusal must show zero sources
        too, not fall back to the retrieved list.

        No "uncited → show best-guess source anyway" fallback: an uncited
        answer means the model didn't use the retrieved context at all — e.g.
        a plain greeting/chit-chat reply, or a paraphrased refusal. Guessing a
        "best match" source for those is actively misleading (a random
        retrieved chunk shown as the source for "hola" — RAG's low score
        threshold means *something* clears it for almost any query). Zero
        sources correctly communicates "nothing was used."

        Each returned item keeps its original `citation_number` (assigned in
        `_run_rag`, matching the "[N]" it was shown as) rather than being
        renumbered by its position in this filtered list — the frontend
        matches a clicked "[N]" back to its source card via that number, not
        array position, so citations stay correct even when non-contiguous
        (e.g. only "[2]" and "[4]" cited out of 5 retrieved).
        """
        if REFUSAL_MARKER in content:
            return [], []

        n = len(rag_ctx.source_infos)
        if n == 0:
            return [], []

        cited = {int(m) for m in self._CITATION_RE.findall(content)}
        cited = {i for i in cited if 1 <= i <= n}
        if not cited:
            return [], []

        payload = [s for s in rag_ctx.sources_payload if s["citation_number"] in cited]
        infos = [s for s in rag_ctx.source_infos if s.citation_number in cited]
        return payload, infos

    async def _embed_query(self, query: str) -> list[float] | None:
        """Embed the raw user query for answer-cache similarity lookups.

        Deliberately independent of both HyDE (always embeds the literal
        question, not a hypothetical doc) and the RAG embedding model
        (nomic-embed-text, tuned for document retrieval). Question-vs-question
        paraphrase matching is a different task: empirically, nomic-embed-text
        barely separates deep paraphrases (~0.58-0.69 similarity) from
        unrelated questions (~0.51-0.55) — too close to threshold safely.
        `answer_cache_embedding_model` (embeddinggemma) separates them
        cleanly (~0.69-0.80 vs ~0.35-0.37), so the cache always uses that
        model via Ollama directly, regardless of `embedding_provider` or
        `default_llm_provider`.

        Returns None (instead of raising) when Ollama is unreachable or too
        slow, so a deployment running only OpenAI for chat doesn't lose the
        ability to chat at all — or get stuck for minutes — just because the
        answer-cache's embedding call fails. Bounded by
        `answer_cache_embed_timeout_seconds` (short) rather than the 120s
        client timeout `OllamaProvider.embed()` uses for bulk document
        ingestion — see that setting's docstring for why.
        """
        try:
            provider = ProviderFactory.get_provider("ollama")
            result = await asyncio.wait_for(
                provider.embed([query], model=settings.answer_cache_embedding_model),
                timeout=settings.answer_cache_embed_timeout_seconds,
            )
            return result["embeddings"][0]
        except Exception as e:
            logger.warning(
                "Answer-cache embedding unavailable, skipping cache lookup: %s: %s",
                type(e).__name__, e,
            )
            return None

    async def _check_answer_cache(self, query: str) -> tuple[list[float] | None, dict | None]:
        """Look up a semantically similar cached answer, if the cache is enabled.

        Returns (embedding, cached_entry_or_None). The embedding is returned
        even on a miss so the caller can reuse it as the cache key when
        storing the freshly generated answer, without embedding twice. Both
        are None when the cache is disabled or the embedding call failed
        (e.g. Ollama unreachable) — callers must skip `answer_cache.store`
        in that case.
        """
        if not settings.answer_cache_enabled:
            return None, None
        embedding = await self._embed_query(query)
        if embedding is None:
            return None, None
        cached = await answer_cache.find_similar(embedding, query_text=query)
        return embedding, cached

    async def _get_history(
        self, conversation_id: UUID, exclude_message_id: UUID
    ) -> list[LLMMessage]:
        """Fetch last N turns, truncating long messages to reduce token usage."""
        recent = await self.db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .where(Message.id != exclude_message_id)
            .order_by(desc(Message.created_at))
            .limit(_MAX_HISTORY_MESSAGES)
        )
        history: list[LLMMessage] = []
        for m in reversed(recent.scalars().all()):
            content = m.content
            if len(content) > _MAX_HISTORY_CHARS:
                content = content[:_MAX_HISTORY_CHARS] + "…"
            history.append(LLMMessage(role=m.role, content=content))
        return history

    def _build_messages(
        self,
        rag_ctx: _RAGContext,
        history: list[LLMMessage],
        user_content: str,
        is_greeting_msg: bool = False,
        provider_name: str = "",
    ) -> list[LLMMessage]:
        """Assemble system prompt + history + current user turn.

        Uses a stricter no-context system prompt when RAG returned nothing ('none')
        or very low-quality results ('weak') to prevent hallucinations. A pure
        greeting/chit-chat message (RAG skipped entirely — see `is_greeting()`)
        gets its own friendly prompt instead: the no-context prompt is written
        to force the "no tengo información" refusal script, which is exactly
        wrong for "hola".

        `provider_name == "ollama"` sends the instructions as a `user`-role turn
        instead of `system` — an unconfirmed but plausible Ollama/Qwen chat-template
        quirk (ollama/ollama#10980) reports the `system` role being mishandled in
        RAG contexts specifically for Qwen models, which lines up with this
        project's own measured finding that qwen3:8b doesn't reliably follow the
        "[N]" citation instruction. Cheap to test, cheap to revert if the eval
        harness (scripts/eval_rag.py) shows no improvement.
        """
        if is_greeting_msg:
            system_prompt = GREETING_PROMPT
        else:
            context_for_prompt = rag_ctx.context_text if rag_ctx.quality == "good" else ""
            system_prompt = build_chat_prompt(context_for_prompt)

        instruction_role = "user" if provider_name == "ollama" else "system"
        messages = [LLMMessage(role=instruction_role, content=system_prompt)]
        messages.extend(history)
        messages.append(LLMMessage(role="user", content=user_content))
        return messages

    async def _generate_conversation_title(
        self, user_content: str, assistant_content: str, provider_name: str
    ) -> str:
        """Generate a concise 4-6 word conversation title from the first exchange."""
        try:
            provider = ProviderFactory.get_provider(provider_name)
            model = runtime_config.resolve_model(provider_name)
            result = await provider.generate(
                messages=[{
                    "role": "user",
                    "content": (
                        "Genera un título corto (4 a 6 palabras) para esta consulta sobre Uniputumayo.\n"
                        f"Pregunta: {user_content[:120]}\n"
                        f"Respuesta resumida: {assistant_content[:120]}\n\n"
                        "Responde SOLO con el título, sin comillas, sin punto final."
                    ),
                }],
                model=model,
                temperature=0.3,
                max_tokens=20,
            )
            title = result.get("content", "").strip().split("\n")[0].strip("\"'").strip()
            if len(title) > 8:
                return title[:100]
        except Exception as e:
            logger.debug("Title generation failed: %s", e)
        return user_content[:60]

    async def _maybe_set_title(
        self,
        conversation_id: UUID,
        user_content: str,
        assistant_content: str = "",
        provider_name: str = "",
        use_llm_title: bool = True,
    ) -> None:
        """Auto-title the conversation from the first exchange.

        `use_llm_title=False` skips the extra LLM call and falls back to a
        truncated-text title — used for answer-cache hits, where the whole
        point is responding without invoking the (possibly very slow, on
        CPU-only Ollama) LLM at all.
        """
        conversation = await self.get_conversation(conversation_id)
        if not conversation or conversation.title != "Nueva conversación":
            return

        if use_llm_title and assistant_content and provider_name:
            title = await self._generate_conversation_title(
                user_content, assistant_content, provider_name
            )
        else:
            title = user_content[:60]

        conversation.title = title

    # ── Non-streaming ────────────────────────────────────────────────────────

    async def process_message(
        self, conversation_id: UUID, data: MessageCreate
    ) -> ChatResponse:
        t0 = time.time()

        user_message = Message(
            conversation_id=conversation_id,
            role="user",
            content=data.content,
            input_type=data.input_type,
        )
        self.db.add(user_message)
        await self.db.flush()

        query_embedding, cached = await self._check_answer_cache(data.content)
        verification_attempts: int | None = None
        verification_approved: bool | None = None

        if cached is not None:
            content = cached["answer"]
            provider_name = cached["llm_provider"]
            model_name = cached["llm_model"]
            quality = "cached"
            sources_payload = cached["sources"]
            source_infos = [SourceInfo(**s) for s in sources_payload]
            tokens_used = None
        else:
            greeting = is_greeting(data.content)
            rag_ctx = self._empty_rag_ctx() if greeting else await self._run_rag(data.content)
            history = await self._get_history(conversation_id, user_message.id)
            provider_name = data.llm_provider or runtime_config.default_llm_provider
            messages = self._build_messages(
                rag_ctx, history, data.content, is_greeting_msg=greeting, provider_name=provider_name,
            )

            temperature = detect_temperature(data.content, default=runtime_config.default_temperature)

            quality = rag_ctx.quality
            finish_reason: str | None
            if quality == "good" and settings.verification_loop_enabled:
                # Self-correction loop (LangGraph): generate -> grade against
                # rag_ctx.context_text -> retry if ungrounded. See
                # app/services/verification_graph.py for why this only runs
                # here (RAG returned context) and not for greetings/refusals.
                model_name = data.llm_model or runtime_config.resolve_model(provider_name)
                verified = await generate_verified(
                    messages=[{"role": m.role, "content": m.content} for m in messages],
                    context_text=rag_ctx.context_text,
                    provider_name=provider_name,
                    model=model_name,
                    temperature=temperature,
                    max_tokens=runtime_config.default_max_tokens,
                )
                content = verified["content"]
                finish_reason = verified["finish_reason"]
                tokens_used = verified["tokens_used"]["total"] if verified["tokens_used"] else None
                verification_attempts = verified["attempts"]
                verification_approved = verified["approved"]
                if not verified["approved"]:
                    logger.warning(
                        "Verification loop exhausted retries without approval | conv=%s | "
                        "attempts=%d", conversation_id, verified["attempts"],
                    )
            else:
                llm_service = LLMService()
                llm_response = await llm_service.generate(
                    GenerateRequest(
                        messages=messages,
                        provider=provider_name,
                        model=data.llm_model,
                        temperature=temperature,
                    )
                )
                content = llm_response.content
                provider_name = llm_response.provider
                model_name = llm_response.model
                tokens_used = llm_response.tokens_used.total if llm_response.tokens_used else None
                finish_reason = llm_response.finish_reason

            if finish_reason == "length":
                logger.warning(
                    "Truncated response (finish_reason=length) | conv=%s | provider=%s | model=%s | "
                    "content_len=%d — max_tokens too low for this answer",
                    conversation_id, provider_name, model_name, len(content),
                )

            # Only show sources actually grounded in the answer — never the
            # raw retrieval list (see _filter_cited_sources / _run_rag).
            if quality == "good":
                sources_payload, source_infos = self._filter_cited_sources(content, rag_ctx)
            else:
                sources_payload, source_infos = [], []

            if (
                settings.answer_cache_enabled
                and query_embedding is not None
                and quality == "good"
                and content.strip()
                # quality=="good" only means RAG retrieval succeeded, not that
                # this specific answer is grounded in it — that's exactly what
                # the verification loop just checked. Caching regardless would
                # let an answer the loop explicitly flagged as ungrounded
                # (verification_approved=False) get served to every future
                # semantically-similar question, not just this one-off reply.
                and verification_approved is not False
            ):
                await answer_cache.store(
                    query_embedding, data.content, content,
                    sources_payload, provider_name, model_name,
                )

        response_time = int((time.time() - t0) * 1000)

        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=content,
            input_type="text",
            tokens_used=tokens_used,
            llm_provider=provider_name,
            llm_model=model_name,
            response_time_ms=response_time,
            verification_attempts=verification_attempts,
            verification_approved=verification_approved,
        )
        self.db.add(assistant_message)

        await self._maybe_set_title(
            conversation_id, data.content, content, provider_name,
            use_llm_title=(cached is None),
        )
        await self.db.commit()
        await self.db.refresh(user_message)
        await self.db.refresh(assistant_message)

        logger.info(
            "Chat | conv=%s | provider=%s | model=%s | quality=%s | rag=%d | total_ms=%d",
            conversation_id, provider_name, model_name,
            quality, len(sources_payload), response_time,
        )

        return ChatResponse(
            user_message=MessageResponse.model_validate(user_message),
            assistant_message=MessageResponse.model_validate(assistant_message),
            sources=source_infos or [],
        )

    # ── Streaming ────────────────────────────────────────────────────────────

    async def process_message_stream(
        self, conversation_id: UUID, data: MessageCreate
    ) -> AsyncIterator[str]:
        """Stream the assistant response via SSE."""
        t0 = time.time()

        user_message = Message(
            conversation_id=conversation_id,
            role="user",
            content=data.content,
            input_type=data.input_type,
        )
        self.db.add(user_message)
        await self.db.flush()

        try:
            # SSE heartbeat comments (lines starting with ':') are valid SSE but
            # browsers/parsers ignore them. We yield them before each slow phase
            # so Cloudflare/nginx don't close the connection thinking it's idle.
            yield ": thinking\n\n"

            query_embedding, cached = await self._check_answer_cache(data.content)
            verification_attempts: int | None = None
            verification_approved: bool | None = None

            if cached is not None:
                # Semantic cache hit — skip RAG + LLM entirely. See AsyncAnswerCache
                # docstring: matches paraphrased questions, not just exact text.
                sources_payload = cached["sources"]
                full_content = cached["answer"]
                provider_name = cached["llm_provider"]
                model = cached["llm_model"]
                quality = "cached"
                rag_count = len(sources_payload)

                yield f"data: {json.dumps({'type': 'sources', 'sources': sources_payload})}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'content': full_content})}\n\n"
            else:
                greeting = is_greeting(data.content)
                rag_ctx = self._empty_rag_ctx() if greeting else await self._run_rag(data.content)
                history = await self._get_history(conversation_id, user_message.id)
                provider_name = data.llm_provider or runtime_config.default_llm_provider
                messages = self._build_messages(
                    rag_ctx, history, data.content, is_greeting_msg=greeting, provider_name=provider_name,
                )

                # Send candidate sources immediately so the UI renders them while
                # the LLM streams — corrected down to only-cited (or cleared
                # entirely) once generation finishes, below. Skipped when the LLM
                # never received context (quality != "good") to avoid flashing
                # sources next to what will be a "no tengo información" refusal.
                if rag_ctx.quality == "good":
                    yield f"data: {json.dumps({'type': 'sources', 'sources': rag_ctx.sources_payload})}\n\n"

                model = data.llm_model or runtime_config.resolve_model(provider_name)
                temperature = detect_temperature(data.content, default=runtime_config.default_temperature)
                messages_dicts = [{"role": m.role, "content": m.content} for m in messages]

                # Second heartbeat: Ollama on CPU can take 10-20 s before the first token
                yield ": generating\n\n"

                if rag_ctx.quality == "good" and settings.verification_loop_enabled:
                    # Self-correction loop (see verification_graph.py): grading needs
                    # the complete draft, so this path can't stream token-by-token —
                    # it sends the whole approved answer as one event, same as the
                    # answer-cache hit above does.
                    verified = await generate_verified(
                        messages=messages_dicts,
                        context_text=rag_ctx.context_text,
                        provider_name=provider_name,
                        model=model,
                        temperature=temperature,
                        max_tokens=runtime_config.default_max_tokens,
                    )
                    full_content = verified["content"]
                    finish_reason = verified["finish_reason"]
                    verification_attempts = verified["attempts"]
                    verification_approved = verified["approved"]
                    if not verified["approved"]:
                        logger.warning(
                            "Verification loop exhausted retries without approval | conv=%s | "
                            "attempts=%d", conversation_id, verified["attempts"],
                        )
                    yield f"data: {json.dumps({'type': 'token', 'content': full_content})}\n\n"
                else:
                    provider = ProviderFactory.get_provider(provider_name)
                    full_content = ""
                    stream_meta: dict = {}
                    async for token in provider.generate_stream(
                        messages_dicts, model, temperature, runtime_config.default_max_tokens,
                        meta=stream_meta,
                    ):
                        full_content += token
                        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
                    finish_reason = stream_meta.get("finish_reason")

                if finish_reason == "length":
                    logger.warning(
                        "Truncated stream response (finish_reason=length) | conv=%s | provider=%s | "
                        "model=%s | content_len=%d — max_tokens too low for this answer",
                        conversation_id, provider_name, model, len(full_content),
                    )

                quality = rag_ctx.quality

                # Correct the candidate list sent before generation down to
                # only the sources actually cited in the answer (or empty if
                # the LLM never received context at all) — see
                # _filter_cited_sources / _run_rag.
                if quality == "good":
                    sources_payload, _ = self._filter_cited_sources(full_content, rag_ctx)
                else:
                    sources_payload = []
                rag_count = len(sources_payload)
                yield f"data: {json.dumps({'type': 'sources', 'sources': sources_payload})}\n\n"

                # Only cache answers actually grounded in retrieved context — never
                # cache "no tengo esa información" refusals or ungrounded guesses.
                # quality=="good" only means RAG retrieval succeeded — checking
                # verification_approved too excludes an answer the verification
                # loop explicitly flagged as ungrounded after exhausting its
                # retries, which would otherwise get served to every future
                # semantically-similar question instead of just this one reply.
                if (
                    settings.answer_cache_enabled
                    and query_embedding is not None
                    and quality == "good"
                    and full_content.strip()
                    and verification_approved is not False
                ):
                    await answer_cache.store(
                        query_embedding, data.content, full_content,
                        sources_payload, provider_name, model,
                    )

            response_time = int((time.time() - t0) * 1000)

            assistant_message = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_content,
                input_type="text",
                llm_provider=provider_name,
                llm_model=model,
                response_time_ms=response_time,
                verification_attempts=verification_attempts,
                verification_approved=verification_approved,
            )
            self.db.add(assistant_message)

            await self._maybe_set_title(
                conversation_id, data.content, full_content, provider_name,
                use_llm_title=(cached is None),
            )
            await self.db.commit()
            await self.db.refresh(user_message)
            await self.db.refresh(assistant_message)

            logger.info(
                "Chat stream | conv=%s | provider=%s | model=%s | quality=%s | "
                "rag=%d | total_ms=%d",
                conversation_id, provider_name, model,
                quality, rag_count, response_time,
            )

            done_payload = {
                "type": "done",
                "user_message": {
                    "id": str(user_message.id),
                    "conversation_id": str(conversation_id),
                    "role": "user",
                    "content": user_message.content,
                    "input_type": user_message.input_type,
                    "tokens_used": None,
                    "llm_provider": None,
                    "llm_model": None,
                    "response_time_ms": None,
                    "created_at": user_message.created_at.isoformat(),
                },
                "assistant_message": {
                    "id": str(assistant_message.id),
                    "conversation_id": str(conversation_id),
                    "role": "assistant",
                    "content": full_content,
                    "input_type": "text",
                    "tokens_used": None,
                    "llm_provider": provider_name,
                    "llm_model": model,
                    "response_time_ms": response_time,
                    "created_at": assistant_message.created_at.isoformat(),
                },
            }
            yield f"data: {json.dumps(done_payload)}\n\n"

        except Exception as e:
            logger.error(
                "Stream error for conv=%s: %s", conversation_id, e, exc_info=True
            )
            await self.db.rollback()
            yield f"data: {json.dumps({'type': 'error', 'message': 'Error procesando tu mensaje. Intenta de nuevo.'})}\n\n"
