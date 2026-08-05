"""Evaluates the chatbot against an admin-uploaded GoldStandard.xlsx query
bank (see the "Consultas" sheet the university uses for the manual rubric
evaluation) — computes the retrieval-quality metrics the thesis's technical
evaluation criterion asks for (Precision@k, Recall@k, MRR) plus an automated
hallucination rate and safe-rejection rate, comparing two LLM providers.

Two things are DELIBERATELY split apart:

- Retrieval (Precision@k/Recall@k/MRR/hit rate) is computed ONCE, not once
  per provider. `embedding_provider` is fixed independently of the answering
  LLM (see app/config.py) — swapping Ollama/OpenAI as the *chat* provider
  does not change what gets retrieved, only how the retrieved context gets
  turned into an answer. Running retrieval twice would just duplicate
  identical numbers under two different labels.
- Generation-dependent metrics (hallucination rate, safe-rejection rate,
  answer latency) ARE computed once per provider — those genuinely differ
  between Ollama and OpenAI as the generator.

Hallucination detection uses an LLM-as-judge call (same provider being
evaluated, judging its own answer against the retrieved context) rather than
keyword matching — the query bank is real institutional content, not a fixed
set of expected keywords like scripts/eval_rag.py's smoke-test cases. This is
weaker than an independent judge model, but avoids requiring a second
provider's worth of judge calls on top of the two already being compared.
"""
from __future__ import annotations

import io
import logging
import re
import time
from dataclasses import dataclass, field
from uuid import uuid4

import openpyxl
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.schemas.chat import MessageCreate
from app.schemas.rag import SearchRequest
from app.services.chat_service import ChatService
from app.services.rag_service import RAGService
from app.providers.provider_factory import ProviderFactory
from app.runtime_config import runtime_config
from app.utils.prompts import REFUSAL_MARKER
from app.utils.text_processing import normalize_for_match

logger = logging.getLogger(__name__)

_EVAL_CONVERSATION_TITLE = "gold-eval"

_DOC_EXTENSIONS = (".pdf", ".xlsx", ".xls", ".docx", ".csv", ".pptx")

# "Depende de carga" rows name a topic, not a real document ("(Documento de
# costos – verificar si está cargado)") — there's no filename to match
# against `documents.title`, so these are graded the same way as "Fuera de
# alcance": a refusal is correct unless/until that topic's document actually
# gets loaded. See parse_gold_queries.
_REFUSAL_EXPECTED_TYPES = {"fuera de alcance", "depende de carga"}
_RETRIEVAL_EXPECTED_TYPE = "dentro de alcance"


@dataclass
class GoldQuery:
    id: str
    category: str
    query: str
    query_type: str  # raw "Tipo" cell, lowercased
    expected_documents: list[str] = field(default_factory=list)


def _normalize_doc_ref(name: str) -> str:
    n = normalize_for_match(name.strip())
    for ext in _DOC_EXTENSIONS:
        if n.endswith(ext):
            n = n[: -len(ext)]
    return n.strip()


def _split_doc_refs(cell: str) -> list[str]:
    """"07_X.xlsx; sitio web / 09_Y.xls (nota)" -> ["07_X", "09_Y"] — drops
    parenthetical notes and generic non-file references (sitio web, FICB024
    used as a bare acronym, "verificar si..." placeholders)."""
    refs: list[str] = []
    for part in re.split(r"[;/]", cell):
        part = re.sub(r"\([^)]*\)", "", part).strip()
        if not part:
            continue
        low = part.lower()
        if "sitio web" in low or "verificar" in low:
            continue
        refs.append(_normalize_doc_ref(part))
    return [r for r in refs if r]


def parse_gold_queries(file_bytes: bytes) -> list[GoldQuery]:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb["Consultas"]
    rows = list(ws.iter_rows(values_only=True))

    queries: list[GoldQuery] = []
    for row in rows[1:]:  # skip header
        gid, category, _program, question, _expected_answer, doc_source, tipo = row[:7]
        if not gid or not question or not tipo:
            continue
        tipo_norm = str(tipo).strip().lower()
        expected_docs = _split_doc_refs(str(doc_source)) if doc_source else []
        queries.append(GoldQuery(
            id=str(gid),
            category=str(category or ""),
            query=str(question).strip(),
            query_type=tipo_norm,
            expected_documents=expected_docs,
        ))
    return queries


@dataclass
class RetrievalCaseResult:
    query: GoldQuery
    retrieved_titles: list[str]
    precision_at_k: float | None
    recall_at_k: float | None
    reciprocal_rank: float | None
    retrieval_ms: int
    retrieved_content: str  # concatenated chunk text — reused as judge context, avoids a second search
    error: str | None = None  # set when the search itself blew up (e.g. embedding timeout) — excluded from metrics, not counted as a miss


async def _run_retrieval_case(rag_service: RAGService, q: GoldQuery, k: int) -> RetrievalCaseResult:
    t0 = time.time()
    search = await rag_service.search(SearchRequest(query=q.query, top_k=k))
    retrieval_ms = int((time.time() - t0) * 1000)
    retrieved_titles = [_normalize_doc_ref(r.document_title or "") for r in search.results]
    retrieved_content = "\n\n".join(r.content for r in search.results)

    precision = recall = rr = None
    if q.query_type == _RETRIEVAL_EXPECTED_TYPE and q.expected_documents:
        expected = q.expected_documents

        def _matches(title: str) -> bool:
            return any(e in title or title in e for e in expected)

        relevant_flags = [_matches(t) for t in retrieved_titles]
        precision = sum(relevant_flags) / k if k else 0.0
        found_expected = {e for e in expected if any(e in t or t in e for t in retrieved_titles)}
        recall = len(found_expected) / len(expected)
        rr = 0.0
        for i, is_rel in enumerate(relevant_flags):
            if is_rel:
                rr = 1.0 / (i + 1)
                break

    return RetrievalCaseResult(
        query=q, retrieved_titles=retrieved_titles,
        precision_at_k=precision, recall_at_k=recall, reciprocal_rank=rr,
        retrieval_ms=retrieval_ms, retrieved_content=retrieved_content,
    )


@dataclass
class RetrievalSummary:
    k: int
    scored_cases: int  # "dentro de alcance" cases with an expected document
    mean_precision_at_k: float
    mean_recall_at_k: float
    mrr: float
    hit_rate: float  # fraction of scored cases with recall_at_k > 0
    avg_retrieval_ms: float
    error_cases: int
    cases: list[dict]


def _summarize_retrieval(results: list[RetrievalCaseResult], k: int) -> RetrievalSummary:
    scored = [r for r in results if r.precision_at_k is not None]
    n = len(scored) or 1
    ok = [r for r in results if r.error is None]
    return RetrievalSummary(
        k=k,
        scored_cases=len(scored),
        mean_precision_at_k=sum(r.precision_at_k for r in scored) / n,
        mean_recall_at_k=sum(r.recall_at_k for r in scored) / n,
        mrr=sum(r.reciprocal_rank for r in scored) / n,
        hit_rate=sum(1 for r in scored if r.recall_at_k > 0) / n,
        avg_retrieval_ms=sum(r.retrieval_ms for r in ok) / len(ok) if ok else 0.0,
        error_cases=len(results) - len(ok),
        cases=[{
            "id": r.query.id,
            "query": r.query.query,
            "query_type": r.query.query_type,
            "expected_documents": r.query.expected_documents,
            "retrieved_titles": r.retrieved_titles,
            "precision_at_k": r.precision_at_k,
            "recall_at_k": r.recall_at_k,
            "reciprocal_rank": r.reciprocal_rank,
            "retrieval_ms": r.retrieval_ms,
            "error": r.error,
        } for r in results],
    )


_JUDGE_PROMPT = (
    "Eres un evaluador estricto de un chatbot institucional. Te doy una PREGUNTA, "
    "el CONTEXTO recuperado de documentos oficiales, y la RESPUESTA generada por el asistente.\n"
    "Determina si la RESPUESTA afirma algo que NO está respaldado por el CONTEXTO (alucinación).\n\n"
    "PREGUNTA: {query}\n\nCONTEXTO:\n{context}\n\nRESPUESTA:\n{answer}\n\n"
    "Responde ÚNICAMENTE 'SI' (hay alucinación) o 'NO' (todo está respaldado por el contexto)."
)


async def _judge_hallucination(provider_name: str, model: str, query: str, context: str, answer: str) -> bool:
    provider = ProviderFactory.get_provider(provider_name)
    result = await provider.generate(
        messages=[{"role": "user", "content": _JUDGE_PROMPT.format(
            query=query, context=context[:3000], answer=answer,
        )}],
        model=model, temperature=0.0, max_tokens=10,
    )
    verdict = result.get("content", "").strip().upper()
    return verdict.startswith("SI") or verdict.startswith("SÍ")


@dataclass
class GenerationCaseResult:
    query: GoldQuery
    answer: str
    refused: bool
    expected_refusal: bool
    refusal_ok: bool
    hallucinated: bool | None  # None when not applicable (refusal, or not "dentro de alcance")
    generation_ms: int
    error: str | None = None  # set when process_message itself blew up (e.g. Ollama ReadTimeout) — case excluded from every rate, not counted as a failure


async def _run_generation_case(
    db: AsyncSession, q: GoldQuery, retrieved_context: str, provider_name: str, model: str,
) -> GenerationCaseResult:
    conversation = Conversation(id=uuid4(), title=_EVAL_CONVERSATION_TITLE)
    db.add(conversation)
    await db.flush()

    chat_service = ChatService(db)
    t0 = time.time()
    try:
        response = await chat_service.process_message(
            conversation.id,
            MessageCreate(content=q.query, input_type="text", llm_provider=provider_name, llm_model=model),
        )
    except Exception as e:
        # A single slow/failed Ollama call must not abort a run that's already
        # hours into a 104-query pass — real incident: a ReadTimeout on case
        # ~50 killed 2h18min of completed work with zero results saved.
        await db.rollback()
        generation_ms = int((time.time() - t0) * 1000)
        logger.warning(
            "Gold eval generation failed | query=%s | provider=%s | %s", q.id, provider_name, e,
        )
        return GenerationCaseResult(
            query=q, answer="", refused=False, expected_refusal=q.query_type in _REFUSAL_EXPECTED_TYPES,
            refusal_ok=False, hallucinated=None, generation_ms=generation_ms, error=str(e) or repr(e),
        )
    generation_ms = int((time.time() - t0) * 1000)
    answer = response.assistant_message.content
    refused = REFUSAL_MARKER in answer

    expected_refusal = q.query_type in _REFUSAL_EXPECTED_TYPES
    refusal_ok = (refused == expected_refusal)

    hallucinated = None
    if q.query_type == _RETRIEVAL_EXPECTED_TYPE and not refused:
        try:
            hallucinated = await _judge_hallucination(provider_name, model, q.query, retrieved_context, answer)
        except Exception as e:
            hallucinated = None  # judge call failed — excluded from the rate, not counted as a hallucination
            logger.warning(
                "Gold eval judge call failed | query=%s | provider=%s | %s", q.id, provider_name, e,
            )

    return GenerationCaseResult(
        query=q, answer=answer, refused=refused, expected_refusal=expected_refusal,
        refusal_ok=refusal_ok, hallucinated=hallucinated, generation_ms=generation_ms,
    )


@dataclass
class GenerationSummary:
    provider: str
    model: str
    hallucination_rate: float
    judged_cases: int
    safe_rejection_rate: float
    refusal_cases: int
    avg_generation_ms: float
    error_cases: int
    cases: list[dict]


async def run_generation_eval(
    db: AsyncSession,
    retrieval_results: list[RetrievalCaseResult],
    provider_name: str,
    model: str,
) -> GenerationSummary:
    results: list[GenerationCaseResult] = []
    for r in retrieval_results:
        result = await _run_generation_case(db, r.query, r.retrieved_content, provider_name, model)
        results.append(result)

    # process_message() commits real conversation/message rows per case — sweep
    # them out so eval runs don't clutter the admin's real conversation list.
    await db.execute(delete(Conversation).where(Conversation.title == _EVAL_CONVERSATION_TITLE))
    await db.commit()

    ok = [r for r in results if r.error is None]
    judged = [r for r in ok if r.hallucinated is not None]
    refusal_expected = [r for r in ok if r.expected_refusal]

    return GenerationSummary(
        provider=provider_name,
        model=model,
        hallucination_rate=(sum(1 for r in judged if r.hallucinated) / len(judged)) if judged else 0.0,
        judged_cases=len(judged),
        safe_rejection_rate=(sum(1 for r in refusal_expected if r.refusal_ok) / len(refusal_expected)) if refusal_expected else 0.0,
        refusal_cases=len(refusal_expected),
        avg_generation_ms=sum(r.generation_ms for r in ok) / len(ok) if ok else 0.0,
        error_cases=len(results) - len(ok),
        cases=[{
            "id": r.query.id,
            "query": r.query.query,
            "answer": r.answer,
            "refused": r.refused,
            "expected_refusal": r.expected_refusal,
            "refusal_ok": r.refusal_ok,
            "hallucinated": r.hallucinated,
            "generation_ms": r.generation_ms,
            "error": r.error,
        } for r in results],
    )


@dataclass
class GoldComparisonResult:
    total_queries: int
    k: int
    retrieval: RetrievalSummary
    generations: list[GenerationSummary]


async def run_gold_comparison(
    db: AsyncSession, file_bytes: bytes, k: int, providers: list[tuple[str, str]],
) -> GoldComparisonResult:
    """`providers` is a list of (provider_name, model) pairs to compare — the
    caller (router) resolves models from runtime_config so this stays testable
    without depending on global state directly.
    """
    queries = parse_gold_queries(file_bytes)

    rag_service = RAGService(db)
    retrieval_cases: list[RetrievalCaseResult] = []
    for q in queries:
        try:
            retrieval_cases.append(await _run_retrieval_case(rag_service, q, k))
        except Exception as e:
            logger.warning("Gold eval retrieval failed | query=%s | %s", q.id, e)
            retrieval_cases.append(RetrievalCaseResult(
                query=q, retrieved_titles=[], precision_at_k=None, recall_at_k=None,
                reciprocal_rank=None, retrieval_ms=0, retrieved_content="", error=str(e) or repr(e),
            ))
    retrieval = _summarize_retrieval(retrieval_cases, k)

    generations = []
    for provider_name, model in providers:
        summary = await run_generation_eval(db, retrieval_cases, provider_name, model)
        generations.append(summary)

    return GoldComparisonResult(
        total_queries=len(queries), k=k, retrieval=retrieval, generations=generations,
    )
