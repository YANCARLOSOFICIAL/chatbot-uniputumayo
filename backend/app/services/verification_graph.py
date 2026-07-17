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

from typing import TypedDict

from langgraph.graph import StateGraph, START, END

from app.config import settings
from app.providers.provider_factory import ProviderFactory
from app.utils.prompts import REFUSAL_MARKER

logger = logging.getLogger(__name__)

_GRADE_PROMPT = """Eres un revisor estricto de respuestas de un asistente universitario.

Tu única tarea: decidir si la RESPUESTA está completamente respaldada por el CONTEXTO,
sin inventar ni agregar ningún dato (nombres, cifras, fechas, requisitos, códigos) que
no aparezca en el contexto. Una respuesta que reorganiza o resume el contexto SÍ cuenta
como respaldada. Una respuesta que agrega algo que no está ahí, NO.

CONTEXTO:
{context}

RESPUESTA A REVISAR:
{answer}

Responde con una sola palabra, sin explicación ni puntuación: SI o NO."""

_RETRY_FEEDBACK = (
    "Tu respuesta anterior incluía información que no está respaldada por el "
    "contexto proporcionado. Genera una nueva respuesta usando ÚNICAMENTE lo "
    "que aparece en el contexto. Si el contexto no alcanza para responder con "
    "certeza, usa la respuesta de 'no tengo esa información disponible'."
)


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
        provider = ProviderFactory.get_provider(state["provider_name"])
        # Sized to the actual retrieval budget (chunk_size × 4 chars/token ×
        # rag_top_k), not a fixed guess — a flat 4000-char cap silently fell
        # behind when rag_top_k was raised from 5 to 10 (see rag_service.py),
        # cutting the grader off well before the end of a full context_text
        # and risking a "not grounded" verdict for an answer whose actual
        # supporting chunk just hadn't been seen yet. Still comfortably
        # under the 8192-token OLLAMA_NUM_CTX window even at the current
        # top_k.
        max_context_chars = settings.chunk_size * 4 * settings.rag_top_k
        result = await provider.generate(
            messages=[{
                "role": "user",
                "content": _GRADE_PROMPT.format(
                    context=state["context_text"][:max_context_chars],
                    answer=state["draft_answer"],
                ),
            }],
            model=state["model"],
            temperature=0.0,
            max_tokens=5,
        )
        # Approve unless the grader clearly says "NO" — not the other way
        # around. `max_tokens=5` leaves little room for a model that doesn't
        # follow the one-word instruction (e.g. an unclosed reasoning
        # fragment cut off mid-token): that garbled output isn't an
        # exception, so it would skip the except-block fail-open below and
        # silently reject a perfectly good answer instead. Requiring an
        # explicit "NO" keeps the same fail-open guarantee the comment below
        # already promises for outright errors.
        verdict = result["content"].strip().upper()
        approved = not verdict.startswith("NO")
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
