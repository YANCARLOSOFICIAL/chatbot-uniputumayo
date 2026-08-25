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
from app.utils.prompts import CLARIFICATION_MARKER

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


def _is_clarification_case(c: dict) -> bool:
    """Recomputed directly from the answer text (not the stored `clarification`
    field) so reports for runs stored before that field existed are also
    corrected — a clarification reply ("which program?") isn't a real answer
    and was previously judged for hallucination against a single-document
    context it was never meant to match, inflating the hallucination rate."""
    return CLARIFICATION_MARKER in (c.get("answer") or "")


def _compute_generation_stats(g: dict) -> dict:
    cases = g.get("cases", [])
    ok_cases = [c for c in cases if c.get("error") is None]
    in_scope = [c for c in ok_cases if not c.get("expected_refusal")]
    refusal_expected = [c for c in ok_cases if c.get("expected_refusal")]

    judged = [c for c in in_scope if c.get("hallucinated") is not None and not _is_clarification_case(c)]
    unexpected_refusal = [c for c in in_scope if c.get("refused")]
    clarification_triggered = [c for c in in_scope if _is_clarification_case(c)]
    judge_failed = [
        c for c in in_scope
        if not c.get("refused") and not _is_clarification_case(c) and c.get("hallucinated") is None
    ]

    # Split "rechazo inesperado" by rag_quality — two mechanisms look
    # identical otherwise (refused=True, verification_reason=None):
    # retrieval itself came back weak/empty (quality != "good", zero LLM
    # calls) vs. the LLM had good context and self-refused anyway
    # (verification_graph._grade's REFUSAL_MARKER short-circuit auto-
    # approves without grading, so verification_reason stays None too).
    # Confirmed live 2026-08-24 these were conflated into one bucket that
    # a HyDE/retrieval fix could only ever move half of. `rag_quality` is
    # None on runs recorded before this field existed — those fall into
    # "sin diagnóstico" rather than being misclassified either way.
    refusal_quality_gap = [c for c in unexpected_refusal if c.get("rag_quality") in ("weak", "none")]
    refusal_self_refused = [c for c in unexpected_refusal if c.get("rag_quality") == "good"]
    refusal_undiagnosed = [
        c for c in unexpected_refusal
        if c.get("rag_quality") not in ("weak", "none", "good")
    ]

    return {
        "provider": g.get("provider", ""),
        "model": g.get("model", ""),
        "hallucination_rate": (sum(1 for c in judged if c.get("hallucinated")) / len(judged)) if judged else 0.0,
        "judged_cases": len(judged),
        "safe_rejection_rate": (
            sum(1 for c in refusal_expected if c.get("refusal_ok")) / len(refusal_expected)
        ) if refusal_expected else 0.0,
        "avg_generation_ms": g.get("avg_generation_ms", 0),
        "error_cases": g.get("error_cases", 0),
        "unexpected_refusal": unexpected_refusal,
        "refusal_quality_gap": refusal_quality_gap,
        "refusal_self_refused": refusal_self_refused,
        "refusal_undiagnosed": refusal_undiagnosed,
        "clarification_triggered": clarification_triggered,
        "judge_failed": judge_failed,
    }


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
        f"| Casos con error (búsqueda falló, excluidos de las métricas) | {retrieval.get('error_cases', 0)} |",
        "",
        "## Comparación de generación: Ollama vs OpenAI",
        "",
        "| Métrica | " + " | ".join(g.get("provider", "") for g in r.get("generations", [])) + " |",
        "|---|" + "|".join(["---"] * len(r.get("generations", []))) + "|",
    ]
    gens = [_compute_generation_stats(g) for g in r.get("generations", [])]
    lines.append("| Modelo | " + " | ".join(g["model"] for g in gens) + " |")
    lines.append("| Tasa de alucinación | " + " | ".join(f"{g['hallucination_rate']:.3f}" for g in gens) + " |")
    lines.append("| Casos juzgados | " + " | ".join(str(g["judged_cases"]) for g in gens) + " |")
    lines.append("| Tasa de rechazo seguro | " + " | ".join(f"{g['safe_rejection_rate']:.3f}" for g in gens) + " |")
    lines.append("| Tiempo promedio de generación (ms) | " + " | ".join(f"{g['avg_generation_ms']:.0f}" for g in gens) + " |")
    lines.append("| Casos con error (excluidos de las tasas anteriores) | " + " | ".join(str(g["error_cases"]) for g in gens) + " |")

    lines += ["", "## Casos no juzgados (huecos en la tasa de alucinación)", ""]
    lines.append(
        "Un caso \"dentro de alcance\" queda sin juzgar por tres motivos distintos, "
        "ninguno de los cuales cuenta como error arriba: el chatbot rechazó responder "
        "aunque debía hacerlo, disparó una aclaración (\"¿sobre cuál programa?\") en vez "
        "de responder, o la llamada al juez LLM falló en silencio."
    )
    for g in gens:
        unexpected_refusal = g["unexpected_refusal"]
        clarification_triggered = g["clarification_triggered"]
        judge_failed = g["judge_failed"]
        total_ungraded = len(unexpected_refusal) + len(clarification_triggered) + len(judge_failed)
        lines += [
            "",
            f"### {g['provider']} — {total_ungraded} caso(s) sin juzgar",
            "",
            f"- Rechazo inesperado (el chatbot dijo \"no sé\" en una pregunta que debía responder): {len(unexpected_refusal)}",
            f"- Aclaración disparada (\"¿sobre cuál programa/facultad?\" en vez de responder): {len(clarification_triggered)}",
            f"- Fallo silencioso del juez LLM (llamada al juez lanzó una excepción): {len(judge_failed)}",
        ]
        if judge_failed:
            lines += ["", "Preguntas afectadas por fallo del juez:", ""]
            for c in judge_failed[:20]:
                lines.append(f"- `{c.get('id', '')}`: {c.get('query', '')}")
            if len(judge_failed) > 20:
                lines.append(f"- ... y {len(judge_failed) - 20} más")
        if clarification_triggered:
            lines += ["", "Preguntas donde se disparó una aclaración:", ""]
            for c in clarification_triggered[:20]:
                lines.append(f"- `{c.get('id', '')}`: {c.get('query', '')}")
            if len(clarification_triggered) > 20:
                lines.append(f"- ... y {len(clarification_triggered) - 20} más")
        if unexpected_refusal:
            refusal_quality_gap = g["refusal_quality_gap"]
            refusal_self_refused = g["refusal_self_refused"]
            refusal_undiagnosed = g["refusal_undiagnosed"]
            if refusal_quality_gap:
                lines += [
                    "",
                    f"Rechazo por retrieval débil/vacío ({len(refusal_quality_gap)}) — "
                    "el RAG no encontró contenido suficiente, ninguna llamada al LLM:",
                    "",
                ]
                for c in refusal_quality_gap[:20]:
                    lines.append(f"- `{c.get('id', '')}`: {c.get('query', '')}")
                if len(refusal_quality_gap) > 20:
                    lines.append(f"- ... y {len(refusal_quality_gap) - 20} más")
            if refusal_self_refused:
                lines += [
                    "",
                    f"Rechazo del modelo pese a contexto bueno ({len(refusal_self_refused)}) — "
                    "el RAG sí encontró contenido relevante (quality=good), pero el modelo "
                    "respondió \"no sé\" de todas formas:",
                    "",
                ]
                for c in refusal_self_refused[:20]:
                    reason = c.get("verification_reason")
                    suffix = f" — motivo del grader: «{reason}»" if reason else ""
                    lines.append(f"- `{c.get('id', '')}`: {c.get('query', '')}{suffix}")
                if len(refusal_self_refused) > 20:
                    lines.append(f"- ... y {len(refusal_self_refused) - 20} más")
            if refusal_undiagnosed:
                lines += [
                    "",
                    f"Rechazo sin diagnóstico ({len(refusal_undiagnosed)}) — corrida anterior "
                    "al campo rag_quality, no se puede clasificar retroactivamente:",
                    "",
                ]
                for c in refusal_undiagnosed[:20]:
                    reason = c.get("verification_reason")
                    suffix = f" — motivo del grader: «{reason}»" if reason else ""
                    lines.append(f"- `{c.get('id', '')}`: {c.get('query', '')}{suffix}")
                if len(refusal_undiagnosed) > 20:
                    lines.append(f"- ... y {len(refusal_undiagnosed) - 20} más")

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
