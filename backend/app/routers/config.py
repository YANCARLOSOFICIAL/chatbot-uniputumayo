from fastapi import APIRouter, Depends

from app.runtime_config import runtime_config
from app.auth import require_admin
from app.models.user import User
from app.utils.cache import answer_cache

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
