import hashlib
import os
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.schemas.document import DocumentUploadResponse
from app.utils.file_parsers import extract_text
from app.utils.text_processing import clean_text
from app.utils.chunking import chunk_text
from app.services.llm_service import LLMService
from app.schemas.llm import EmbedRequest
from app.config import settings


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upload_and_process(
        self,
        file: UploadFile,
        title: str,
        faculty: str | None = None,
        program: str | None = None,
        document_type: str | None = None,
    ) -> DocumentUploadResponse:
        # 1. Read file content
        content_bytes = await file.read()
        file_type = file.filename.rsplit(".", 1)[-1].lower() if file.filename else "txt"
        content_hash = hashlib.sha256(content_bytes).hexdigest()

        # 2. Save file to disk
        os.makedirs(settings.upload_dir, exist_ok=True)
        file_path = os.path.join(settings.upload_dir, file.filename or "document.txt")
        with open(file_path, "wb") as f:
            f.write(content_bytes)

        # 3. Create document record
        document = Document(
            title=title,
            file_name=file.filename or "document.txt",
            file_type=file_type,
            file_size_bytes=len(content_bytes),
            faculty=faculty,
            program=program,
            document_type=document_type,
            content_hash=content_hash,
            ingestion_status="processing",
        )
        self.db.add(document)
        await self.db.flush()

        try:
            # 4. Extract text
            raw_text = extract_text(file_path, file_type)
            cleaned_text = clean_text(raw_text)

            # 5. Chunk text
            chunks = chunk_text(
                cleaned_text,
                chunk_size=settings.chunk_size,
                chunk_overlap=settings.chunk_overlap,
            )

            # 6. Generate embeddings
            llm_service = LLMService()
            batch_size = 20
            all_embeddings = []

            for i in range(0, len(chunks), batch_size):
                batch = chunks[i : i + batch_size]
                embed_response = await llm_service.embed(
                    EmbedRequest(texts=[c["content"] for c in batch])
                )
                all_embeddings.extend(embed_response.embeddings)

            # 7. Store chunks with embeddings
            for idx, (chunk, embedding) in enumerate(zip(chunks, all_embeddings)):
                db_chunk = DocumentChunk(
                    document_id=document.id,
                    chunk_index=idx,
                    content=chunk["content"],
                    token_count=chunk.get("token_count"),
                    embedding=embedding,
                    metadata_=chunk.get("metadata", {}),
                )
                self.db.add(db_chunk)

            document.ingestion_status = "completed"
            document.total_chunks = len(chunks)
            await self.db.commit()

            return DocumentUploadResponse(
                document_id=document.id,
                status="completed",
                message=f"Document processed successfully. {len(chunks)} chunks created.",
            )

        except Exception as e:
            document.ingestion_status = "failed"
            await self.db.commit()
            return DocumentUploadResponse(
                document_id=document.id,
                status="failed",
                message=f"Error processing document: {str(e)}",
            )

    async def list_documents(
        self,
        status: str | None = None,
        program: str | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> list[Document]:
        query = select(Document)
        if status:
            query = query.where(Document.ingestion_status == status)
        if program:
            query = query.where(Document.program == program)
        query = query.order_by(desc(Document.created_at))
        query = query.limit(per_page).offset((page - 1) * per_page)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_document(self, document_id: UUID) -> Document | None:
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        return result.scalar_one_or_none()

    async def delete_document(self, document_id: UUID) -> bool:
        doc = await self.get_document(document_id)
        if not doc:
            return False
        await self.db.delete(doc)
        await self.db.commit()
        return True

    async def get_chunks(
        self, document_id: UUID, page: int = 1, per_page: int = 20
    ) -> list[DocumentChunk]:
        result = await self.db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index)
            .limit(per_page)
            .offset((page - 1) * per_page)
        )
        return list(result.scalars().all())

    async def reindex(self, document_id: UUID) -> DocumentUploadResponse:
        doc = await self.get_document(document_id)
        if not doc:
            return DocumentUploadResponse(
                document_id=document_id,
                status="failed",
                message="Document not found",
            )

        # Delete existing chunks
        existing_chunks = await self.get_chunks(document_id, per_page=10000)
        for chunk in existing_chunks:
            await self.db.delete(chunk)
        await self.db.flush()

        # Re-process
        file_path = os.path.join(settings.upload_dir, doc.file_name)
        if not os.path.exists(file_path):
            return DocumentUploadResponse(
                document_id=document_id,
                status="failed",
                message="Original file not found on disk",
            )

        doc.ingestion_status = "processing"
        await self.db.flush()

        try:
            raw_text = extract_text(file_path, doc.file_type)
            cleaned_text = clean_text(raw_text)
            chunks = chunk_text(cleaned_text)

            llm_service = LLMService()
            all_embeddings = []
            batch_size = 20

            for i in range(0, len(chunks), batch_size):
                batch = chunks[i : i + batch_size]
                embed_response = await llm_service.embed(
                    EmbedRequest(texts=[c["content"] for c in batch])
                )
                all_embeddings.extend(embed_response.embeddings)

            for idx, (chunk, embedding) in enumerate(zip(chunks, all_embeddings)):
                db_chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    content=chunk["content"],
                    token_count=chunk.get("token_count"),
                    embedding=embedding,
                    metadata_=chunk.get("metadata", {}),
                )
                self.db.add(db_chunk)

            doc.ingestion_status = "completed"
            doc.total_chunks = len(chunks)
            await self.db.commit()

            return DocumentUploadResponse(
                document_id=doc.id,
                status="completed",
                message=f"Reindexed successfully. {len(chunks)} chunks created.",
            )
        except Exception as e:
            doc.ingestion_status = "failed"
            await self.db.commit()
            return DocumentUploadResponse(
                document_id=doc.id,
                status="failed",
                message=f"Reindex failed: {str(e)}",
            )
