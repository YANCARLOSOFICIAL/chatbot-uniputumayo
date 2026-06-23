from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import require_admin
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message

router = APIRouter()

# Abreviaciones de días en español (lunes=0 … domingo=6)
_DAYS_ES = ["L", "M", "X", "J", "V", "S", "D"]


@router.get("/overview")
async def analytics_overview(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    # ── Totales globales ─────────────────────────────────────────────────
    total_conv = (await db.execute(
        select(func.count(Conversation.id)).where(Conversation.is_active.is_(True))
    )).scalar() or 0

    total_msg = (await db.execute(
        select(func.count(Message.id))
    )).scalar() or 0

    unique_users = (await db.execute(
        select(func.count(func.distinct(Conversation.user_id)))
        .where(Conversation.user_id.isnot(None))
    )).scalar() or 0

    avg_rt_ms = (await db.execute(
        select(func.avg(Message.response_time_ms))
        .where(Message.role == "assistant")
        .where(Message.response_time_ms.isnot(None))
    )).scalar()

    # ── Tasa de resolución (% conversaciones con respuesta del asistente) ─
    conv_with_reply = (await db.execute(
        select(func.count(func.distinct(Message.conversation_id)))
        .where(Message.role == "assistant")
    )).scalar() or 0
    resolution_rate = round(conv_with_reply / total_conv * 100, 1) if total_conv else 0.0

    # ── Variación semanal (esta semana vs la anterior) ───────────────────
    this_week = (await db.execute(
        select(func.count(Conversation.id))
        .where(Conversation.created_at >= week_ago)
    )).scalar() or 0

    last_week = (await db.execute(
        select(func.count(Conversation.id))
        .where(and_(
            Conversation.created_at >= two_weeks_ago,
            Conversation.created_at < week_ago,
        ))
    )).scalar() or 0

    # ── Conversaciones por día (últimos 7 días) ──────────────────────────
    rows = (await db.execute(text("""
        SELECT
            DATE(created_at AT TIME ZONE 'UTC') AS day,
            COUNT(*) AS cnt
        FROM conversations
        WHERE created_at >= :since
        GROUP BY day
        ORDER BY day
    """), {"since": week_ago})).fetchall()

    daily_map = {str(r.day): int(r.cnt) for r in rows}
    conversations_per_day = []
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).date()
        conversations_per_day.append({
            "date": str(d),
            "label": _DAYS_ES[d.weekday()],
            "count": daily_map.get(str(d), 0),
        })

    # ── Consultas más frecuentes (últimas 200 user messages) ────────────
    recent_qs = (await db.execute(
        select(Message.content)
        .where(Message.role == "user")
        .order_by(Message.created_at.desc())
        .limit(200)
    )).scalars().all()

    freq: dict[str, int] = {}
    for q in recent_qs:
        key = q.strip()[:80]
        freq[key] = freq.get(key, 0) + 1

    top_queries = [
        {"label": k, "count": v}
        for k, v in sorted(freq.items(), key=lambda x: -x[1])[:5]
    ]

    return {
        "total_conversations": total_conv,
        "total_messages": total_msg,
        "unique_users": unique_users,
        "avg_response_time_s": round(avg_rt_ms / 1000, 1) if avg_rt_ms else None,
        "resolution_rate": resolution_rate,
        "this_week_conversations": this_week,
        "last_week_conversations": last_week,
        "conversations_per_day": conversations_per_day,
        "top_queries": top_queries,
    }
