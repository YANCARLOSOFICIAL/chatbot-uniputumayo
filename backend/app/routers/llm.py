import asyncio
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.llm import (
    GenerateRequest,
    GenerateResponse,
    EmbedRequest,
    EmbedResponse,
    ProvidersResponse,
    LLMConfigUpdate,
    ModelIdRequest,
    OllamaPullStatus,
)
from app.services.llm_service import LLMService
from app.services.llm_config_store import persist_runtime_config
from app.auth import require_admin
from app.models.user import User
from app.database import get_db
from app.runtime_config import runtime_config
from app.providers.provider_factory import ProviderFactory

router = APIRouter()

# An Ollama model/tag name: "qwen2.5:7b", "library/llama3.2:1b-instruct-q4".
_OLLAMA_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/\-]{0,127}(:[A-Za-z0-9._\-]{1,64})?$")


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest, _: User = Depends(require_admin)):
    service = LLMService()
    return await service.generate(request)


@router.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest, _: User = Depends(require_admin)):
    service = LLMService()
    return await service.embed(request)


@router.get("/providers", response_model=ProvidersResponse)
async def get_providers():
    service = LLMService()
    return await service.get_providers()


@router.put("/config")
async def update_config(
    config: LLMConfigUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    service = LLMService()
    result = await service.update_config(config)
    await persist_runtime_config(db)
    return result


# ── OpenAI model list (admin-editable, survives restarts) ──


@router.get("/config/openai-models/discover")
async def discover_openai_models(admin: User = Depends(require_admin)):
    return await LLMService().discover_openai_models()


@router.post("/config/openai-models")
async def add_openai_model(
    data: ModelIdRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await LLMService().add_openai_model(data.model)
    if result.get("success"):
        await persist_runtime_config(db)
    return result


@router.delete("/config/openai-models")
async def remove_openai_model(
    model: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = LLMService().remove_openai_model(model)
    if result.get("success"):
        await persist_runtime_config(db)
    return result


# ── Ollama model download ──

_pull_tasks: set[asyncio.Task] = set()
_pull_state: dict = {"active": False, "model": None, "status": "idle", "percent": 0, "error": None}


async def _run_ollama_pull(model: str) -> None:
    _pull_state.update(active=True, model=model, status="starting", percent=0, error=None)

    def on_progress(data: dict) -> None:
        status = data.get("status") or _pull_state["status"]
        total, completed = data.get("total"), data.get("completed")
        percent = int(completed / total * 100) if total and completed else _pull_state["percent"]
        _pull_state.update(status=status, percent=percent)

    try:
        provider = ProviderFactory.get_provider("ollama")
        await provider.pull_model(model, on_progress)
        _pull_state.update(status="success", percent=100)
    except Exception as e:
        _pull_state.update(status="error", error=str(e) or repr(e))
    finally:
        _pull_state["active"] = False


@router.post("/ollama/pull")
async def ollama_pull(data: ModelIdRequest, admin: User = Depends(require_admin)):
    model = data.model.strip()
    if not _OLLAMA_NAME_RE.match(model):
        raise HTTPException(status_code=400, detail="Nombre de modelo inválido.")
    if _pull_state["active"]:
        raise HTTPException(
            status_code=409,
            detail=f"Ya hay una descarga en curso ({_pull_state['model']}). Espera a que termine.",
        )
    task = asyncio.create_task(_run_ollama_pull(model), name=f"admin-pull-{model}")
    _pull_tasks.add(task)
    task.add_done_callback(_pull_tasks.discard)
    return {"started": True, "model": model}


@router.get("/ollama/pull/status", response_model=OllamaPullStatus)
async def ollama_pull_status(admin: User = Depends(require_admin)):
    return _pull_state


@router.delete("/ollama/models")
async def ollama_remove_model(model: str, admin: User = Depends(require_admin)):
    if not _OLLAMA_NAME_RE.match(model.strip()):
        raise HTTPException(status_code=400, detail="Nombre de modelo inválido.")
    return await LLMService().remove_ollama_model(model)


# ── API Key management ──


class ApiKeyRequest(BaseModel):
    provider: str
    api_key: str


@router.post("/api-key")
async def set_api_key(
    data: ApiKeyRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if data.provider != "openai":
        return {"success": False, "is_available": False, "detail": "Solo se soporta OpenAI"}

    runtime_config.openai_api_key = data.api_key
    ProviderFactory.reset_provider("openai")

    # Test connection
    provider = ProviderFactory.get_provider("openai")
    is_available = await provider.is_available()

    await persist_runtime_config(db)

    return {"success": True, "is_available": is_available}


@router.get("/api-key-status")
async def get_api_key_status(admin: User = Depends(require_admin)):
    key = runtime_config.openai_api_key
    if key and key != "sk-your-key-here":
        masked = f"{key[:7]}...{key[-4:]}" if len(key) > 11 else "***"
        return {"has_key": True, "masked_key": masked}
    return {"has_key": False, "masked_key": None}
