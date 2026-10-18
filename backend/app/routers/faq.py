from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.faq_entry import FaqEntry
from app.models.user import User
from app.schemas.faq import (
    FaqAdmin,
    FaqCreate,
    FaqImportRequest,
    FaqImportResult,
    FaqPublic,
    FaqReindexResult,
    FaqUpdate,
)
from app.services.faq_service import FaqService
from app.utils.rate_limit import limiter

router = APIRouter()


def _admin_view(entry: FaqEntry) -> FaqAdmin:
    return FaqAdmin(
        id=entry.id,
        question=entry.question,
        answer=entry.answer,
        category=entry.category,
        source_document=entry.source_document,
        valid_period=entry.valid_period,
        sort_order=entry.sort_order,
        program=entry.program,
        faculty=entry.faculty,
        is_enabled=entry.is_enabled,
        hit_count=entry.hit_count,
        indexed=entry.embedding is not None,
        embedding_model=entry.embedding_model,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


# ── Public ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[FaqPublic])
@limiter.limit("60/minute")
async def list_faq(request: Request, db: AsyncSession = Depends(get_db)):
    """Enabled FAQs for the public page and the chat welcome screen — no auth."""
    return await FaqService(db).list_public()


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin", response_model=list[FaqAdmin])
async def list_faq_admin(
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    return [_admin_view(e) for e in await FaqService(db).list_admin()]


@router.post("/admin", response_model=FaqAdmin, status_code=201)
async def create_faq(
    data: FaqCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    return _admin_view(await FaqService(db).create(data))


@router.post("/admin/import", response_model=FaqImportResult)
async def import_faq(
    data: FaqImportRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    created, skipped, not_indexed = await FaqService(db).import_entries(
        data.entries, skip_duplicates=data.skip_duplicates,
    )
    return FaqImportResult(created=created, skipped=skipped, not_indexed=not_indexed)


@router.post("/admin/reindex", response_model=FaqReindexResult)
async def reindex_all_faq(
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    ok, failed = await FaqService(db).reindex()
    return FaqReindexResult(indexed=ok, failed=failed)


@router.post("/admin/{entry_id}/reindex", response_model=FaqReindexResult)
async def reindex_faq(
    entry_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    service = FaqService(db)
    if await service.get(entry_id) is None:
        raise HTTPException(status_code=404, detail="Pregunta frecuente no encontrada")
    ok, failed = await service.reindex(entry_id)
    return FaqReindexResult(indexed=ok, failed=failed)


@router.put("/admin/{entry_id}", response_model=FaqAdmin)
async def update_faq(
    entry_id: UUID, data: FaqUpdate,
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    entry = await FaqService(db).update(entry_id, data)
    if entry is None:
        raise HTTPException(status_code=404, detail="Pregunta frecuente no encontrada")
    return _admin_view(entry)


@router.delete("/admin/{entry_id}")
async def delete_faq(
    entry_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    if not await FaqService(db).delete(entry_id):
        raise HTTPException(status_code=404, detail="Pregunta frecuente no encontrada")
    return {"success": True}
