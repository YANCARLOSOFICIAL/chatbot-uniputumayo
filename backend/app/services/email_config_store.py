"""Persists the Resend API key/from-email set via /admin/config to the
single-row `email_configurations` table, mirroring llm_config_store.py.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_configuration import EmailConfiguration
from app.runtime_config import runtime_config

logger = logging.getLogger(__name__)


async def load_into_runtime_config(db: AsyncSession) -> None:
    try:
        result = await db.execute(select(EmailConfiguration))
        row = result.scalars().first()
    except Exception as e:
        logger.warning("Could not load persisted email config (non-fatal): %s", e)
        return

    if row and row.config:
        if row.config.get("api_key"):
            runtime_config.resend_api_key = row.config["api_key"]
        if row.config.get("from_email"):
            runtime_config.resend_from_email = row.config["from_email"]


async def _get_or_create_row(db: AsyncSession) -> EmailConfiguration:
    result = await db.execute(select(EmailConfiguration))
    row = result.scalars().first()
    if row is None:
        row = EmailConfiguration(config={})
        db.add(row)
    return row


async def persist_runtime_config(db: AsyncSession) -> None:
    try:
        row = await _get_or_create_row(db)
        row.config = {
            "api_key": runtime_config.resend_api_key,
            "from_email": runtime_config.resend_from_email,
        }
        await db.commit()
    except Exception as e:
        logger.warning("Could not persist email config (non-fatal): %s", e)
        await db.rollback()
