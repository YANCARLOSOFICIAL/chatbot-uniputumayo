from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.schemas.llm import (
    GenerateRequest,
    GenerateResponse,
    EmbedRequest,
    EmbedResponse,
    ProvidersResponse,
    LLMConfigUpdate,
)
from app.services.llm_service import LLMService
from app.auth import require_admin
from app.models.user import User
from app.runtime_config import runtime_config
from app.providers.provider_factory import ProviderFactory

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
async def update_config(config: LLMConfigUpdate, admin: User = Depends(require_admin)):
    service = LLMService()
    return await service.update_config(config)


# ── API Key management ──


class ApiKeyRequest(BaseModel):
    provider: str
    api_key: str


@router.post("/api-key")
async def set_api_key(data: ApiKeyRequest, admin: User = Depends(require_admin)):
    if data.provider != "openai":
        return {"success": False, "is_available": False, "detail": "Solo se soporta OpenAI"}

    runtime_config.openai_api_key = data.api_key
    ProviderFactory.reset_provider("openai")

    # Test connection
    provider = ProviderFactory.get_provider("openai")
    is_available = await provider.is_available()

    return {"success": True, "is_available": is_available}


@router.get("/api-key-status")
async def get_api_key_status(admin: User = Depends(require_admin)):
    key = runtime_config.openai_api_key
    if key and key != "sk-your-key-here":
        masked = f"{key[:7]}...{key[-4:]}" if len(key) > 11 else "***"
        return {"has_key": True, "masked_key": masked}
    return {"has_key": False, "masked_key": None}
