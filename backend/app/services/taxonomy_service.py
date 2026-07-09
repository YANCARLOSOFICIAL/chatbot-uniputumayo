import uuid

from fastapi import HTTPException
from sqlalchemy import select, func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faculty import Faculty
from app.models.program import Program
from app.models.document_type import DocumentType
from app.models.document import Document


class TaxonomyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Shared helpers ───────────────────────────────────────────────────────

    async def _get_or_404(self, model, entity_id: uuid.UUID):
        result = await self.db.execute(select(model).where(model.id == entity_id))
        entity = result.scalar_one_or_none()
        if not entity:
            raise HTTPException(status_code=404, detail="No encontrado")
        return entity

    async def _check_unique(self, model, name: str, exclude_id: uuid.UUID | None = None) -> None:
        query = select(model).where(func.lower(model.name) == name.strip().lower())
        if exclude_id is not None:
            query = query.where(model.id != exclude_id)
        result = await self.db.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"'{name.strip()}' ya existe")

    async def _commit_or_conflict(self, name: str) -> None:
        """Commit, translating a unique-index race (two concurrent creates/
        renames of the same name slipping past _check_unique's SELECT) into
        the same 409 _check_unique would have raised, instead of an unhandled
        500 from the DB constraint.
        """
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=409, detail=f"'{name.strip()}' ya existe")

    async def _guard_in_use(self, column, name: str) -> None:
        result = await self.db.execute(
            select(func.count()).select_from(Document).where(column == name)
        )
        count = result.scalar_one()
        if count > 0:
            raise HTTPException(
                status_code=409,
                detail=f"No se puede eliminar: {count} documento(s) lo usan. Reasígnalos primero.",
            )

    # ── Faculties ────────────────────────────────────────────────────────────

    async def list_faculties(self) -> list[Faculty]:
        result = await self.db.execute(select(Faculty).order_by(Faculty.name))
        return list(result.scalars().all())

    async def create_faculty(self, name: str) -> Faculty:
        await self._check_unique(Faculty, name)
        entity = Faculty(name=name.strip())
        self.db.add(entity)
        await self._commit_or_conflict(name)
        await self.db.refresh(entity)
        return entity

    async def rename_faculty(self, faculty_id: uuid.UUID, new_name: str) -> Faculty:
        entity = await self._get_or_404(Faculty, faculty_id)
        await self._check_unique(Faculty, new_name, exclude_id=faculty_id)
        old_name = entity.name
        entity.name = new_name.strip()
        await self.db.execute(
            update(Document).where(Document.faculty == old_name).values(faculty=entity.name)
        )
        await self._commit_or_conflict(new_name)
        await self.db.refresh(entity)
        return entity

    async def delete_faculty(self, faculty_id: uuid.UUID) -> None:
        entity = await self._get_or_404(Faculty, faculty_id)
        await self._guard_in_use(Document.faculty, entity.name)
        await self.db.delete(entity)
        await self.db.commit()

    # ── Programs ─────────────────────────────────────────────────────────────

    async def list_programs(self) -> list[Program]:
        result = await self.db.execute(select(Program).order_by(Program.name))
        return list(result.scalars().all())

    async def create_program(self, name: str, faculty_id: uuid.UUID | None = None) -> Program:
        await self._check_unique(Program, name)
        entity = Program(name=name.strip(), faculty_id=faculty_id)
        self.db.add(entity)
        await self._commit_or_conflict(name)
        await self.db.refresh(entity)
        return entity

    async def rename_program(self, program_id: uuid.UUID, new_name: str) -> Program:
        entity = await self._get_or_404(Program, program_id)
        await self._check_unique(Program, new_name, exclude_id=program_id)
        old_name = entity.name
        entity.name = new_name.strip()
        await self.db.execute(
            update(Document).where(Document.program == old_name).values(program=entity.name)
        )
        await self._commit_or_conflict(new_name)
        await self.db.refresh(entity)
        return entity

    async def delete_program(self, program_id: uuid.UUID) -> None:
        entity = await self._get_or_404(Program, program_id)
        await self._guard_in_use(Document.program, entity.name)
        await self.db.delete(entity)
        await self.db.commit()

    # ── Document types ──────────────────────────────────────────────────────

    async def list_document_types(self) -> list[DocumentType]:
        result = await self.db.execute(select(DocumentType).order_by(DocumentType.name))
        return list(result.scalars().all())

    async def create_document_type(self, name: str) -> DocumentType:
        await self._check_unique(DocumentType, name)
        entity = DocumentType(name=name.strip())
        self.db.add(entity)
        await self._commit_or_conflict(name)
        await self.db.refresh(entity)
        return entity

    async def rename_document_type(self, type_id: uuid.UUID, new_name: str) -> DocumentType:
        entity = await self._get_or_404(DocumentType, type_id)
        await self._check_unique(DocumentType, new_name, exclude_id=type_id)
        old_name = entity.name
        entity.name = new_name.strip()
        await self.db.execute(
            update(Document).where(Document.document_type == old_name).values(document_type=entity.name)
        )
        await self._commit_or_conflict(new_name)
        await self.db.refresh(entity)
        return entity

    async def delete_document_type(self, type_id: uuid.UUID) -> None:
        entity = await self._get_or_404(DocumentType, type_id)
        await self._guard_in_use(Document.document_type, entity.name)
        await self.db.delete(entity)
        await self.db.commit()
