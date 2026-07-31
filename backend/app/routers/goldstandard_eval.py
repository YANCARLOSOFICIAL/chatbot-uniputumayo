import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.gold_eval_run import GoldEvalRun
from app.models.user import User
from app.auth import require_admin
from app.schemas.goldstandard_eval import GoldEvalRunSummary, GoldEvalRunDetail
from app.services.goldstandard_eval_service import run_gold_comparison
from app.providers.provider_factory import ProviderFactory
from app.runtime_config import runtime_config
from app.utils.cache import answer_cache

logger = logging.getLogger(__name__)

router = APIRouter()

# Strong references so GC doesn't collect an in-flight eval task (same
# pattern as documents.py's _ingestion_tasks / rag_eval.py's _eval_tasks).
_eval_tasks: set[asyncio.Task] = set()


async def _run_and_store(run_id: UUID, file_bytes: bytes, k: int) -> None:
    """Background task — a full run is 1 retrieval pass + 2 provider passes
    (each with a real LLM generation + judge call) over the whole query bank,
    easily minutes on CPU-only Ollama. Opens its own session since the
    request-scoped one closes when POST /run returns.
    """
    async with async_session() as db:
        result = await db.execute(select(GoldEvalRun).where(GoldEvalRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            logger.warning("Gold eval run %s vanished before it could start", run_id)
            return
        # The answer cache is shared and similarity-based by design (see
        # AsyncAnswerCache) — fine for real traffic, but during a gold-eval
        # comparison it would let one provider's pass serve cached answers to
        # the other's (or to a repeated query within the same pass), which
        # would silently invalidate the comparison. Disabled for the run's
        # duration only, always re-enabled in finally.
        answer_cache.disable()
        try:
            providers = [
                ("ollama", runtime_config.resolve_model("ollama")),
                ("openai", runtime_config.resolve_model("openai")),
            ]
            comparison = await run_gold_comparison(db, file_bytes, k, providers)
            run.total_queries = comparison.total_queries
            run.results = {
                "retrieval": comparison.retrieval.__dict__,
                "generations": [g.__dict__ for g in comparison.generations],
            }
            run.status = "completed"
        except Exception as e:
            logger.error("Gold eval run %s failed: %s", run_id, e, exc_info=True)
            run.status = "failed"
            run.error_message = str(e) or repr(e)
        finally:
            answer_cache.enable()
        run.completed_at = datetime.now(timezone.utc)
        await db.commit()


@router.post("/run", response_model=GoldEvalRunSummary)
async def start_gold_eval_run(
    file: UploadFile = File(...),
    k: int = 5,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un .xlsx")

    openai_provider = ProviderFactory.get_provider("openai")
    if not await openai_provider.is_available():
        raise HTTPException(
            status_code=400,
            detail="OpenAI no está configurado (falta API key en /admin/config) — se necesita para la comparación con Ollama.",
        )

    file_bytes = await file.read()

    run = GoldEvalRun(status="running", k=k, total_queries=0)
    db.add(run)
    await db.commit()
    await db.refresh(run)

    task = asyncio.create_task(_run_and_store(run.id, file_bytes, k), name=f"gold-eval-{run.id}")
    _eval_tasks.add(task)
    task.add_done_callback(_eval_tasks.discard)

    return run


@router.get("", response_model=list[GoldEvalRunSummary])
async def list_gold_eval_runs(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(GoldEvalRun).order_by(desc(GoldEvalRun.created_at)).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{run_id}", response_model=GoldEvalRunDetail)
async def get_gold_eval_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(GoldEvalRun).where(GoldEvalRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


def _render_markdown_report(run: GoldEvalRun) -> str:
    r = run.results or {}
    retrieval = r.get("retrieval", {})
    lines = [
        f"# Evaluación GoldStandard — {run.created_at.strftime('%Y-%m-%d %H:%M')} UTC",
        "",
        f"Total de consultas: {run.total_queries} · k = {run.k}",
        "",
        "## Retrieval (independiente del proveedor de generación)",
        "",
        "| Métrica | Valor |",
        "|---|---|",
        f"| Precision@{run.k} | {retrieval.get('mean_precision_at_k', 0):.3f} |",
        f"| Recall@{run.k} | {retrieval.get('mean_recall_at_k', 0):.3f} |",
        f"| MRR | {retrieval.get('mrr', 0):.3f} |",
        f"| Hit rate | {retrieval.get('hit_rate', 0):.3f} |",
        f"| Casos evaluados (dentro de alcance con documento esperado) | {retrieval.get('scored_cases', 0)} |",
        f"| Tiempo promedio de retrieval (ms) | {retrieval.get('avg_retrieval_ms', 0):.0f} |",
        "",
        "## Comparación de generación: Ollama vs OpenAI",
        "",
        "| Métrica | " + " | ".join(g.get("provider", "") for g in r.get("generations", [])) + " |",
        "|---|" + "|".join(["---"] * len(r.get("generations", []))) + "|",
    ]
    gens = r.get("generations", [])
    lines.append("| Modelo | " + " | ".join(g.get("model", "") for g in gens) + " |")
    lines.append("| Tasa de alucinación | " + " | ".join(f"{g.get('hallucination_rate', 0):.3f}" for g in gens) + " |")
    lines.append("| Casos juzgados | " + " | ".join(str(g.get("judged_cases", 0)) for g in gens) + " |")
    lines.append("| Tasa de rechazo seguro | " + " | ".join(f"{g.get('safe_rejection_rate', 0):.3f}" for g in gens) + " |")
    lines.append("| Tiempo promedio de generación (ms) | " + " | ".join(f"{g.get('avg_generation_ms', 0):.0f}" for g in gens) + " |")
    return "\n".join(lines) + "\n"


@router.get("/{run_id}/download")
async def download_gold_eval_report(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(GoldEvalRun).where(GoldEvalRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "completed":
        raise HTTPException(status_code=400, detail="El run todavía no está completo")

    report = _render_markdown_report(run)
    return Response(
        content=report,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="goldstandard-eval-{run_id}.md"'},
    )
