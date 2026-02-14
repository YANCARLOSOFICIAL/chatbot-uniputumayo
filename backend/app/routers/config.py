from fastapi import APIRouter

from app.schemas.llm import LLMConfigUpdate

router = APIRouter()


@router.get("/llm")
async def get_llm_config():
    from app.config import settings
    return {
        "default_provider": settings.default_llm_provider,
        "default_model": (
            settings.ollama_default_model
            if settings.default_llm_provider == "ollama"
            else settings.openai_default_model
        ),
        "temperature": settings.default_temperature,
        "max_tokens": settings.default_max_tokens,
    }


@router.put("/llm")
async def update_llm_config(config: LLMConfigUpdate):
    return {"success": True, "config": config.model_dump(exclude_none=True)}
