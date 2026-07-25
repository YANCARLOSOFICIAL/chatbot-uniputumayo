from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class DocumentUploadResponse(BaseModel):
    document_id: UUID | None = None
    status: str
    message: str


class DocumentMetadataUpdate(BaseModel):
    """PATCH body for editing an already-uploaded document's taxonomy fields.

    Fields default to unset (not None) so a client can update just one field
    (e.g. only `program`) without accidentally clearing the others — see
    DocumentService.update_metadata.
    """
    faculty: str | None = None
    program: str | None = None
    document_type: str | None = None

    model_config = {"extra": "forbid"}


class DocumentResponse(BaseModel):
    id: UUID
    title: str
    file_name: str
    file_type: str
    file_size_bytes: int | None
    faculty: str | None
    program: str | None
    document_type: str | None
    ingestion_status: str
    total_chunks: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChunkResponse(BaseModel):
    id: UUID
    document_id: UUID
    chunk_index: int
    content: str
    token_count: int | None
    metadata: dict | None = Field(None, alias="metadata_")
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}
