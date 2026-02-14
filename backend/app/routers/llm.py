from fastapi import APIRouter

from app.schemas.llm import (
    GenerateRequest,
    GenerateResponse,
    EmbedRequest,
    EmbedResponse,
    ProvidersResponse,
    LLMConfigUpdate,
)
from app.services.llm_service import LLMService

router = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    service = LLMService()
    return await service.generate(request)


@router.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    service = LLMService()
    return await service.embed(request)


@router.get("/providers", response_model=ProvidersResponse)
async def get_providers():
    service = LLMService()
    return await service.get_providers()


@router.put("/config")
async def update_config(config: LLMConfigUpdate):
    service = LLMService()
    return await service.update_config(config)
