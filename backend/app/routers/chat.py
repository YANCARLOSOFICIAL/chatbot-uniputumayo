import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session as create_session
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    ChatResponse,
)
from app.services.chat_service import ChatService
from app.auth import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    # Associate conversation with logged-in user if present
    if current_user:
        data.user_id = current_user.id
    service = ChatService(db)
    return await service.create_conversation(data)


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    service = ChatService(db)
    user_id = current_user.id if current_user else None
    return await service.list_conversations(limit=limit, offset=offset, user_id=user_id)


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID, db: AsyncSession = Depends(get_db)
):
    service = ChatService(db)
    conversation = await service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID, db: AsyncSession = Depends(get_db)
):
    service = ChatService(db)
    success = await service.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@router.post(
    "/conversations/{conversation_id}/messages", response_model=ChatResponse
)
async def send_message(
    conversation_id: UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    service = ChatService(db)
    conversation = await service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await service.process_message(conversation_id, data)


@router.post("/conversations/{conversation_id}/messages/stream")
async def send_message_stream(
    conversation_id: UUID,
    data: MessageCreate,
):
    """SSE streaming endpoint. Manages its own DB session to avoid connection leaks."""

    async def generate():
        # Own session lifecycle inside the generator ensures proper cleanup
        async with create_session() as db:
            try:
                service = ChatService(db)
                conversation = await service.get_conversation(conversation_id)
                if not conversation:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Conversation not found'})}\n\n"
                    return
                async for chunk in service.process_message_stream(conversation_id, data):
                    yield chunk
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def get_messages(
    conversation_id: UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    service = ChatService(db)
    return await service.get_messages(conversation_id, limit=limit, offset=offset)
