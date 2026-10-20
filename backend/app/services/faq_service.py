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

Match outcome, by similarity `s` against the enabled, indexed FAQs
(thresholds in config.py, measured in production 2026-10-17):
  - s >= faq_similarity_threshold (0.90) and the guards pass → hit.
  - faq_judge_threshold (0.70) <= s < 0.90 → "confirm" step: a hit if every
    significant word of the user's question appears in the FAQ question
    (free), else if the auxiliary model says both ask for exactly the same
    fact (~150 tokens). Otherwise falls through to:
  - faq_suggest_threshold (0.80) <= s → normal flow plus a "¿Te refieres
    a…?" hint the UI shows as a clickable chip.
  - otherwise → normal flow, no hint.
"""
import asyncio
import logging
import re
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.faq_entry import FaqEntry
from app.providers.provider_factory import ProviderFactory
from app.schemas.faq import FaqCreate, FaqUpdate, FaqImportItem
from app.runtime_config import runtime_config
from app.utils.cache import AsyncAnswerCache
from app.utils.query_utils import _significant_words, canonicalize_price_words, mentions_entity
from app.utils.question_embedding import embed_question

logger = logging.getLogger(__name__)

# How many nearest FAQs to pull from pgvector per lookup. More than one so a
# guard-rejected best match can fall back to the next candidate, and so the
# suggestion can come from a different entry than the one the guard rejected.
_MATCH_CANDIDATES = 3

# Words that appear in FAQ questions for completeness but carry no topic:
# a student's "qué especializaciones tienen?" and the FAQ's "¿Qué
# especializaciones o posgrados ofrece Uniputumayo?" differ only in these.
# Stripped before the lexical comparison (see _lexical_subset).
_FILLER_WORDS: frozenset[str] = frozenset({
    "uniputumayo", "universidad", "institucion", "institucional", "ofrece",
    "ofrecen", "tiene", "tienen", "existe", "existen", "2025", "2026", "2027",
    "periodo",
    # "programas académicos" ≡ "programas" for matching purposes
    "academico", "academica", "academicos", "academicas",
})
# Minimum share of the FAQ's core words the query must cover for the free
# lexical confirmation (see _lexical_subset).
_LEXICAL_COVERAGE = 0.75
# Student vocabulary -> the word the FAQ questions use (after _significant_words
# normalization: lowercase, no accents).
_PROGRAM_SYNONYMS: dict[str, str] = {
    "carrera": "programas", "carreras": "programas",
    "pregrado": "programas", "pregrados": "programas",
    "programa": "programas",
}

_JUDGE_PROMPT = (
    "Pregunta de un usuario a un chatbot universitario:\n«{question}»\n\n"
    "Preguntas frecuentes candidatas:\n{candidates}\n\n"
    "¿Alguna candidata pide EXACTAMENTE la misma información que el usuario? "
    "Cuenta como la misma solo si piden el mismo dato (no basta el mismo tema: "
    "costo ≠ créditos, inscripción ≠ matrícula, primer semestre ≠ segundo "
    "semestre, un programa ≠ otro programa). Si el usuario pide algo más "
    "específico o distinto, no es la misma.\n"
    "Responde SOLO con el número de la candidata, o 0 si ninguna."
)


@dataclass(frozen=True)
class FaqMatch:
    entry: FaqEntry
    similarity: float


@dataclass(frozen=True)
class FaqLookup:
    """Result of matching one user question against the FAQ table."""
    hit: FaqMatch | None = None          # answer with this entry, no LLM
    suggestion: FaqMatch | None = None   # related entry to offer the user


@dataclass
class FaqTrace:
    """Step-by-step record of one lookup — for the admin "probar
    coincidencia" tool (see routers/faq.py), never used by chat itself."""
    candidates: list[dict] = field(default_factory=list)
    judge_used: bool = False
    judge_choice: int | None = None
    judge_error: str | None = None


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
        for field_name, value in changes.items():
            setattr(entry, field_name, value)
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

    # ── Guards ────────────────────────────────────────────────────────────

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

    @classmethod
    def _core_words(cls, text: str) -> set[str]:
        words = canonicalize_price_words(_significant_words(text)) - _FILLER_WORDS
        # "carreras"/"pregrados" are what students say for "programas" —
        # advisor's test 2026-10-19: "qué carreras ofrecen" did not reach the
        # FAQ "¿Qué programas académicos ofrece Uniputumayo?".
        return {_PROGRAM_SYNONYMS.get(w, w) for w in words}

    @classmethod
    def _lexical_subset(cls, entry: FaqEntry, query_text: str) -> bool:
        """Free confirmation: the user's question is, word for word, a
        shorter way of asking the FAQ question ("cuánto cuesta la
        inscripción" ⊂ "¿Cuánto cuesta la inscripción en Uniputumayo?",
        "cuándo empiezan las clases" ⊂ "...de 2026-II?").

        Both sides drop filler (_FILLER_WORDS) and canonicalize price
        synonyms (valor/precio -> costo), same as the answer cache. Then:
        at least two query words, all of them in the FAQ, and covering at
        least _LEXICAL_COVERAGE of the FAQ's own words — so "cuánto cuesta"
        alone (2 of the 3 words of "cuánto cuesta la inscripción") is NOT
        enough: it fits several cost FAQs and must go to the judge."""
        query_words = cls._core_words(query_text)
        faq_words = cls._core_words(entry.question)
        if not query_words or not faq_words or not query_words <= faq_words:
            return False
        # A one-word question only counts when the FAQ itself boils down to
        # that one word ("qué carreras ofrecen" ⊂ "¿Qué programas académicos
        # ofrece Uniputumayo?" → both {programas}).
        if len(query_words) < 2 and len(faq_words) != 1:
            return False
        return len(query_words) / len(faq_words) >= _LEXICAL_COVERAGE

    # ── Matching ──────────────────────────────────────────────────────────

    async def match(
        self,
        embedding: list[float],
        query_text: str,
        aliases: dict[str, str] | None = None,
        trace: FaqTrace | None = None,
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
        candidates = [(entry, 1.0 - float(dist)) for entry, dist in rows]
        if trace is not None:
            trace.candidates = [
                {
                    "id": str(entry.id),
                    "question": entry.question,
                    "similarity": round(sim, 3),
                    "guards_pass": self._guards_pass(entry, query_text, aliases),
                    "lexical_subset": self._lexical_subset(entry, query_text),
                }
                for entry, sim in candidates
            ]
        lookup = self.pick(candidates, query_text, aliases)
        if lookup.hit is None:
            confirmed = await self._confirm_paraphrase(candidates, query_text, aliases, trace)
            if confirmed is not None:
                return FaqLookup(hit=confirmed)
        return lookup

    @classmethod
    def pick(
        cls,
        candidates: list[tuple[FaqEntry, float]],
        query_text: str,
        aliases: dict[str, str] | None = None,
    ) -> FaqLookup:
        """Pure decision step (unit-testable without a DB): given candidates
        sorted by descending similarity, decide hit / suggestion / nothing
        from similarity alone. The medium-band confirmation lives in
        `_confirm_paraphrase`."""
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

    async def _confirm_paraphrase(
        self,
        candidates: list[tuple[FaqEntry, float]],
        query_text: str,
        aliases: dict[str, str] | None,
        trace: FaqTrace | None = None,
    ) -> FaqMatch | None:
        """Below faq_similarity_threshold: confirm a paraphrase for free
        (lexical subset, from faq_lexical_threshold up) or with one minimal
        auxiliary-model call (from faq_judge_threshold up). Guards apply
        exactly as for a direct hit."""
        eligible = [
            (entry, sim) for entry, sim in candidates
            if sim < settings.faq_similarity_threshold
            and self._guards_pass(entry, query_text, aliases)
        ]
        for entry, sim in eligible:
            if sim >= settings.faq_lexical_threshold and self._lexical_subset(entry, query_text):
                logger.info(
                    "FAQ hit (lexical subset) | faq=%s | similarity=%.3f | q=%r",
                    entry.id, sim, query_text[:80],
                )
                return FaqMatch(entry, sim)
        band = [(entry, sim) for entry, sim in eligible if sim >= settings.faq_judge_threshold]
        if not band:
            return None
        # runtime_config, not settings: the OpenAI key can be set from the
        # admin panel after startup.
        if not settings.faq_judge_enabled or not runtime_config.openai_api_key:
            return None
        if trace is not None:
            trace.judge_used = True
        choice = await self._judge(query_text, [entry for entry, _ in band], trace)
        if choice is None:
            return None
        entry, sim = band[choice]
        logger.info(
            "FAQ hit (judge confirmed) | faq=%s | similarity=%.3f | q=%r",
            entry.id, sim, query_text[:80],
        )
        return FaqMatch(entry, sim)

    async def _judge(
        self, query_text: str, entries: list[FaqEntry], trace: FaqTrace | None = None,
    ) -> int | None:
        """Ask the auxiliary model which candidate (if any) asks for exactly
        the same fact. Returns the 0-based index or None. Best-effort: any
        failure means "not confirmed", never an error for the user."""
        numbered = "\n".join(f"{i + 1}. {e.question}" for i, e in enumerate(entries))
        prompt = _JUDGE_PROMPT.format(question=query_text.strip(), candidates=numbered)
        try:
            provider = ProviderFactory.get_provider("openai")
            result = await asyncio.wait_for(
                provider.generate(
                    messages=[{"role": "user", "content": prompt}],
                    model=settings.openai_condensation_model, temperature=0.0, max_tokens=5,
                ),
                timeout=settings.faq_judge_timeout_seconds,
            )
        except Exception as e:
            logger.warning("FAQ judge unavailable, not confirming: %s: %s", type(e).__name__, e)
            if trace is not None:
                trace.judge_error = f"{type(e).__name__}: {e}"
            return None
        match = re.search(r"\d+", result.get("content", "") or "")
        number = int(match.group()) if match else 0
        if trace is not None:
            trace.judge_choice = number
        if 1 <= number <= len(entries):
            return number - 1
        return None
