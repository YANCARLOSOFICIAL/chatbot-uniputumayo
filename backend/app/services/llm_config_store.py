"""Persists the in-memory `runtime_config` singleton to the `llm_configurations`
table so admin panel changes (provider/model/temperature/API key) survive a
backend restart or redeploy instead of silently reverting to `.env` defaults.

One row per provider ("ollama", "openai"); `is_default` marks which provider
is currently active, `model_name` its default model, and `config` (JSONB)
holds the rest (temperature, max_tokens, api_key — only relevant on the
active/openai row respectively).
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_configuration import LLMConfiguration
from app.runtime_config import runtime_config

logger = logging.getLogger(__name__)

_PROVIDERS = ("ollama", "openai")


async def load_into_runtime_config(db: AsyncSession) -> None:
    """Apply any persisted configuration on top of the .env-derived defaults.

    Safe to call even on a fresh DB with no rows — runtime_config keeps
    whatever `app/config.py` settings it was constructed with.
    """
    try:
        result = await db.execute(select(LLMConfiguration))
        rows = {row.provider: row for row in result.scalars().all()}
    except Exception as e:
        logger.warning("Could not load persisted LLM config (non-fatal): %s", e)
        return

    for provider, row in rows.items():
        if row.model_name:
            runtime_config.set_model(provider, row.model_name)
        cfg = row.config or {}
        if provider == "openai" and cfg.get("api_key"):
            runtime_config.openai_api_key = cfg["api_key"]
        if row.is_default:
            runtime_config.default_llm_provider = provider
        if "temperature" in cfg:
            runtime_config.default_temperature = cfg["temperature"]
        if "max_tokens" in cfg:
            runtime_config.default_max_tokens = cfg["max_tokens"]

    if rows:
        logger.info("Loaded persisted LLM config — active provider: %s", runtime_config.default_llm_provider)


async def _get_or_create(db: AsyncSession, provider: str) -> LLMConfiguration:
    result = await db.execute(select(LLMConfiguration).where(LLMConfiguration.provider == provider))
    row = result.scalar_one_or_none()
    if row is None:
        row = LLMConfiguration(provider=provider, model_name="", config={})
        db.add(row)
    return row


async def persist_runtime_config(db: AsyncSession) -> None:
    """Snapshot the current runtime_config state into `llm_configurations`."""
    try:
        for provider in _PROVIDERS:
            row = await _get_or_create(db, provider)
            row.model_name = runtime_config.resolve_model(provider)
            row.is_default = (provider == runtime_config.default_llm_provider)
            cfg = dict(row.config or {})
            cfg["temperature"] = runtime_config.default_temperature
            cfg["max_tokens"] = runtime_config.default_max_tokens
            if provider == "openai" and runtime_config.openai_api_key:
                cfg["api_key"] = runtime_config.openai_api_key
            row.config = cfg
        await db.commit()
    except Exception as e:
        logger.warning("Could not persist LLM config (non-fatal): %s", e)
        await db.rollback()
