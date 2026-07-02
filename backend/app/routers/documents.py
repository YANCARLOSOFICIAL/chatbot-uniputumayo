import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.schemas.document import DocumentUploadResponse, DocumentResponse, ChunkResponse
from app.services.document_service import DocumentService
from app.auth import require_admin
from app.models.user import User
from app.utils.file_parsers import SUPPORTED_EXTENSIONS, normalize_extension
from app.utils.rate_limit import limiter

router = APIRouter()

_MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024

# Strong references to background ingestion tasks so GC doesn't collect them
# mid-flight (same pattern as app.main._pull_tasks).
_ingestion_tasks: set[asyncio.Task] = set()


def _spawn_ingestion(document_id: UUID, name: str) -> None:
    """Fire-and-forget the heavy extraction/embedding pipeline for a document.

    Uses a fresh DocumentService bound to its own DB session (see
    DocumentService.process_document_background) since the request-scoped
    session passed to the router closes when this request returns.
    """
    task = asyncio.create_task(
        DocumentService(db=None).process_document_background(document_id),
        name=f"ingest-{name}-{document_id}",
    )
    _ingestion_tasks.add(task)
    task.add_done_callback(_ingestion_tasks.discard)


@router.post("/upload", response_model=DocumentUploadResponse)
@limiter.limit("20/hour")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    faculty: str | None = Form(None),
    program: str | None = Form(None),
    document_type: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Validate file extension before touching the payload
    raw_name = file.filename or ""
    ext = raw_name.rsplit(".", 1)[-1].lower() if "." in raw_name else ""
    if not normalize_extension(ext):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Formato '.{ext}' no soportado. "
                f"Formatos válidos: {', '.join(e.upper() for e in SUPPORTED_EXTENSIONS)}"
            ),
        )

    service = DocumentService(db)
    response = await service.upload_and_process(
        file=file,
        title=title,
        faculty=faculty,
        program=program,
        document_type=document_type,
    )
    if response.status == "processing" and response.document_id:
        _spawn_ingestion(response.document_id, "upload")
    return response


@router.get("", response_model=list[DocumentResponse])
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
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = DocumentService(db)
    doc = await service.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
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
async def reindex_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = DocumentService(db)
    response = await service.reindex(document_id)
    if response.status == "processing" and response.document_id:
        _spawn_ingestion(response.document_id, "reindex")
    return response
