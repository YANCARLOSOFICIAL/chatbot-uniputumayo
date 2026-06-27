from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.rag import SearchRequest, SearchResponse
from app.services.rag_service import RAGService
from app.auth import require_admin
from app.models.user import User

router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin-only: exposes the raw RAG retrieval for testing and debugging."""
    service = RAGService(db)
    return await service.search(request)
