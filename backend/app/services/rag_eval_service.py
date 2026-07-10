"""Core RAG evaluation logic, shared by scripts/eval_rag.py (CLI) and the
admin "Evaluación RAG" panel (routers/rag_eval.py).

See scripts/eval_rag.py's module docstring for the full rationale — this
module holds only the mechanics (case definitions, running a case, running
the whole set); presentation (printing, JSON-file dumping) stays in the CLI
script, and DB-run persistence stays in the router.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.schemas.chat import MessageCreate
from app.schemas.rag import SearchRequest
from app.services.chat_service import ChatService
from app.services.rag_service import RAGService
from app.utils.prompts import REFUSAL_MARKER

_EVAL_CONVERSATION_TITLE = "eval"


@dataclass
class EvalCase:
    id: str
    query: str
    expect_answerable: bool
    expect_keywords: list[str] = field(default_factory=list)
    expect_document_substring: str | None = None
    expect_rag_skipped: bool = False


CASES: list[EvalCase] = [
    EvalCase(
        id="curriculum-sem1",
        query="¿Cuáles son las materias del primer semestre del posgrado en seguridad informática?",
        expect_answerable=True,
        expect_keywords=["análisis y gestión de riesgos", "pruebas de penetración"],
        expect_document_substring="Seguridad Inf",
    ),
    EvalCase(
        id="curriculum-sem2",
        query="¿Qué materias se ven en el segundo semestre de la especialización en ciberseguridad?",
        expect_answerable=True,
        expect_keywords=["criptografía", "seguridad en redes"],
        expect_document_substring="Seguridad Inf",
    ),
    EvalCase(
        id="total-creditos",
        query="¿Cuántos créditos tiene en total el posgrado en seguridad informática?",
        expect_answerable=True,
        expect_keywords=["28"],
        expect_document_substring="Seguridad Inf",
    ),
    EvalCase(
        id="not-in-kb-cost",
        query="¿Cuál es el costo de la matrícula del posgrado en seguridad informática?",
        expect_answerable=False,
    ),
    EvalCase(
        id="out-of-domain",
        query="¿En qué ciudad queda la sede principal de la Universidad de Harvard?",
        expect_answerable=False,
    ),
    EvalCase(
        id="greeting-plain",
        query="hola",
        expect_answerable=True,
        expect_rag_skipped=True,
    ),
    EvalCase(
        id="greeting-with-question",
        query="hola, cuántos créditos tiene el posgrado en seguridad informática",
        expect_answerable=True,
        expect_keywords=["28"],
        expect_rag_skipped=False,  # has a factual keyword — must NOT be treated as a bare greeting
    ),
]


@dataclass
class CaseResult:
    case: EvalCase
    retrieval_quality: str
    retrieval_top_score: float
    retrieval_ms: int
    answer: str
    sources_cited: int
    generation_ms: int
    retrieval_ok: bool
    answer_ok: bool
    rag_skip_ok: bool
    notes: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return self.retrieval_ok and self.answer_ok and self.rag_skip_ok

    def to_dict(self) -> dict:
        return {
            "id": self.case.id,
            "query": self.case.query,
            "passed": self.passed,
            "retrieval_quality": self.retrieval_quality,
            "retrieval_top_score": self.retrieval_top_score,
            "retrieval_ms": self.retrieval_ms,
            "sources_cited": self.sources_cited,
            "generation_ms": self.generation_ms,
            "answer": self.answer,
            "notes": self.notes,
        }


async def run_case(db: AsyncSession, case: EvalCase) -> CaseResult:
    notes: list[str] = []

    # ── Retrieval-level check ────────────────────────────────────────────
    rag_service = RAGService(db)
    t0 = time.time()
    search = await rag_service.search(SearchRequest(query=case.query))
    retrieval_ms = int((time.time() - t0) * 1000)
    quality = rag_service.evaluate_context_quality(search.results)
    top_score = search.results[0].score if search.results else 0.0

    retrieval_ok = True
    if case.expect_answerable and not case.expect_rag_skipped:
        if quality != "good":
            retrieval_ok = False
            notes.append(f"expected retrieval quality 'good', got '{quality}'")
        elif case.expect_document_substring and not any(
            case.expect_document_substring.lower() in (r.document_title or "").lower()
            for r in search.results
        ):
            retrieval_ok = False
            notes.append(f"expected a result from a document containing '{case.expect_document_substring}'")

    # ── End-to-end answer check (separate conversation per case) ─────────
    conversation = Conversation(id=uuid4(), title=_EVAL_CONVERSATION_TITLE)
    db.add(conversation)
    await db.flush()

    chat_service = ChatService(db)
    t1 = time.time()
    response = await chat_service.process_message(
        conversation.id,
        MessageCreate(content=case.query, input_type="text"),
    )
    generation_ms = int((time.time() - t1) * 1000)
    answer = response.assistant_message.content
    sources_cited = len(response.sources)
    # process_message() commits internally — the eval conversation is real
    # DB rows by this point; swept out in bulk by run_eval() below.

    answer_ok = True
    if case.expect_answerable:
        missing = [kw for kw in case.expect_keywords if kw.lower() not in answer.lower()]
        if missing:
            answer_ok = False
            notes.append(f"answer missing expected keywords: {missing}")
        if case.expect_keywords and sources_cited == 0 and not case.expect_rag_skipped:
            answer_ok = False
            notes.append("expected at least one cited source, got zero")
    else:
        if REFUSAL_MARKER not in answer:
            answer_ok = False
            notes.append("expected a refusal, model answered instead (possible hallucination)")
        if sources_cited != 0:
            answer_ok = False
            notes.append(f"expected zero sources on a refusal, got {sources_cited}")

    # NOTE: `quality` above comes from this function's OWN standalone
    # rag_service.search() call — it has no idea chat_service's greeting
    # bypass exists, so it always retrieves normally. The only signal that
    # actually reflects whether the real chat turn skipped RAG is the answer
    # response's own `sources_cited` (greeting bypass always yields zero).
    rag_skip_ok = True
    if case.expect_rag_skipped and sources_cited != 0:
        rag_skip_ok = False
        notes.append("expected RAG to be skipped (pure greeting), but the chat response cited sources")
    if not case.expect_rag_skipped and case.id == "greeting-with-question" and sources_cited == 0:
        rag_skip_ok = False
        notes.append("factual greeting was incorrectly treated as a bare greeting (RAG skipped)")

    return CaseResult(
        case=case,
        retrieval_quality=quality,
        retrieval_top_score=top_score,
        retrieval_ms=retrieval_ms,
        answer=answer,
        sources_cited=sources_cited,
        generation_ms=generation_ms,
        retrieval_ok=retrieval_ok,
        answer_ok=answer_ok,
        rag_skip_ok=rag_skip_ok,
        notes=notes,
    )


@dataclass
class EvalSummary:
    passed: int
    total: int
    avg_retrieval_ms: float
    avg_generation_ms: float
    results: list[CaseResult]


async def run_eval(db: AsyncSession) -> EvalSummary:
    """Run every case in CASES and clean up the throwaway conversations they create."""
    results = [await run_case(db, case) for case in CASES]

    # process_message() commits real conversation/message rows per case (see
    # run_case) — sweep them out so eval runs don't clutter the admin's real
    # conversation list. FK is ON DELETE CASCADE, so this takes the messages too.
    await db.execute(delete(Conversation).where(Conversation.title == _EVAL_CONVERSATION_TITLE))
    await db.commit()

    total = len(results)
    return EvalSummary(
        passed=sum(1 for r in results if r.passed),
        total=total,
        avg_retrieval_ms=sum(r.retrieval_ms for r in results) / total if total else 0.0,
        avg_generation_ms=sum(r.generation_ms for r in results) / total if total else 0.0,
        results=results,
    )
