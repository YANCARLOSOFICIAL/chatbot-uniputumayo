from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.runtime_config import runtime_config
from app.auth import require_admin
from app.models.user import User
from app.utils.cache import answer_cache
from app.services.email_service import verify_resend_api_key
from app.services.email_config_store import persist_runtime_config as persist_email_config

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


@router.post("/invalidate-answer-cache")
async def invalidate_answer_cache(admin: User = Depends(require_admin)):
    """Clear all cached final answers.

    Needed because the answer-cache is checked before any other logic
    (including the program/faculty clarification heuristic) — an answer
    cached under old behavior keeps being served as-is until it expires or
    is cleared here, so this gives admins a one-click way to force fresh
    answers (e.g. right after deploying a change to that heuristic) instead
    of needing shell/redis-cli access.
    """
    await answer_cache.invalidate_all()
    return {"status": "ok"}


# ── Resend (recuperación de contraseña) ──


class EmailKeyRequest(BaseModel):
    api_key: str
    from_email: str


@router.post("/email-key")
async def set_email_key(
    data: EmailKeyRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    is_valid = await verify_resend_api_key(data.api_key)

    runtime_config.resend_api_key = data.api_key
    runtime_config.resend_from_email = data.from_email
    await persist_email_config(db)

    return {"success": True, "is_valid": is_valid}


@router.get("/email-key-status")
async def get_email_key_status(admin: User = Depends(require_admin)):
    key = runtime_config.resend_api_key
    if key:
        masked = f"{key[:7]}...{key[-4:]}" if len(key) > 11 else "***"
        return {"has_key": True, "masked_key": masked, "from_email": runtime_config.resend_from_email}
    return {"has_key": False, "masked_key": None, "from_email": runtime_config.resend_from_email}
