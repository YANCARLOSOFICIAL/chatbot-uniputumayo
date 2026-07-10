import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.rag_eval_run import RagEvalRun
from app.models.user import User
from app.auth import require_admin
from app.schemas.rag_eval import RagEvalRunSummary, RagEvalRunDetail
from app.services.rag_eval_service import run_eval

logger = logging.getLogger(__name__)

router = APIRouter()

# Strong references so GC doesn't collect an in-flight eval task (same
# pattern as documents.py's _ingestion_tasks).
_eval_tasks: set[asyncio.Task] = set()


async def _run_and_store(run_id: UUID) -> None:
    """Background task: run the eval set and persist results to `run_id`'s row.

    Opens its own session — the request-scoped session passed to the router
    closes when the POST /run request returns, long before the LLM calls
    (potentially minutes on CPU-only Ollama) finish.
    """
    async with async_session() as db:
        result = await db.execute(select(RagEvalRun).where(RagEvalRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            logger.warning("Eval run %s vanished before it could start", run_id)
            return
        try:
            summary = await run_eval(db)
            run.status = "completed"
            run.passed = summary.passed
            run.total = summary.total
            run.avg_retrieval_ms = summary.avg_retrieval_ms
            run.avg_generation_ms = summary.avg_generation_ms
            run.results = [r.to_dict() for r in summary.results]
        except Exception as e:
            logger.error("RAG eval run %s failed: %s", run_id, e, exc_info=True)
            run.status = "failed"
            run.error_message = str(e)
        run.completed_at = datetime.now(timezone.utc)
        await db.commit()


@router.post("/run", response_model=RagEvalRunSummary)
async def start_eval_run(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Kick off a RAG evaluation run in the background and return immediately.

    Each case does at least one full LLM generation — on CPU-only Ollama this
    can take minutes for the whole set, well past any reasonable HTTP timeout,
    so this returns a "running" row right away; poll GET /{run_id} for status.
    """
    run = RagEvalRun(status="running")
    db.add(run)
    await db.commit()
    await db.refresh(run)

    task = asyncio.create_task(_run_and_store(run.id), name=f"rag-eval-{run.id}")
    _eval_tasks.add(task)
    task.add_done_callback(_eval_tasks.discard)

    return run


@router.get("", response_model=list[RagEvalRunSummary])
async def list_eval_runs(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(RagEvalRun).order_by(desc(RagEvalRun.created_at)).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{run_id}", response_model=RagEvalRunDetail)
async def get_eval_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(RagEvalRun).where(RagEvalRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Eval run not found")
    return run
