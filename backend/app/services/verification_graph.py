"""Self-correction loop for RAG answers, built with LangGraph.

Scope, deliberately narrow: everything upstream (hybrid search, rerank,
diversity, HyDE, history, prompt assembly — see rag_service.py / chat_service.py)
stays untouched. This module only wraps the final generation step for
messages that DID receive RAG context ("good" quality). It adds exactly the
piece that plain sequential code makes awkward: generate → grade the answer
against the retrieved context → if it isn't actually grounded, retry with
feedback (up to `settings.verification_max_attempts` times) → otherwise stop.

Greetings and "no tengo información" refusals never reach this graph — there
is nothing to ground against, and grading them would just burn an extra LLM
call on every message.
"""
import logging
import re

from typing import TypedDict

from langgraph.graph import StateGraph, START, END

from app.config import settings
from app.providers.provider_factory import ProviderFactory
from app.runtime_config import runtime_config
from app.utils.prompts import REFUSAL_MARKER

logger = logging.getLogger(__name__)

_CITATION_RE = re.compile(r"\[(\d{1,2})\]")
_CITATION_BLOCK_RE = re.compile(r"^\[(\d{1,2})\]")


def _context_for_grading(context_text: str, draft_answer: str, max_chars: int) -> str:
    """Narrow the grader's context to just the sources the draft actually
    cites, instead of resending every retrieved chunk.

    `context_text` is assembled in chat_service._run_rag as "[N] title\\n
    content" blocks joined by "\\n\\n---\\n\\n" — the same numbering the LLM
    was shown and asked to cite from. The draft answer only ever needs
    grounding in whichever sources it actually cited (usually 1-3 of the
    up-to-`rag_top_k` retrieved), so resending the rest is pure waste: on a
    CPU-only Ollama deployment, prefill time scales with token count, and
    this grade call was measured live taking as long as the main generation
    call (both reprocessing the same ~7000-token context) — confirmed via
    the deployed server's own llama.cpp timing logs. Cutting it to only the
    cited blocks is also arguably a *stricter* grading signal, not a looser
    one: it can no longer accidentally pass by matching something in an
    uncited chunk the draft never actually drew from.

    Falls back to the full (truncated) context when the draft cites nothing
    parseable — no citations to narrow by, and an uncited-but-non-refusal
    draft is exactly the shape most worth checking carefully against
    everything available.
    """
    cited = {int(m) for m in _CITATION_RE.findall(draft_answer)}
    if not cited:
        return context_text[:max_chars]

    blocks = context_text.split("\n\n---\n\n")
    kept = [
        b for b in blocks
        if (m := _CITATION_BLOCK_RE.match(b)) and int(m.group(1)) in cited
    ]
    if not kept:
        return context_text[:max_chars]
    return "\n\n---\n\n".join(kept)[:max_chars]

_GRADE_PROMPT = """Eres un revisor estricto de respuestas de un asistente universitario.

Tu tarea: decidir si la RESPUESTA está completamente respaldada por el CONTEXTO, sin
inventar ni agregar ningún dato (nombres, cifras, fechas, requisitos, códigos) que no
aparezca en el contexto.

SÍ cuenta como respaldada:
- Reorganizar, resumir o reformular el contexto con otras palabras.
- Combinar varios datos que aparecen por separado en el contexto.
- Responder de forma incompleta (falta información no es lo mismo que inventarla).

NO cuenta como respaldada:
- Agregar cualquier cifra, nombre, fecha, requisito o código que no esté literalmente
  en el contexto.
- Afirmar algo con más seguridad de la que el contexto permite.

CONTEXTO:
{context}

RESPUESTA A REVISAR:
{answer}

Responde en máximo 2 líneas: una razón breve (menos de 15 palabras) y, en la última
línea, únicamente SI o NO."""

_RETRY_FEEDBACK = (
    "Un revisor marcó tu respuesta anterior como no completamente respaldada por el "
    "contexto. Corrígela: ajusta o elimina solo los datos concretos (cifras, nombres, "
    "fechas, requisitos, códigos) que no aparezcan literalmente en el contexto, pero "
    "conserva todo lo que sí esté respaldado — no descartes una respuesta que en su "
    "mayoría es correcta por una sola imprecisión. Usa la respuesta de 'no tengo esa "
    "información disponible' únicamente si, después de esta revisión, el contexto no "
    "contiene ninguna información relevante para responder la pregunta."
)


def resolve_grader(provider_name: str, model: str) -> tuple[str, str]:
    """Pick which provider/model grades a draft — independent from whichever
    provider generated it whenever OpenAI is configured.

    A model grading its own answer is a conflict of interest, and it showed:
    GoldStandard eval 2026-08-21 found Ollama's (qwen2.5:7b) self-graded
    "approved" answers still hallucinated 57.9% of the time per an independent
    judge, while its self-graded false negatives — relayed through
    `_RETRY_FEEDBACK`'s old "if unsure, refuse" wording — accounted for the
    large majority of that same run's unexpected refusals (confirmed by the
    ~2x generation-time signature of a grade-reject-then-retry cycle on 31/31
    flagged cases). Routing grading through a single stronger, independent
    model fixes both failure modes at once instead of just tuning the prompt
    for one model's quirks.

    Falls back to self-grading (previous behavior) when OpenAI isn't
    configured — same as any pure-Ollama deployment gets today.

    Not private (no leading underscore): `goldstandard_eval_service.py`
    reuses this for the exact same reason — its own hallucination judge had
    the same self-grading conflict of interest (see that module's
    `_judge_hallucination`).
    """
    key = runtime_config.openai_api_key
    if key and key != "sk-your-key-here":
        return "openai", runtime_config.resolve_model("openai")
    return provider_name, model


class VerificationState(TypedDict):
    messages: list[dict]
    context_text: str
    provider_name: str
    model: str
    temperature: float
    max_tokens: int
    draft_answer: str
    finish_reason: str | None
    tokens_used: dict | None
    attempts: int
    approved: bool


async def _generate(state: VerificationState) -> dict:
    provider = ProviderFactory.get_provider(state["provider_name"])
    messages = list(state["messages"])
    if state["attempts"] > 0:
        messages = messages + [{"role": "user", "content": _RETRY_FEEDBACK}]

    result = await provider.generate(
        messages=messages,
        model=state["model"],
        temperature=state["temperature"],
        max_tokens=state["max_tokens"],
    )
    return {
        "draft_answer": result["content"],
        "finish_reason": result.get("finish_reason"),
        "tokens_used": result.get("tokens_used"),
        "attempts": state["attempts"] + 1,
    }


async def _grade(state: VerificationState) -> dict:
    # A refusal has nothing to hallucinate — approve without spending a call.
    if REFUSAL_MARKER in state["draft_answer"]:
        return {"approved": True}

    try:
        grader_provider_name, grader_model = resolve_grader(state["provider_name"], state["model"])
        provider = ProviderFactory.get_provider(grader_provider_name)
        # Sized to the actual retrieval budget (chunk_size × 4 chars/token ×
        # rag_top_k), not a fixed guess — a flat 4000-char cap silently fell
        # behind when rag_top_k was raised from 5 to 10 (see rag_service.py),
        # cutting the grader off well before the end of a full context_text
        # and risking a "not grounded" verdict for an answer whose actual
        # supporting chunk just hadn't been seen yet. Still comfortably
        # under the 8192-token OLLAMA_NUM_CTX window even at the current
        # top_k.
        max_context_chars = settings.chunk_size * 4 * settings.rag_top_k
        graded_context = _context_for_grading(
            state["context_text"], state["draft_answer"], max_context_chars
        )
        result = await provider.generate(
            messages=[{
                "role": "user",
                "content": _GRADE_PROMPT.format(
                    context=graded_context,
                    answer=state["draft_answer"],
                ),
            }],
            model=grader_model,
            temperature=0.0,
            max_tokens=60,
        )
        # Approve unless the grader's LAST line clearly says "NO" — not the
        # other way around. The prompt now allows a short reason before the
        # verdict (a bare one-word answer under the old max_tokens=5 gave a
        # small self-grading model no room to reason and was a large source
        # of noisy verdicts in both directions — see resolve_grader). Taking
        # the last non-empty line means a model that ignores the "2 lines
        # max" instruction and rambles doesn't break parsing, and a garbled/
        # cut-off response (e.g. an unclosed reasoning fragment) just isn't
        # an exception, so it skips the except-block fail-open below and
        # would silently reject a perfectly good answer if treated as "NO" —
        # requiring an explicit "NO" keeps the same fail-open guarantee the
        # comment below already promises for outright errors.
        lines = [l.strip() for l in result["content"].strip().splitlines() if l.strip()]
        verdict = lines[-1].upper() if lines else ""
        approved = not verdict.startswith("NO")
        logger.debug(
            "Verification grade | grader=%s/%s | verdict=%s | draft_preview=%r",
            grader_provider_name, grader_model, verdict, state["draft_answer"][:300],
        )
    except Exception as e:
        # A broken grader must never block the chat entirely — fail open and
        # let the answer through, same as if the loop were disabled.
        logger.warning("Verification grading failed, approving by default: %s", e)
        approved = True

    return {"approved": approved}


def _route(state: VerificationState) -> str:
    if state["approved"] or state["attempts"] >= settings.verification_max_attempts:
        return END
    return "generate"


def _build_graph():
    graph = StateGraph(VerificationState)
    graph.add_node("generate", _generate)
    graph.add_node("grade", _grade)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "grade")
    graph.add_conditional_edges("grade", _route, {"generate": "generate", END: END})
    return graph.compile()


_graph = _build_graph()


async def generate_verified(
    messages: list[dict],
    context_text: str,
    provider_name: str,
    model: str,
    temperature: float,
    max_tokens: int,
) -> dict:
    """Run generate -> grade (retrying up to verification_max_attempts) and
    return the approved (or last-attempt) answer.

    Returns: {content, finish_reason, tokens_used, attempts, approved}.
    `approved=False` means every attempt failed grading — the caller still
    gets the last draft (better than nothing after already spending the
    calls) but can log it as a flagged case.
    """
    final_state = await _graph.ainvoke({
        "messages": messages,
        "context_text": context_text,
        "provider_name": provider_name,
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "draft_answer": "",
        "finish_reason": None,
        "tokens_used": None,
        "attempts": 0,
        "approved": False,
    })

    if final_state["attempts"] > 1:
        logger.info(
            "Verification loop | attempts=%d | approved=%s",
            final_state["attempts"], final_state["approved"],
        )

    return {
        "content": final_state["draft_answer"],
        "finish_reason": final_state["finish_reason"],
        "tokens_used": final_state["tokens_used"],
        "attempts": final_state["attempts"],
        "approved": final_state["approved"],
    }
