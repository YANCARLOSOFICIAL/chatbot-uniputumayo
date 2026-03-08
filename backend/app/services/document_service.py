import base64
import hashlib
import logging
import os
from uuid import UUID

import httpx

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

logger = logging.getLogger(__name__)


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _extract_pdf_with_vision(self, file_path: str) -> str:
        """Render PDF pages as images and send them to the vision model for structured extraction."""
        if not settings.ollama_vision_model:
            return ""
        try:
            import fitz  # PyMuPDF already in requirements

            images_b64: list[str] = []
            with fitz.open(file_path) as doc:
                for page_num in range(min(4, len(doc))):
                    page = doc[page_num]
                    # 2x zoom → better resolution for table reading
                    pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
                    img_b64 = base64.b64encode(pix.tobytes("png")).decode()
                    images_b64.append(img_b64)

            if not images_b64:
                return ""

            prompt = (
                "Este documento es un plan de estudios universitario. "
                "Extrae TODAS las materias organizadas por semestre usando este formato EXACTO:\n\n"
                "SEMESTRE 1: Nombre Materia 1, Nombre Materia 2, Nombre Materia 3\n"
                "SEMESTRE 2: Nombre Materia 1, Nombre Materia 2, Nombre Materia 3\n"
                "...\n\n"
                "INSTRUCCIONES IMPORTANTES:\n"
                "- Los encabezados de columna I, II, III, IV, V, VI, VII, VIII, IX, X representan semestres (I=1, II=2, etc.).\n"
                "- Incluye SOLO los nombres de materias, no códigos (TD101, BAS01...) ni créditos ni horas.\n"
                "- Si una materia aparece en la columna III, pertenece al SEMESTRE 3.\n"
                "- Responde ÚNICAMENTE con las líneas 'SEMESTRE N: ...' sin texto adicional."
            )

            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{settings.ollama_base_url}/api/chat",
                    json={
                        "model": settings.ollama_vision_model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt,
                                "images": images_b64,
                            }
                        ],
                        "stream": False,
                        "options": {"temperature": 0.0, "num_predict": 1200},
                    },
                )

            if response.status_code != 200:
                logger.warning(f"Vision model returned {response.status_code}")
                return ""

            result = response.json().get("message", {}).get("content", "").strip()
            if "SEMESTRE" not in result.upper():
                logger.warning("Vision model did not return expected curriculum format")
                return ""

            logger.info(f"Vision extraction OK — {len(result)} chars extracted")
            return result

        except Exception as e:
            logger.warning(f"PDF vision extraction failed: {e}")
            return ""

    async def _enrich_curriculum_text(self, text: str) -> str:
        """Use Ollama to generate a structured semester-by-semester summary from curriculum text."""
        try:
            from app.providers.provider_factory import ProviderFactory
            from app.runtime_config import runtime_config

            provider = ProviderFactory.get_provider("ollama")
            extraction_prompt = (
                "Analiza este texto extraído de un plan de estudios universitario y extrae las materias por semestre.\n"
                "INSTRUCCIONES:\n"
                "1. Si es un plan de estudios, lista las materias en formato exacto:\n"
                "SEMESTRE 1: [Materia 1], [Materia 2], [Materia 3]\n"
                "SEMESTRE 2: [Materia 1], [Materia 2], [Materia 3]\n"
                "... (hasta el último semestre)\n"
                "2. Códigos como TD101, BAS01, IS701 van seguidos de nombres de materias.\n"
                "3. Si NO es un plan de estudios, responde únicamente: NO_ES_CURRICULUM\n"
                "Texto a analizar:\n"
            )
            result = await provider.generate(
                messages=[{"role": "user", "content": extraction_prompt + text[:4000]}],
                model=runtime_config.ollama_default_model,
                temperature=0.0,
                max_tokens=800,
            )
            summary = result.get("content", "").strip()
            if not summary or "NO_ES_CURRICULUM" in summary or "SEMESTRE" not in summary.upper():
                return ""
            logger.info("Curriculum enrichment generated successfully")
            return summary
        except Exception as e:
            logger.warning(f"Could not enrich curriculum text: {e}")
            return ""

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

            # 4b. Vision-based extraction for PDFs (most accurate for tables)
            structured_summary = ""
            if file_type == "pdf":
                structured_summary = await self._extract_pdf_with_vision(file_path)

            # 4c. Fall back to LLM text enrichment if vision failed/unavailable
            if not structured_summary:
                structured_summary = await self._enrich_curriculum_text(cleaned_text)

            if structured_summary:
                logger.info("Prepending structured curriculum summary to document text")
                cleaned_text = (
                    "=== RESUMEN DE MATERIAS POR SEMESTRE ===\n"
                    + structured_summary
                    + "\n=== FIN DEL RESUMEN ===\n\n"
                    + cleaned_text
                )

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

            structured_summary = ""
            if doc.file_type == "pdf":
                structured_summary = await self._extract_pdf_with_vision(file_path)

            if not structured_summary:
                structured_summary = await self._enrich_curriculum_text(cleaned_text)

            if structured_summary:
                logger.info("Prepending structured curriculum summary (reindex)")
                cleaned_text = (
                    "=== RESUMEN DE MATERIAS POR SEMESTRE ===\n"
                    + structured_summary
                    + "\n=== FIN DEL RESUMEN ===\n\n"
                    + cleaned_text
                )

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
