import json
import logging
import time
from dataclasses import dataclass
from typing import AsyncIterator
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.chat import (
    ConversationCreate,
    MessageCreate,
    ChatResponse,
    MessageResponse,
    SourceInfo,
)
from app.services.rag_service import RAGService
from app.services.llm_service import LLMService
from app.schemas.rag import SearchRequest
from app.schemas.llm import GenerateRequest, LLMMessage, EmbedRequest
from app.utils.prompts import build_chat_prompt
from app.utils.query_utils import detect_temperature
from app.utils.cache import answer_cache
from app.runtime_config import runtime_config
from app.config import settings
from app.providers.provider_factory import ProviderFactory

logger = logging.getLogger(__name__)

_MAX_HISTORY_MESSAGES = 10
_MAX_HISTORY_CHARS = 600  # truncate long messages in history to save tokens


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

    # ── Shared pipeline helpers ──────────────────────────────────────────────

    async def _run_rag(self, query: str) -> _RAGContext:
        """Run RAG search and return structured context ready for prompt building."""
        rag_service = RAGService(self.db)
        search_results = await rag_service.search(SearchRequest(query=query))
        quality = rag_service.evaluate_context_quality(search_results.results)

        context_text = "\n\n---\n\n".join(r.content for r in search_results.results)

        sources_payload = [
            {
                "chunk_id": str(r.chunk_id),
                "document_title": r.document_title,
                "content_preview": r.content[:200],
                "score": r.score,
                "program": r.program,
                "faculty": r.faculty,
            }
            for r in search_results.results
        ]

        source_infos = [
            SourceInfo(
                chunk_id=r.chunk_id,
                document_title=r.document_title or "Documento IUP",
                content_preview=r.content[:200],
                score=r.score,
                program=r.program,
                faculty=r.faculty,
            )
            for r in search_results.results
        ]

        return _RAGContext(
            context_text=context_text,
            sources_payload=sources_payload,
            source_infos=source_infos,
            quality=quality,
            embed_ms=search_results.query_embedding_time_ms,
            search_ms=search_results.search_time_ms,
        )

    async def _embed_query(self, query: str) -> list[float]:
        """Embed the raw user query — independent of HyDE — for answer-cache lookups.

        Always embeds the literal question (not a HyDE hypothetical doc) so
        cache matching reflects what the user actually asked, regardless of
        whether HyDE is enabled for retrieval.
        """
        llm_service = LLMService()
        embed_response = await llm_service.embed(EmbedRequest(texts=[query]))
        return embed_response.embeddings[0]

    async def _check_answer_cache(self, query: str) -> tuple[list[float], dict | None]:
        """Embed the query and look up a semantically similar cached answer.

        Returns (embedding, cached_entry_or_None). The embedding is returned
        even on a miss so the caller can reuse it as the cache key when
        storing the freshly generated answer, without embedding twice.
        """
        embedding = await self._embed_query(query)
        if not settings.answer_cache_enabled:
            return embedding, None
        cached = await answer_cache.find_similar(embedding)
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
    ) -> list[LLMMessage]:
        """Assemble system prompt + history + current user turn.

        Uses a stricter no-context system prompt when RAG returned nothing ('none')
        or very low-quality results ('weak') to prevent hallucinations.
        """
        context_for_prompt = rag_ctx.context_text if rag_ctx.quality == "good" else ""
        system_prompt = build_chat_prompt(context_for_prompt)

        messages = [LLMMessage(role="system", content=system_prompt)]
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
                        "Genera un título corto (4 a 6 palabras) para esta consulta sobre la IUP.\n"
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

        if cached is not None:
            content = cached["answer"]
            provider_name = cached["llm_provider"]
            model_name = cached["llm_model"]
            quality = "cached"
            sources_payload = cached["sources"]
            source_infos = [SourceInfo(**s) for s in sources_payload]
            tokens_used = None
        else:
            rag_ctx = await self._run_rag(data.content)
            history = await self._get_history(conversation_id, user_message.id)
            messages = self._build_messages(rag_ctx, history, data.content)

            provider_name = data.llm_provider or runtime_config.default_llm_provider
            temperature = detect_temperature(data.content, default=runtime_config.default_temperature)

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
            quality = rag_ctx.quality
            sources_payload = rag_ctx.sources_payload
            source_infos = rag_ctx.source_infos
            tokens_used = llm_response.tokens_used.total if llm_response.tokens_used else None

            if settings.answer_cache_enabled and quality == "good" and content.strip():
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
                rag_ctx = await self._run_rag(data.content)
                history = await self._get_history(conversation_id, user_message.id)
                messages = self._build_messages(rag_ctx, history, data.content)

                # Send sources immediately so UI renders them while LLM streams
                yield f"data: {json.dumps({'type': 'sources', 'sources': rag_ctx.sources_payload})}\n\n"

                provider_name = data.llm_provider or runtime_config.default_llm_provider
                provider = ProviderFactory.get_provider(provider_name)
                model = data.llm_model or runtime_config.resolve_model(provider_name)
                temperature = detect_temperature(data.content, default=runtime_config.default_temperature)
                messages_dicts = [{"role": m.role, "content": m.content} for m in messages]

                # Second heartbeat: Ollama on CPU can take 10-20 s before the first token
                yield ": generating\n\n"

                full_content = ""
                async for token in provider.generate_stream(
                    messages_dicts, model, temperature, runtime_config.default_max_tokens
                ):
                    full_content += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

                sources_payload = rag_ctx.sources_payload
                quality = rag_ctx.quality
                rag_count = len(rag_ctx.source_infos)

                # Only cache answers actually grounded in retrieved context — never
                # cache "no tengo esa información" refusals or ungrounded guesses.
                if settings.answer_cache_enabled and quality == "good" and full_content.strip():
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
