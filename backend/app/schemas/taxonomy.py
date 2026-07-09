from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class TaxonomyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class TaxonomyRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class FacultyResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProgramCreate(TaxonomyCreate):
    faculty_id: UUID | None = None


class ProgramResponse(BaseModel):
    id: UUID
    name: str
    faculty_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentTypeResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
