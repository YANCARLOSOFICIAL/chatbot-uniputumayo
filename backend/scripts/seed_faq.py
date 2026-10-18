"""Seed the curated FAQ table from a JSON file (same format as the admin
"Importar JSON" button — see scripts/faq_seed.json).

Run inside the backend container, where DATABASE_URL and Ollama are
reachable:

    docker compose -f docker-compose.prod.yml exec backend \
        python -m scripts.seed_faq scripts/faq_seed.json

Entries whose question already exists (case-insensitive) are skipped, so
re-running is safe. Entries saved while Ollama is unreachable are created
without an embedding ("sin índice" in the admin page) — fix them later with
the admin "Reindexar todo" button or POST /api/v1/faq/admin/reindex.
"""
import asyncio
import json
import sys
from pathlib import Path

from app.database import async_session
from app.schemas.faq import FaqImportItem
from app.services.faq_service import FaqService


async def main(path: str) -> int:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    raw = payload["entries"] if isinstance(payload, dict) else payload
    items = [FaqImportItem(**{k: v for k, v in e.items() if not k.startswith("_")}) for e in raw]
    skip = payload.get("skip_duplicates", True) if isinstance(payload, dict) else True
    async with async_session() as db:
        created, skipped, not_indexed = await FaqService(db).import_entries(items, skip_duplicates=skip)
    print(f"creadas: {created} · omitidas (ya existían): {skipped} · sin índice: {not_indexed}")
    return 1 if not_indexed else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("uso: python -m scripts.seed_faq <archivo.json>")
        sys.exit(2)
    sys.exit(asyncio.run(main(sys.argv[1])))
