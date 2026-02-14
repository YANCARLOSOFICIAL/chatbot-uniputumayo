from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    ChatResponse,
)
from app.services.chat_service import ChatService

router = APIRouter()


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate, db: AsyncSession = Depends(get_db)
):
    service = ChatService(db)
    return await service.create_conversation(data)


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)
):
    service = ChatService(db)
    return await service.list_conversations(limit=limit, offset=offset)


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
