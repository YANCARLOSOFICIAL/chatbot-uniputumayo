import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session as create_session
from app.models.conversation import Conversation
from app.schemas.chat import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    ChatResponse,
    SuggestedQuestion,
)
from app.services.chat_service import ChatService
from app.auth import get_current_user
from app.models.user import User
from app.utils.rate_limit import limiter

router = APIRouter()


def _check_ownership(conversation: Conversation, current_user: User | None) -> None:
    """Reject access to another user's conversation.

    Returns 404 (not 403) so a guessed UUID can't be used to confirm a
    conversation exists. Guest conversations (user_id IS NULL) have no
    concept of ownership since there is no auth to check against — the
    UUID itself is the only access control, same as an anonymous share link.
    """
    if conversation.user_id is not None and (
        current_user is None or conversation.user_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.get("/suggestions", response_model=list[SuggestedQuestion])
async def get_suggestions(db: AsyncSession = Depends(get_db)):
    """Welcome-screen prompt suggestions — no auth, guests see them too."""
    service = ChatService(db)
    return await service.get_suggested_questions(limit=4)


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
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    service = ChatService(db)
    user_id = current_user.id if current_user else None
    return await service.list_conversations(limit=limit, offset=offset, user_id=user_id)


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    service = ChatService(db)
    conversation = await service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _check_ownership(conversation, current_user)
    return conversation


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
async def rename_conversation(
    conversation_id: UUID,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    service = ChatService(db)
    conversation = await service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _check_ownership(conversation, current_user)
    updated = await service.update_conversation_title(conversation_id, data.title)
    return updated


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    service = ChatService(db)
    conversation = await service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _check_ownership(conversation, current_user)
    await service.delete_conversation(conversation_id)
    return {"success": True}


@router.post("/conversations/{conversation_id}/guest-close")
async def guest_close_conversation(
    conversation_id: UUID, db: AsyncSession = Depends(get_db)
):
    """Called via navigator.sendBeacon when a guest closes the tab.
    Hard-deletes the conversation only when user_id IS NULL.
    Always returns 200 — sendBeacon ignores the response body anyway.
    """
    await db.execute(
        sql_delete(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id.is_(None))
    )
    await db.commit()
    return {"success": True}


@router.post(
    "/conversations/{conversation_id}/messages", response_model=ChatResponse
)
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    conversation_id: UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    service = ChatService(db)
    conversation = await service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _check_ownership(conversation, current_user)
    return await service.process_message(conversation_id, data)


@router.post("/conversations/{conversation_id}/messages/stream")
@limiter.limit("20/minute")
async def send_message_stream(
    request: Request,
    conversation_id: UUID,
    data: MessageCreate,
    current_user: User | None = Depends(get_current_user),
):
    """SSE streaming endpoint with periodic heartbeats for QUIC/Cloudflare.

    Architecture note: _pump runs in a separate asyncio Task and creates its
    OWN AsyncSession. This is required because SQLAlchemy's async sessions use
    greenlets internally — sharing a session across asyncio tasks causes
    greenlet context errors. The main generate() coroutine only reads from the
    queue and yields heartbeat SSE comments when no event arrives within 15 s.
    """

    async def generate():
        q: asyncio.Queue[str | None] = asyncio.Queue()

        async def _pump() -> None:
            # Creates its own session — never reuse a session across tasks.
            try:
                async with create_session() as db:
                    try:
                        service = ChatService(db)
                        conversation = await service.get_conversation(conversation_id)
                        if not conversation:
                            await q.put(
                                f"data: {json.dumps({'type': 'error', 'message': 'Conversation not found'})}\n\n"
                            )
                            return
                        try:
                            _check_ownership(conversation, current_user)
                        except HTTPException:
                            await q.put(
                                f"data: {json.dumps({'type': 'error', 'message': 'Conversation not found'})}\n\n"
                            )
                            return
                        async for chunk in service.process_message_stream(conversation_id, data):
                            await q.put(chunk)
                    except Exception as e:
                        await q.put(
                            f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                        )
            except Exception as e:
                await q.put(
                    f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                )
            finally:
                # Guarantee the sentinel always reaches the queue so generate()
                # never hangs waiting. Use put_nowait as fallback in case the
                # task is being cancelled while we try to await q.put().
                try:
                    await q.put(None)
                except Exception:
                    q.put_nowait(None)

        pump_task = asyncio.create_task(_pump())

        try:
            while True:
                try:
                    item = await asyncio.wait_for(q.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # No event for 15 s: send SSE comment to keep Cloudflare/QUIC alive.
                    # SSE comment lines (': ...') are valid SSE but browsers ignore them.
                    yield ": ping\n\n"
                    continue

                if item is None:
                    break
                yield item
        finally:
            pump_task.cancel()
            try:
                await pump_task
            except asyncio.CancelledError:
                pass

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
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    service = ChatService(db)
    conversation = await service.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    _check_ownership(conversation, current_user)
    return await service.get_messages(conversation_id, limit=limit, offset=offset)
