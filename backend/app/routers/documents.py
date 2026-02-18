from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.document import DocumentUploadResponse, DocumentResponse, ChunkResponse
from app.services.document_service import DocumentService
from app.auth import require_admin
from app.models.user import User

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    faculty: str | None = Form(None),
    program: str | None = Form(None),
    document_type: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = DocumentService(db)
    return await service.upload_and_process(
        file=file,
        title=title,
        faculty=faculty,
        program=program,
        document_type=document_type,
    )


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(
    status: str | None = None,
    program: str | None = None,
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = DocumentService(db)
    return await service.list_documents(
        status=status, program=program, page=page, per_page=per_page
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    service = DocumentService(db)
    doc = await service.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}")
async def delete_document(document_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    service = DocumentService(db)
    success = await service.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}


@router.get("/{document_id}/chunks", response_model=list[ChunkResponse])
async def get_chunks(
    document_id: UUID,
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = DocumentService(db)
    return await service.get_chunks(document_id, page=page, per_page=per_page)


@router.post("/{document_id}/reindex", response_model=DocumentUploadResponse)
async def reindex_document(document_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    service = DocumentService(db)
    return await service.reindex(document_id)
