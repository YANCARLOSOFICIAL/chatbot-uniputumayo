from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.taxonomy import (
    TaxonomyCreate,
    TaxonomyRename,
    FacultyResponse,
    ProgramCreate,
    ProgramResponse,
    DocumentTypeResponse,
)
from app.services.taxonomy_service import TaxonomyService
from app.auth import require_admin
from app.models.user import User

router = APIRouter()


# ── Faculties ────────────────────────────────────────────────────────────────

@router.get("/faculties", response_model=list[FacultyResponse])
async def list_faculties(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await TaxonomyService(db).list_faculties()


@router.post("/faculties", response_model=FacultyResponse)
async def create_faculty(
    data: TaxonomyCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    return await TaxonomyService(db).create_faculty(data.name)


@router.put("/faculties/{faculty_id}", response_model=FacultyResponse)
async def rename_faculty(
    faculty_id: UUID, data: TaxonomyRename,
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    return await TaxonomyService(db).rename_faculty(faculty_id, data.name)


@router.delete("/faculties/{faculty_id}")
async def delete_faculty(
    faculty_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    await TaxonomyService(db).delete_faculty(faculty_id)
    return {"success": True}


# ── Programs ─────────────────────────────────────────────────────────────────

@router.get("/programs", response_model=list[ProgramResponse])
async def list_programs(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await TaxonomyService(db).list_programs()


@router.post("/programs", response_model=ProgramResponse)
async def create_program(
    data: ProgramCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    return await TaxonomyService(db).create_program(data.name, data.faculty_id)


@router.put("/programs/{program_id}", response_model=ProgramResponse)
async def rename_program(
    program_id: UUID, data: TaxonomyRename,
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    return await TaxonomyService(db).rename_program(program_id, data.name)


@router.delete("/programs/{program_id}")
async def delete_program(
    program_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    await TaxonomyService(db).delete_program(program_id)
    return {"success": True}


# ── Document types ────────────────────────────────────────────────────────────

@router.get("/document-types", response_model=list[DocumentTypeResponse])
async def list_document_types(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await TaxonomyService(db).list_document_types()


@router.post("/document-types", response_model=DocumentTypeResponse)
async def create_document_type(
    data: TaxonomyCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    return await TaxonomyService(db).create_document_type(data.name)


@router.put("/document-types/{type_id}", response_model=DocumentTypeResponse)
async def rename_document_type(
    type_id: UUID, data: TaxonomyRename,
    db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin),
):
    return await TaxonomyService(db).rename_document_type(type_id, data.name)


@router.delete("/document-types/{type_id}")
async def delete_document_type(
    type_id: UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    await TaxonomyService(db).delete_document_type(type_id)
    return {"success": True}
