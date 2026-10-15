import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.schemas.document import (
    DocumentUploadResponse, DocumentResponse, ChunkResponse, DocumentMetadataUpdate,
)
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
    import os as _os
    import re as _re

    raw_name = _os.path.basename(file.filename or "")
    # Rechazar path traversal / subdirectorios y nombres peligrosos
    if not raw_name or "/" in (file.filename or "") or "\\" in (file.filename or "") or ".." in (file.filename or ""):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    if not _re.fullmatch(r"[A-Za-z0-9._\- ]+", raw_name.rsplit(".", 1)[0] if "." in raw_name else raw_name):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")
    ext = raw_name.rsplit(".", 1)[-1].lower() if "." in raw_name else ""
    if not normalize_extension(ext):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Formato '.{ext}' no soportado. "
                f"Formatos válidos: {', '.join(e.upper() for e in SUPPORTED_EXTENSIONS)}"
            ),
        )

    # Early 413 por Content-Length (evita leer todo a memoria antes de rechazar)
    try:
        content_length = int(request.headers.get("content-length", "0") or "0")
    except ValueError:
        content_length = 0
    if content_length and content_length > _MAX_BYTES + 1024 * 1024:  # margen multipart
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande. Máximo permitido: {settings.max_upload_size_mb} MB.",
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
    response: Response,
    status: str | None = None,
    program: str | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    service = DocumentService(db)
    # X-Total-Count (not part of the JSON body) lets the admin UI paginate
    # instead of the list silently truncating at per_page with no signal
    # that more documents exist beyond the current page.
    total = await service.count_documents(status=status, program=program)
    response.headers["X-Total-Count"] = str(total)
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


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document_metadata(
    document_id: UUID,
    body: DocumentMetadataUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Edit faculty/program/document_type on an already-uploaded document.

    No reprocessing — unlike /reindex, this only touches taxonomy fields used
    for retrieval filtering and the program/faculty disambiguation heuristic
    (ChatService._detect_ambiguity), not the extracted text or embeddings.
    Only fields actually present in the request body are changed — omitting
    a field leaves it as-is (see DocumentMetadataUpdate/update_metadata).
    """
    service = DocumentService(db)
    fields = body.model_dump(exclude_unset=True)
    doc = await service.update_metadata(
        document_id,
        faculty=fields.get("faculty", ...),
        program=fields.get("program", ...),
        document_type=fields.get("document_type", ...),
    )
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
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
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
