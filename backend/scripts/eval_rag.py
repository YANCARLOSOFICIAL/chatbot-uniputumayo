"""RAG evaluation harness — CLI entry point.

Runs the fixed test-query set (app/services/rag_eval_service.py) through
retrieval and the full chat pipeline, and prints precision/recall-style
metrics instead of anecdotal "it seems to work" observations. The same
CASES/run_eval() also power the admin "Evaluación RAG" panel — this script
is for local/CI use without going through the API.

Usage (from inside the backend container, which has DB access):
    docker exec iup-chatbot-backend python scripts/eval_rag.py
    docker exec iup-chatbot-backend python scripts/eval_rag.py --verbose

Each EvalCase declares what a *correct* answer looks like:
- expect_answerable=True  → the KB has this info; the answer should contain
  every string in expect_keywords (case-insensitive substring match) and at
  least one source should be cited.
- expect_answerable=False → the KB does NOT have this info (either genuinely
  out of domain, or in-domain-sounding but not actually covered by any
  indexed document); the answer should contain the refusal marker and cite
  zero sources. This is the hallucination-resistance check.
- expect_rag_skipped=True → a pure greeting; RAG must not run at all
  (quality == "none", zero sources), regardless of expect_answerable.

Add cases as more documents get indexed — right now the set is anchored to
whatever's actually in the DB (see MEMORY.md `project_rag_precision.md` for
why: building this against a near-empty KB and pretending the numbers mean
more than they do would be worse than not measuring at all).
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import async_session  # noqa: E402
from app.services.rag_eval_service import run_eval  # noqa: E402


async def main(verbose: bool) -> int:
    async with async_session() as db:
        summary = await run_eval(db)

    print(f"\n{'='*70}\nRAG EVAL — {summary.passed}/{summary.total} cases passed\n{'='*70}")
    for r in summary.results:
        status = "PASS" if r.passed else "FAIL"
        print(f"\n[{status}] {r.case.id} — \"{r.case.query}\"")
        print(f"  retrieval: quality={r.retrieval_quality} top_score={r.retrieval_top_score:.3f} "
              f"({r.retrieval_ms}ms) | sources_cited={r.sources_cited} | generation={r.generation_ms}ms")
        for note in r.notes:
            print(f"  ⚠ {note}")
        if verbose:
            print(f"  answer: {r.answer[:300]}")

    print(f"\n{'-'*70}")
    print(f"Retrieval accuracy: {sum(1 for r in summary.results if r.retrieval_ok)}/{summary.total}")
    print(f"Answer accuracy (incl. hallucination checks): {sum(1 for r in summary.results if r.answer_ok)}/{summary.total}")
    print(f"Greeting-bypass correctness: {sum(1 for r in summary.results if r.rag_skip_ok)}/{summary.total}")
    print(f"Avg retrieval latency: {summary.avg_retrieval_ms:.0f}ms | Avg end-to-end generation: {summary.avg_generation_ms:.0f}ms")

    out_dir = Path(__file__).resolve().parent.parent / "eval_results"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / f"rag_eval_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out_path.write_text(json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "passed": summary.passed,
        "total": summary.total,
        "avg_retrieval_ms": summary.avg_retrieval_ms,
        "avg_generation_ms": summary.avg_generation_ms,
        "cases": [r.to_dict() for r in summary.results],
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSaved: {out_path}")

    return 0 if summary.passed == summary.total else 1


if __name__ == "__main__":
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    exit_code = asyncio.run(main(verbose))
    sys.exit(exit_code)
