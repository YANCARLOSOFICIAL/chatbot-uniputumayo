from fastapi import APIRouter, Depends

from app.runtime_config import runtime_config
from app.auth import require_admin
from app.models.user import User

router = APIRouter()


@router.get("/llm")
async def get_llm_config(admin: User = Depends(require_admin)):
    return {
        "default_provider": runtime_config.default_llm_provider,
        "default_model": (
            runtime_config.ollama_default_model
            if runtime_config.default_llm_provider == "ollama"
            else runtime_config.openai_default_model
        ),
        "temperature": runtime_config.default_temperature,
        "max_tokens": runtime_config.default_max_tokens,
    }
