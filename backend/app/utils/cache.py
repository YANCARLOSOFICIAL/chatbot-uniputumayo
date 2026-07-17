"""Cache layer for RAG results, embeddings, and final chat answers.

- AsyncRAGCache: async-compatible.  Uses Redis when REDIS_URL is configured
  (cache survives restarts, shared across workers); falls back to in-memory TTL
  dict otherwise.  Callers must await get() / set() / invalidate_all().

- AsyncAnswerCache: semantic cache for full chat answers, keyed by embedding
  similarity rather than exact text — see class docstring below.

- TTLCache: sync in-memory cache for embedding vectors.  Redis is NOT used here
  because each embedding call is cheap and session-local; making it async would
  require changes to all provider code for minimal benefit.
"""

import hashlib
import json
import logging
import re
import time
import unicodedata

logger = logging.getLogger(__name__)

_SENTINEL = object()


_CAMEL_BOUNDARY_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _significant_words(text: str) -> set[str]:
    """Words of length >= 4 from normalized text — cheap proxy for named entities
    (program/faculty names) without needing a fixed vocabulary or extra calls.

    Splits CamelCase boundaries before normalizing — real uploaded document
    titles are filenames like "07_DesarrolloSoftware_e_IngSistemas", where
    underscores already separate "e" from "IngSistemas" but nothing splits
    "Ing" from "Sistemas". Without this, the whole run comes out as one
    token ("ingsistemas") that never matches a query saying just "sistemas",
    which — confirmed live against every real document currently uploaded —
    silently defeats the entity guard on document-title fallback (see
    _entity_guard_passes): it would reject the document's own program name.
    """
    text = _CAMEL_BOUNDARY_RE.sub(" ", text)
    return {w for w in re.findall(r"[a-z0-9]+", _normalize(text)) if len(w) >= 4}


_SEMESTER_ORDINAL_WORDS = {
    "primer": "1", "primero": "1", "segundo": "2", "tercer": "3", "tercero": "3",
    "cuarto": "4", "quinto": "5", "sexto": "6", "septimo": "7", "octavo": "8",
    "noveno": "9", "decimo": "10", "undecimo": "11", "duodecimo": "12",
    "ultimo": "ULTIMO",
}
_SEMESTER_CARDINAL_WORDS = {
    "uno": "1", "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
    "seis": "6", "siete": "7", "ocho": "8", "nueve": "9", "diez": "10",
}
_SEMESTER_ROMAN_WORDS = {
    "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6",
    "vii": "7", "viii": "8", "ix": "9", "x": "10", "xi": "11", "xii": "12",
}


def _semester_reference(text: str) -> str | None:
    """Extract which semester (as a canonical string, e.g. "3") a question
    refers to, if any — "tercer semestre", "semestre 3", "semestre III" and
    "semestre tres" all resolve to "3"; "último semestre" resolves to the
    sentinel "ULTIMO" (its actual number varies by program, but it's still a
    specific, single semester, distinct from any numbered one). Returns None
    when the text doesn't mention a semester at all.
    """
    words = re.findall(r"[a-z0-9]+", _normalize(text))
    for w in words:
        if w in _SEMESTER_ORDINAL_WORDS:
            return _SEMESTER_ORDINAL_WORDS[w]
    for i, w in enumerate(words):
        if w == "semestre" and i + 1 < len(words):
            nxt = words[i + 1]
            if nxt.isdigit():
                return nxt
            if nxt in _SEMESTER_CARDINAL_WORDS:
                return _SEMESTER_CARDINAL_WORDS[nxt]
            if nxt in _SEMESTER_ROMAN_WORDS:
                return _SEMESTER_ROMAN_WORDS[nxt]
    return None


# ── Sync in-memory cache (embeddings) ────────────────────────────────────────

class TTLCache:
    """Dict-backed sync cache with per-entry TTL and LRU eviction."""

    def __init__(self, ttl_seconds: int = 1800, max_size: int = 512):
        self._ttl = ttl_seconds
        self._max = max_size
        self._store: dict[str, tuple] = {}

    def make_key(self, **kwargs) -> str:
        raw = json.dumps(kwargs, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, key: str):
        entry = self._store.get(key, _SENTINEL)
        if entry is _SENTINEL:
            return None
        value, ts = entry
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value) -> None:
        if len(self._store) >= self._max:
            self._evict_oldest()
        self._store[key] = (value, time.monotonic())

    def invalidate_all(self) -> None:
        self._store.clear()
        logger.info("Embedding cache invalidated")

    def _evict_oldest(self) -> None:
        if not self._store:
            return
        oldest = min(self._store, key=lambda k: self._store[k][1])
        del self._store[oldest]


# ── Async RAG cache (Redis-backed or in-memory) ───────────────────────────────

class AsyncRAGCache:
    """Async cache for SearchResponse objects.

    Call `await connect_redis(url)` from the app lifespan to enable Redis.
    If Redis is not configured or unreachable, falls back to in-memory TTL dict.
    Callers must await all public methods.
    """

    def __init__(self, ttl_seconds: int = 1800, max_size: int = 512):
        self._ttl = ttl_seconds
        self._max = max_size
        self._store: dict[str, tuple] = {}  # in-memory fallback
        self._redis = None

    # ── Setup ─────────────────────────────────────────────────────────────────

    async def connect_redis(self, url: str) -> bool:
        """Try to connect to Redis. Returns True on success, False on failure."""
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(url, socket_connect_timeout=3, decode_responses=False)
            await client.ping()
            self._redis = client
            logger.info("RAG cache: connected to Redis at %s", url)
            return True
        except Exception as e:
            logger.warning("Redis unavailable — using in-memory RAG cache: %s", e)
            return False

    # ── Key builder (sync helper, no I/O) ────────────────────────────────────

    def make_key(self, **kwargs) -> str:
        raw = json.dumps(kwargs, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()

    # ── Core operations ───────────────────────────────────────────────────────

    async def get(self, key: str):
        if self._redis is not None:
            try:
                data = await self._redis.get(f"rag:{key}")
                if data:
                    from app.schemas.rag import SearchResponse
                    return SearchResponse.model_validate_json(data)
            except Exception as e:
                logger.debug("Redis get error (falling through): %s", e)
            return None

        # In-memory path
        entry = self._store.get(key, _SENTINEL)
        if entry is _SENTINEL:
            return None
        value, ts = entry
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            return None
        return value

    async def set(self, key: str, value) -> None:
        if self._redis is not None:
            try:
                await self._redis.setex(f"rag:{key}", self._ttl, value.model_dump_json())
            except Exception as e:
                logger.debug("Redis set error: %s", e)
            return

        # In-memory path
        if len(self._store) >= self._max:
            self._evict_oldest()
        self._store[key] = (value, time.monotonic())

    async def invalidate_all(self) -> None:
        if self._redis is not None:
            try:
                async for k in self._redis.scan_iter("rag:*"):
                    await self._redis.delete(k)
            except Exception as e:
                logger.debug("Redis invalidate error: %s", e)
        else:
            self._store.clear()
        logger.info("RAG cache invalidated")

    def size(self) -> int:
        """Entry count. Returns -1 for Redis (unknown without SCAN)."""
        if self._redis is not None:
            return -1
        return len(self._store)

    # ── Internals ─────────────────────────────────────────────────────────────

    def _evict_oldest(self) -> None:
        if not self._store:
            return
        oldest = min(self._store, key=lambda k: self._store[k][1])
        del self._store[oldest]


# ── Async semantic answer cache (Redis-backed or in-memory) ───────────────────

class AsyncAnswerCache:
    """Semantic cache for final chat answers, keyed by embedding similarity.

    Unlike AsyncRAGCache (which caches *retrieved chunks* under an exact-text
    key), this caches the LLM's *final answer* and matches new questions by
    cosine similarity between query embeddings — so paraphrases like "cuáles
    son las materias de administración" and "qué materias tiene admin de
    empresas" hit the same cached answer instead of re-running RAG + LLM.

    This matters specifically on CPU-only Ollama without AVX2/GPU, where
    generation is the bottleneck (a few tokens/sec): a cache hit answers in
    roughly the time of one embedding call (~1-2s) instead of minutes.

    Entries are stored as a bounded, most-recent-first list (Redis LIST, or an
    in-memory list as fallback) — small enough (a few hundred entries) that a
    linear cosine-similarity scan on every lookup is negligible next to LLM
    latency, without needing a vector-search-capable Redis build.
    """

    _REDIS_KEY = "answer_cache:entries"

    def __init__(
        self,
        ttl_seconds: int = 604800,
        max_size: int = 300,
        similarity_threshold: float = 0.93,
    ):
        self._ttl = ttl_seconds
        self._max = max_size
        self._threshold = similarity_threshold
        self._store: list[dict] = []  # in-memory fallback, most-recent-first
        self._redis = None

    # ── Setup ─────────────────────────────────────────────────────────────────

    async def connect_redis(self, url: str) -> bool:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(url, socket_connect_timeout=3, decode_responses=False)
            await client.ping()
            self._redis = client
            logger.info("Answer cache: connected to Redis at %s", url)
            return True
        except Exception as e:
            logger.warning("Redis unavailable — using in-memory answer cache: %s", e)
            return False

    # ── Similarity ────────────────────────────────────────────────────────────

    @staticmethod
    def _cosine(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(y * y for y in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    async def _load_entries(self) -> list[dict]:
        if self._redis is not None:
            try:
                raw = await self._redis.lrange(self._REDIS_KEY, 0, -1)
                return [json.loads(r) for r in raw]
            except Exception as e:
                logger.debug("Answer cache load error (falling through): %s", e)
                return []
        return list(self._store)

    # ── Core operations ───────────────────────────────────────────────────────

    @staticmethod
    def _entity_guard_passes(entry: dict, query_text: str) -> bool:
        """Reject a cosine-similarity match when the cached answer is scoped to
        a specific program/faculty that the new query doesn't name.

        Cosine similarity on short questions can't reliably tell apart
        "requisitos de admisión para medicina" from "...para enfermería" —
        near-identical phrasing, different program. Guard against that by
        requiring the query to mention at least one significant word from the
        program/faculty the cached sources were scoped to. Skipped entirely
        when the cached sources span multiple programs/faculties (a genuinely
        general question), since there's no single entity to check against.

        `document.program`/`document.faculty` are optional, admin-filled
        fields at upload time — confirmed live that every document currently
        uploaded has both empty, which would make this guard a silent no-op
        for all of them. Falling back to the document title (always
        populated) when neither field gave anything to check keeps the
        guard active instead of quietly doing nothing.
        """
        sources = entry.get("sources") or []
        query_words = _significant_words(query_text)

        checked_any_field = False
        for field in ("program", "faculty"):
            values = {s.get(field) for s in sources if s.get(field)}
            if len(values) != 1:
                continue  # ambiguous/generic — nothing specific to guard
            entity_words = _significant_words(next(iter(values)))
            if not entity_words:
                continue
            checked_any_field = True
            if not (entity_words & query_words):
                return False

        if not checked_any_field:
            titles = {s.get("document_title") for s in sources if s.get("document_title")}
            if len(titles) == 1:
                entity_words = _significant_words(next(iter(titles)))
                if entity_words and not (entity_words & query_words):
                    return False

        return True

    @staticmethod
    def _semester_guard_passes(entry: dict, query_text: str) -> bool:
        """Reject a match when the query and the cached question name
        different semesters of what's otherwise the same program/document.

        Confirmed live: "tercer semestre" vs "cuarto semestre" of the same
        curriculum scores 0.9250 cosine similarity with the answer-cache
        embedding model — above even a conservative similarity threshold —
        and the program/faculty/title entity guard above doesn't help at
        all here, since both questions are about the exact same document,
        just a different semester within it. Skipped when either side
        doesn't name a semester at all.
        """
        query_sem = _semester_reference(query_text)
        cached_sem = _semester_reference(entry.get("question", ""))
        return query_sem is None or cached_sem is None or query_sem == cached_sem

    async def find_similar(self, embedding: list[float], query_text: str = "") -> dict | None:
        """Return the best-matching cached entry if similarity clears the
        threshold AND it passes the entity/semester guards, else None. Entry
        dict has: question, answer, sources, llm_provider, llm_model."""
        entries = await self._load_entries()
        now = time.time()
        best: dict | None = None
        best_score = 0.0
        for entry in entries:
            if now - entry.get("ts", 0) > self._ttl:
                continue
            score = self._cosine(embedding, entry["embedding"])
            if score > best_score:
                best_score = score
                best = entry
        if best is not None and best_score >= self._threshold:
            if query_text and not self._semester_guard_passes(best, query_text):
                logger.info(
                    "Answer cache guard rejected hit (similarity=%.3f, semester mismatch): '%.60s…'",
                    best_score, query_text,
                )
                return None
            if query_text and not self._entity_guard_passes(best, query_text):
                logger.info(
                    "Answer cache guard rejected hit (similarity=%.3f, entity mismatch): '%.60s…'",
                    best_score, query_text,
                )
                return None
            logger.info(
                "Answer cache HIT (similarity=%.3f): '%.60s…'",
                best_score, best.get("question", ""),
            )
            return best
        return None

    async def store(
        self,
        embedding: list[float],
        question: str,
        answer: str,
        sources: list[dict],
        llm_provider: str,
        llm_model: str,
    ) -> None:
        entry = {
            "embedding": embedding,
            "question": question,
            "answer": answer,
            "sources": sources,
            "llm_provider": llm_provider,
            "llm_model": llm_model,
            "ts": time.time(),
        }
        if self._redis is not None:
            try:
                await self._redis.lpush(self._REDIS_KEY, json.dumps(entry))
                await self._redis.ltrim(self._REDIS_KEY, 0, self._max - 1)
                # Safety-net expiry on the whole list; find_similar() already
                # filters individually-stale entries by `ts` on every read.
                await self._redis.expire(self._REDIS_KEY, self._ttl)
            except Exception as e:
                logger.debug("Answer cache store error: %s", e)
            return

        self._store.insert(0, entry)
        if len(self._store) > self._max:
            self._store.pop()

    async def invalidate_all(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.delete(self._REDIS_KEY)
            except Exception as e:
                logger.debug("Answer cache invalidate error: %s", e)
        else:
            self._store.clear()
        logger.info("Answer cache invalidated")


# ── Module-level singletons ───────────────────────────────────────────────────

# RAG query cache: async, optionally Redis-backed
rag_cache = AsyncRAGCache(ttl_seconds=1800, max_size=512)

# Answer cache: async, optionally Redis-backed — see Settings for tunables
from app.config import settings  # noqa: E402  (after class defs to avoid import cycles)

answer_cache = AsyncAnswerCache(
    ttl_seconds=settings.answer_cache_ttl_seconds,
    max_size=settings.answer_cache_max_entries,
    similarity_threshold=settings.answer_cache_similarity_threshold,
)

# Embedding cache: sync in-memory only (deterministic, no cross-session benefit from Redis)
embedding_cache = TTLCache(ttl_seconds=21600, max_size=2048)

# Suggested-questions cache (welcome screen): stable for a few minutes so the
# cards don't shuffle mid-session, re-rolled periodically so they stay fresh
# as new documents get indexed.
suggestion_cache = TTLCache(ttl_seconds=600, max_size=4)
