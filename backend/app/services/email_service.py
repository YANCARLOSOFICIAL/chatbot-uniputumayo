import asyncio
import logging

import resend

from app.config import settings
from app.runtime_config import runtime_config

logger = logging.getLogger(__name__)


def _send_password_reset_sync(to_email: str, reset_link: str) -> None:
    resend.api_key = runtime_config.resend_api_key
    resend.Emails.send({
        "from": runtime_config.resend_from_email,
        "to": [to_email],
        "subject": "Recupera tu contraseña — Guaca",
        "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
                <h2 style="color: #0b3447;">Recupera tu contraseña</h2>
                <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>Guaca</strong>, el asistente virtual de UniPutumayo.</p>
                <p>
                    <a href="{reset_link}" style="display: inline-block; padding: 12px 24px; background: #1b6e94; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Crear nueva contraseña
                    </a>
                </p>
                <p style="font-size: 13px; color: #555;">Este enlace expira en {settings.password_reset_expire_minutes} minutos y solo puede usarse una vez.</p>
                <p style="font-size: 13px; color: #555;">Si no solicitaste este cambio, puedes ignorar este correo — tu contraseña actual seguirá funcionando.</p>
            </div>
        """,
    })


async def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """Send the reset link via Resend. Raises on failure — caller decides how to handle it."""
    if not runtime_config.resend_api_key:
        logger.warning("Resend no configurado (falta API key en /admin/config) — no se envió el correo. Link: %s", reset_link)
        return
    await asyncio.to_thread(_send_password_reset_sync, to_email, reset_link)


def _verify_api_key_sync(api_key: str) -> bool:
    """Domains.list() needs full-access scope — send-only keys (the common
    case for a password-recovery-only integration) reject it with a
    recognizable "restricted to only send emails" message, which still means
    the key IS valid, just narrowly scoped. Only a genuinely bad key (empty,
    revoked, malformed) raises some other error.
    """
    resend.api_key = api_key
    try:
        resend.Domains.list()
        return True
    except Exception as e:
        return "restricted to only send emails" in str(e)


async def verify_resend_api_key(api_key: str) -> bool:
    return await asyncio.to_thread(_verify_api_key_sync, api_key)
