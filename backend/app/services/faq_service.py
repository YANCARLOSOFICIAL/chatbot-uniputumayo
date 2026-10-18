"""Curated "Preguntas frecuentes" (FAQ).

Design (agreed 2026-10-17, advisor's suggestion): the questions users repeat
most get an official, human-written answer stored in Postgres and shown on
a public FAQ page. In chat, the user's question is compared against every
enabled FAQ by cosine similarity of its question embedding BEFORE the
answer cache and before RAG + LLM run, so a hit costs zero model calls —
the embedding was going to be computed for the answer cache anyway.

FAQ vs answer cache:
  - FAQ: persisted, curated by an admin, never expires, visible to users,
    survives document re-uploads. Answers are the institution's words.
  - Answer cache: volatile (Redis/in-memory, TTL), filled by the LLM,
    invalidated on every upload, invisible to users.
A FAQ hit therefore wins over a cache hit.

Match outcome, by similarity `s` against the best enabled, indexed FAQ:
  - s >= faq_similarity_threshold and the guards pass → answer with the FAQ.
  - faq_suggest_threshold <= s < faq_similarity_threshold (or a guard
    rejected a high match) → normal flow, plus a "¿Te refieres a…?" hint
    the UI shows as a clickable chip.
  - otherwise → normal flow, no hint.
"""
import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.faq_entry import FaqEntry
from app.schemas.faq import FaqCreate, FaqUpdate, FaqImportItem
from app.utils.cache import AsyncAnswerCache, _significant_words
from app.utils.query_utils import mentions_entity
from app.utils.question_embedding import embed_question

logger = logging.getLogger(__name__)

# How many nearest FAQs to pull from pgvector per lookup. More than one so a
# guard-rejected best match can fall back to the next candidate, and so the
# suggestion can come from a different entry than the one the guard rejected.
_MATCH_CANDIDATES = 3


@dataclass(frozen=True)
class FaqMatch:
    entry: FaqEntry
    similarity: float


@dataclass(frozen=True)
class FaqLookup:
    """Result of matching one user question against the FAQ table."""
    hit: FaqMatch | None = None          # answer with this entry, no LLM
    suggestion: FaqMatch | None = None   # related entry to offer the user


class FaqService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Reads ─────────────────────────────────────────────────────────────

    async def list_public(self) -> list[FaqEntry]:
        result = await self.db.execute(
            select(FaqEntry)
            .where(FaqEntry.is_enabled.is_(True))
            .order_by(FaqEntry.category.nulls_last(), FaqEntry.sort_order, FaqEntry.created_at)
        )
        return list(result.scalars().all())

    async def list_admin(self) -> list[FaqEntry]:
        result = await self.db.execute(
            select(FaqEntry)
            .order_by(FaqEntry.category.nulls_last(), FaqEntry.sort_order, FaqEntry.created_at)
        )
        return list(result.scalars().all())

    async def get(self, entry_id: UUID) -> FaqEntry | None:
        return await self.db.get(FaqEntry, entry_id)

    # ── Writes ────────────────────────────────────────────────────────────

    async def _embed(self, entry: FaqEntry) -> bool:
        """Compute `entry.embedding` from its question. Returns False (and
        leaves the entry unindexed, i.e. visible but not auto-answering) when
        the embedding model is unavailable — saving must never fail because
        Ollama is down."""
        vector = await embed_question(entry.question)
        if vector is None:
            entry.embedding = None
            entry.embedding_model = None
            return False
        entry.embedding = vector
        entry.embedding_model = settings.answer_cache_embedding_model
        return True

    async def create(self, data: FaqCreate) -> FaqEntry:
        entry = FaqEntry(**data.model_dump())
        await self._embed(entry)
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def update(self, entry_id: UUID, data: FaqUpdate) -> FaqEntry | None:
        entry = await self.get(entry_id)
        if entry is None:
            return None
        changes = data.model_dump(exclude_unset=True)
        question_changed = "question" in changes and changes["question"] != entry.question
        for field, value in changes.items():
            setattr(entry, field, value)
        # Only the question is embedded (question-vs-question matching), so
        # editing the answer alone must not cost an embedding call.
        if question_changed or entry.embedding is None:
            await self._embed(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def delete(self, entry_id: UUID) -> bool:
        entry = await self.get(entry_id)
        if entry is None:
            return False
        await self.db.delete(entry)
        await self.db.commit()
        return True

    async def reindex(self, entry_id: UUID | None = None) -> tuple[int, int]:
        """Recompute embeddings for one entry (or all). Returns (ok, failed).
        Needed after a failed save (Ollama down) or after changing the
        question-embedding model."""
        if entry_id is not None:
            entry = await self.get(entry_id)
            entries = [entry] if entry is not None else []
        else:
            entries = (await self.db.execute(select(FaqEntry))).scalars().all()
        ok = failed = 0
        for entry in entries:
            if await self._embed(entry):
                ok += 1
            else:
                failed += 1
        await self.db.commit()
        return ok, failed

    async def import_entries(
        self, items: list[FaqImportItem], skip_duplicates: bool = True,
    ) -> tuple[int, int, int]:
        """Bulk create (used to seed the table). Returns
        (created, skipped, not_indexed)."""
        existing: set[str] = set()
        if skip_duplicates:
            rows = (await self.db.execute(select(FaqEntry.question))).scalars().all()
            existing = {q.strip().lower() for q in rows}
        created = skipped = not_indexed = 0
        for item in items:
            key = item.question.strip().lower()
            if skip_duplicates and key in existing:
                skipped += 1
                continue
            entry = FaqEntry(**item.model_dump())
            if not await self._embed(entry):
                not_indexed += 1
            self.db.add(entry)
            existing.add(key)
            created += 1
        await self.db.commit()
        return created, skipped, not_indexed

    async def record_hit(self, entry_id: UUID) -> None:
        """Increment the analytics counter. Not committed here — the chat
        service folds it into the same transaction as the message."""
        await self.db.execute(
            update(FaqEntry)
            .where(FaqEntry.id == entry_id)
            .values(hit_count=FaqEntry.hit_count + 1)
        )

    async def count_enabled(self) -> int:
        return (await self.db.execute(
            select(func.count(FaqEntry.id)).where(FaqEntry.is_enabled.is_(True))
        )).scalar() or 0

    # ── Matching ──────────────────────────────────────────────────────────

    @staticmethod
    def _names_program(query_text: str, program: str, aliases: dict[str, str] | None) -> bool:
        """True when the query names the whole program — directly ("ingeniería
        de sistemas") or through a ciclo-tecnológico alias whose canonical
        name is this program ("tecnología en desarrollo de software" ->
        "ingenieria de sistemas", see ChatService._get_program_aliases)."""
        if mentions_entity(query_text, program, min_overlap=1.0):
            return True
        program_words = _significant_words(program)
        for alias, canonical in (aliases or {}).items():
            if _significant_words(canonical) == program_words and mentions_entity(query_text, alias, min_overlap=1.0):
                return True
        return False

    @classmethod
    def _guards_pass(cls, entry: FaqEntry, query_text: str, aliases: dict[str, str] | None) -> bool:
        """A high cosine score can still be the wrong program ("créditos de
        Ingeniería de Sistemas" vs "...de Ingeniería Ambiental") or the
        wrong semester, so:

        - A FAQ scoped to a `program` only auto-answers when the query
          names that whole program (every significant word, or a known
          alias). Stricter than the answer cache's one-shared-word check,
          which would let "ingeniería" alone match any engineering program.
        - `faculty` and semester reuse the answer cache's guards as-is.
        - `source_document` is deliberately NOT used as a scoping entity:
          the cache's document-title fallback would reject every paraphrase
          whose words don't appear in the title ("¿qué necesito para
          graduarme?" vs a FAQ backed by the "Estatuto Estudiantil"), which
          is exactly the kind of match the FAQ exists to serve.
        """
        if entry.program and not cls._names_program(query_text, entry.program, aliases):
            return False
        as_cache_entry = {
            "question": entry.question,
            "sources": [{"program": entry.program, "faculty": entry.faculty}],
        }
        return (
            AsyncAnswerCache._entity_guard_passes(as_cache_entry, query_text, aliases)
            and AsyncAnswerCache._semester_guard_passes(as_cache_entry, query_text)
        )

    async def match(
        self,
        embedding: list[float],
        query_text: str,
        aliases: dict[str, str] | None = None,
    ) -> FaqLookup:
        """Match a user question (already embedded with embed_question)
        against the enabled, indexed FAQs. Never raises: any DB error is
        logged and treated as "no match" so chat keeps working."""
        if not settings.faq_enabled:
            return FaqLookup()
        try:
            distance = FaqEntry.embedding.cosine_distance(embedding)
            result = await self.db.execute(
                select(FaqEntry, distance.label("distance"))
                .where(FaqEntry.is_enabled.is_(True))
                .where(FaqEntry.embedding.isnot(None))
                .order_by(distance)
                .limit(_MATCH_CANDIDATES)
            )
            rows = result.all()
        except Exception as e:
            logger.warning("FAQ lookup failed, continuing without FAQ: %s: %s", type(e).__name__, e)
            return FaqLookup()
        return self.pick(
            [(entry, 1.0 - float(dist)) for entry, dist in rows], query_text, aliases,
        )

    @classmethod
    def pick(
        cls,
        candidates: list[tuple[FaqEntry, float]],
        query_text: str,
        aliases: dict[str, str] | None = None,
    ) -> FaqLookup:
        """Pure decision step (unit-testable without a DB): given candidates
        sorted by descending similarity, decide hit / suggestion / nothing."""
        suggestion: FaqMatch | None = None
        for entry, similarity in candidates:
            if similarity < settings.faq_suggest_threshold:
                break
            if similarity >= settings.faq_similarity_threshold:
                if cls._guards_pass(entry, query_text, aliases):
                    logger.info(
                        "FAQ hit | faq=%s | similarity=%.3f | q=%r",
                        entry.id, similarity, query_text[:80],
                    )
                    return FaqLookup(hit=FaqMatch(entry, similarity))
                logger.info(
                    "FAQ guard rejected hit (similarity=%.3f, entity/semester mismatch) | faq=%s",
                    similarity, entry.id,
                )
            if suggestion is None:
                suggestion = FaqMatch(entry, similarity)
        if suggestion is not None:
            logger.info(
                "FAQ suggestion | faq=%s | similarity=%.3f | q=%r",
                suggestion.entry.id, suggestion.similarity, query_text[:80],
            )
        return FaqLookup(suggestion=suggestion)
