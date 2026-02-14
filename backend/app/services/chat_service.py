import time
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
from app.schemas.llm import GenerateRequest, LLMMessage
from app.utils.prompts import build_chat_prompt
from app.config import settings


class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db

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
        self, limit: int = 20, offset: int = 0
    ) -> list[Conversation]:
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.is_active.is_(True))
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
            .offset(offset)
        )
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

    async def process_message(
        self, conversation_id: UUID, data: MessageCreate
    ) -> ChatResponse:
        start_time = time.time()

        # 1. Save user message
        user_message = Message(
            conversation_id=conversation_id,
            role="user",
            content=data.content,
            input_type=data.input_type,
        )
        self.db.add(user_message)
        await self.db.flush()

        # 2. RAG search
        rag_service = RAGService(self.db)
        search_request = SearchRequest(query=data.content)
        search_results = await rag_service.search(search_request)

        # 3. Build context from RAG results
        context = "\n\n---\n\n".join(
            r.content for r in search_results.results
        )

        # 4. Get conversation history (last 10 messages)
        history_messages = await self.get_messages(conversation_id, limit=10)
        history = [
            LLMMessage(role=m.role, content=m.content)
            for m in history_messages
            if m.id != user_message.id
        ]

        # 5. Build prompt and generate response
        system_prompt = build_chat_prompt(context)
        messages = [LLMMessage(role="system", content=system_prompt)]
        messages.extend(history)
        messages.append(LLMMessage(role="user", content=data.content))

        provider = data.llm_provider or settings.default_llm_provider
        llm_service = LLMService()
        llm_response = await llm_service.generate(
            GenerateRequest(messages=messages, provider=provider)
        )

        response_time = int((time.time() - start_time) * 1000)

        # 6. Save assistant message
        assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=llm_response.content,
            input_type="text",
            tokens_used=(
                llm_response.tokens_used.total if llm_response.tokens_used else None
            ),
            llm_provider=llm_response.provider,
            llm_model=llm_response.model,
            response_time_ms=response_time,
        )
        self.db.add(assistant_message)

        # 7. Update conversation title if first message
        conversation = await self.get_conversation(conversation_id)
        if conversation and conversation.title == "Nueva conversación":
            conversation.title = data.content[:100]

        await self.db.commit()
        await self.db.refresh(user_message)
        await self.db.refresh(assistant_message)

        # 8. Build sources
        sources = [
            SourceInfo(
                chunk_id=r.chunk_id,
                document_title=r.document_title,
                content_preview=r.content[:200],
                score=r.score,
                program=r.program,
                faculty=r.faculty,
            )
            for r in search_results.results
        ]

        return ChatResponse(
            user_message=MessageResponse.model_validate(user_message),
            assistant_message=MessageResponse.model_validate(assistant_message),
            sources=sources,
        )
