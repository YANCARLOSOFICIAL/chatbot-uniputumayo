"""Query analysis utilities for adaptive RAG behavior."""
from __future__ import annotations

import re
import unicodedata


_CAMEL_BOUNDARY_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


# Spanish interrogative/functional words that happen to be >= 4 chars —
# excluded from _significant_words because they show up interchangeably
# across paraphrases of the SAME question ("de admision" vs "para admision")
# without changing its meaning, and would never legitimately be part of a
# program/faculty/document-title entity name. Confirmed live: swapping "de"
# for "para" alone dropped what should have been a same-question match
# (query_words no longer a subset of the cached question's words) purely
# because "para" (4 chars) counted as significant while "de" (2 chars)
# didn't — an artifact of the length cutoff, not a real topic difference.
_STOPWORDS: frozenset[str] = frozenset({
    "para", "cual", "cuales", "como", "donde", "cuando", "porque", "sobre",
    "entre", "desde", "hasta", "este", "esta", "estos", "estas", "esos",
    "esas", "otro", "otra", "otros", "otras", "todo", "toda", "todos",
    "todas", "sera", "seran", "hacer",
})


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
    cache.py's _entity_guard_passes): it would reject the document's own
    program name.

    Filters out _STOPWORDS (see above) for the same reason: a length cutoff
    alone can't tell "para" apart from an actual entity word just because
    both are 4+ characters.
    """
    text = _CAMEL_BOUNDARY_RE.sub(" ", text)
    return {
        w for w in re.findall(r"[a-z0-9]+", _normalize(text))
        if len(w) >= 4 and w not in _STOPWORDS
    }


def mentions_entity(query: str, entity_name: str, min_overlap: float = 0.5) -> bool:
    """True if enough of entity_name's significant words already appear in query
    to consider it already specified — used to skip asking "which program?" when
    the user already named one, and to detect a clarification reply that named
    the entity (accent/case-insensitive, via _significant_words normalization,
    so "Ingenieria" from voice transcription still matches "Ingeniería").
    """
    entity_words = _significant_words(entity_name)
    if not entity_words:
        return False
    query_words = _significant_words(query)
    overlap = query_words & entity_words
    return len(overlap) / len(entity_words) >= min_overlap


# Keywords that indicate a factual/deterministic query. Plurals are spelled
# out explicitly (not just `?` on the final letter) because several of these
# nouns pluralize irregularly in Spanish (valor -> valores, facultad ->
# facultades) — a bare `s?` would silently miss those forms. Confirmed live
# this actually mattered: "requisito" (singular-only, no `s?` at all) never
# matched "requisitos" — the plural is the more common phrasing — which fed
# directly into the is_greeting() bug below (a factual-pattern miss is a
# precondition for being misclassified as a greeting).
_FACTUAL_PATTERNS = re.compile(
    r"\b("
    r"materias?|asignaturas?|semestres?|pensum|plan(?:es)? de estudios?|créditos?|"
    r"c[oó]digos?|requisitos?|prerrequisitos?|duraci[oó]n|cu[aá]ntos?|cu[aá]ntas?|"
    r"costos?|precios?|valores?|matr[ií]culas?|inscripci[oó]n(?:es)?|fechas?|plazos?|horarios?|"
    r"snies|acreditaci[oó]n|resoluci[oó]n|decretos?|sedes?|facultades?|ubicaci[oó]n|direcci[oó]n|"
    r"programas?|admisiones?|puntajes?|promedios?|t[ií]tulos?|grados?|"
    r"modalidad(?:es)?|presencial|distancia|virtual|jornadas?|diurna|nocturna"
    r")\b",
    re.IGNORECASE,
)

# Topics confirmed by the institution to actually differ between programs
# (or between program/faculty-level pages), as opposed to institution-wide
# topics that are the same for everyone regardless of program — e.g.
# "requisitos de admisión" is the SAME process for every program at
# Uniputumayo, so it's deliberately NOT here even though it's in
# _FACTUAL_PATTERNS above; asking "¿qué programa?" for an admission question
# would be a false-positive clarification. Also deliberately excludes
# "costos"/"matrícula"/"sedes"/"horarios"/"fechas" for the same reason.
# "misión"/"visión" ARE included: the institution confirmed a program or
# faculty can have its own mission/vision distinct from the institutional one.
_VARYING_TOPIC_PATTERNS = re.compile(
    r"\b("
    r"pensum|plan(?:es)? de estudios?|materias?|asignaturas?|cr[eé]ditos?|"
    r"semestres?|duraci[oó]n|perfil (?:profesional|ocupacional|del egresado)|"
    r"t[ií]tulos?|titulaci[oó]n|egresados?|snies|misi[oó]n|visi[oó]n"
    r")\b",
    re.IGNORECASE,
)

# Administrative/academic PROCEDURES governed by the Estatuto Estudiantil —
# the same process for every program — even though they routinely mention a
# curriculum noun ("materia", "asignatura", "semestre") in passing. Checked
# before _VARYING_TOPIC_PATTERNS so that mention alone doesn't win: "¿qué hago
# si pierdo una materia?" is asking about the reprobación/repetición
# procedure, not about which materias a program teaches. Confirmed live
# (GoldStandard eval 2026-08-21): GS-035/036/083/085/095 all false-triggered
# a "¿sobre cuál programa?" clarification purely from containing
# "asignaturas"/"materia"/"semestre", despite each having a single,
# program-independent answer.
_PROCEDURAL_TOPIC_PATTERNS = re.compile(
    r"\b("
    r"homologaci[oó]n|homologar|convalidaci[oó]n|convalidar|validar|"
    r"perd[ií]|pierdo|perder|reprobar|reprobaci[oó]n|repetir|repetici[oó]n|"
    r"aplazamiento|aplazar|cancelaci[oó]n|cancelar|supletorio|"
    # 2026-09-05: p[ée]rdida de la calidad (GS-037) / reingres- (GS-038) —
    # same institution-wide-procedure class, confirmed to have real content
    # in ESTATUTO ESTUDIANTIL via a raw content search, just not yet covered
    # by this pattern. "grado"/"causales" alone deliberately left out: too
    # overloaded (grado = degree/grade-level; causales appears in unrelated
    # contexts too) to add without a live false-positive check.
    r"p[eé]rdida de la calidad|reingres\w*"
    r")\b",
    re.IGNORECASE,
)


# Questions that ask for the WHOLE enumeration of a per-program topic, not
# one program's value — "¿qué título se obtiene al terminar cada ciclo
# propedéutico?", "¿qué títulos ofrece la institución?", "¿cuánto dura cada
# programa?". The topic still varies by program (so _VARYING_TOPIC_PATTERNS
# matches), but the RIGHT answer spans every program — asking "¿sobre cuál
# programa?" is wrong, the user already said "todos". Also keeps
# _detect_program_filter from narrowing to one program. Confirmed live
# (GoldStandard GS-055): "cada ciclo propedéutico" was triggering a
# "¿Gastronomía / ingeniería civil / ingeniería de sistemas?" clarification
# on a question whose answer is the general two-title pattern.
_COLLECTIVE_ENUMERATION_PATTERNS = re.compile(
    r"\b("
    r"cada\s+(?:ciclo|programa|carrera|facultad|nivel|modalidad|especializaci[oó]n|tecnolog[ií]a|uno)|"
    r"cada\s+uno\s+de\s+(?:los|las)|"
    r"todos?\s+los\s+(?:ciclos?|programas?|niveles?|posgrados?|pregrados?)|"
    r"todas?\s+las\s+(?:carreras?|facultades?|modalidades?|especializaciones?|tecnolog[ií]as?)|"
    r"(?:qu[eé]|cu[aá]les)\s+(?:t[ií]tulos|programas|carreras|posgrados|pregrados|especializaciones)\b|"
    r"por\s+(?:cada\s+)?programa|"
    r"ciclos\s+proped[eé]uticos"
    r")\b",
    re.IGNORECASE,
)


# Questions asking specifically for the LAST semester (or the total semester
# count) of a program — "¿qué materias tiene el último semestre de X?",
# "¿cuántos semestres tiene X?". Root cause this exists for, confirmed live
# 2026-09-11 (GoldStandard GS-060/GS-064): the word "último" shares no
# literal token with any specific semester's label in the corpus ("VII",
# "X", "décimo"...), so plain semantic search has nothing to anchor on and
# inconsistently lands on the right chunk — it happens to work when HyDE's
# synthetic pseudo-document paraphrases toward the true last semester's
# wording, and reproducibly fails when it doesn't (confirmed live: Ollama,
# which has HyDE off for latency — see project_rag_performance_2026 memory —
# deterministically retrieved a WRONG, non-last semester's chunk and
# labeled it "el último" both in the original eval run and a fresh re-test).
# See rag_service.py's `_boost_last_semester_chunk` for the fix this powers:
# an explicit content-based lookup for the highest semester number, instead
# of trusting embedding similarity to infer "last" from "único".
_LAST_SEMESTER_PATTERNS = re.compile(
    r"\b(el\s+)?[uú]ltimo\s+semestre\b|"
    r"\bsemestre\s+final\b|"
    r"\bcu[aá]ntos?\s+semestres?\b|"
    r"\btotal\s+de\s+semestres?\b",
    re.IGNORECASE,
)


def is_last_semester_query(query: str) -> bool:
    """True if the query asks about a program's LAST semester or its total
    semester count — see `_LAST_SEMESTER_PATTERNS` docstring for why this
    needs a dedicated retrieval path rather than plain semantic search."""
    return bool(_LAST_SEMESTER_PATTERNS.search(query))


def is_procedural_query(query: str) -> bool:
    """True if the query is about an institution-wide administrative
    procedure (see _PROCEDURAL_TOPIC_PATTERNS) — exposed standalone (not just
    as `is_varying_topic_query`'s internal early-exit) so callers can use it
    as a positive signal too, not only a negative one.

    Added for `ChatService._run_rag`'s `exclude_document_type='pensum'`
    filter: these questions ("¿cómo se solicita el aplazamiento del
    semestre?") kept losing to every curriculum document's identical
    "=== RESUMEN DE MATERIAS POR SEMESTRE ===" boilerplate purely for sharing
    the word "semestre" — confirmed live 2026-09-05 that the real answer
    (ESTATUTO ESTUDIANTIL) didn't even make the retrieval candidate pool.
    """
    return bool(_PROCEDURAL_TOPIC_PATTERNS.search(query))


def is_varying_topic_query(query: str) -> bool:
    """True if the query is about a topic that genuinely differs by program or
    faculty (see _VARYING_TOPIC_PATTERNS) — the first gate for deciding whether
    to ask "which program?" instead of answering directly. A query can only be
    treated as ambiguous if it passes this gate; institution-wide topics
    (admisión, costos, sedes, ...) never trigger a clarification regardless of
    how many programs' documents the RAG search happens to retrieve.

    Procedural questions (see _PROCEDURAL_TOPIC_PATTERNS) and collective
    "enumerate every program" questions (see _COLLECTIVE_ENUMERATION_PATTERNS)
    are excluded first, regardless of what curriculum nouns they contain —
    the former is an institution-wide process, the latter already asks for
    all programs at once, so neither should trigger a "which program?"
    clarification or a single-program retrieval filter.
    """
    if _PROCEDURAL_TOPIC_PATTERNS.search(query):
        return False
    if _COLLECTIVE_ENUMERATION_PATTERNS.search(query):
        return False
    return bool(_VARYING_TOPIC_PATTERNS.search(query))


# Genuinely greeting/social words only — deliberately excludes generic verbs
# like "ayuda"/"explica"/"cuéntame" that were previously here: those open
# real factual questions just as often as actual greetings ("ayuda con la
# carrera de sistemas", "explica los requisitos" — confirmed live both were
# misclassified as greetings and got the canned welcome reply instead of an
# answer, with RAG never running at all). A word only belongs in this list
# if it essentially never opens a question that needs retrieval.
_CONVERSATIONAL_PATTERNS = re.compile(
    r"\b(hola|buenas|buenos|saludos|gracias|por favor|interesante|genial)\b",
    re.IGNORECASE,
)


def detect_temperature(query: str, default: float = 0.05) -> float:
    """Return the appropriate LLM temperature for the given query.

    - Factual (materias, requisitos, fechas, costos) → 0.0  (fully deterministic)
    - General institutional info → `default` (0.05 near-deterministic)
    - Conversational / open-ended → 0.15
    """
    if _FACTUAL_PATTERNS.search(query):
        return 0.0
    if _CONVERSATIONAL_PATTERNS.search(query):
        return 0.15
    return default


def is_greeting(query: str) -> bool:
    """True for short, purely conversational messages ("hola", "gracias") that
    don't need RAG context at all.

    Requires a conversational match AND no factual keyword AND a short
    message — a query like "hola, cuánto cuesta la matrícula" is conversational
    in tone but still needs retrieval, so it must not be short-circuited.
    """
    if _FACTUAL_PATTERNS.search(query):
        return False
    if not _CONVERSATIONAL_PATTERNS.search(query):
        return False
    return len(query.split()) <= 6


# Students ask about pecuniary matters with interchangeable words — "costos",
# "precios", "valores", "tarifas", "cuánto cuesta/vale" — while the knowledge
# base writes them literally as "costos" / "derechos pecuniarios" (e.g. the
# FICB024 response and Resolución 1056 de derechos pecuniarios). Confirmed
# live 2026-10-12: "¿cuáles son los costos de inscripción y matrícula del
# ciclo tecnológico...?" answered fine, but swapping "costos" for "precios"
# or "valores" got a "no tengo información" refusal. The full-text search leg
# (rag_service._keyword_search) stems precio->preci / costo->cost /
# valor->valor as distinct Spanish lexemes, so the synonym query loses the
# true chunk's strongest term matches, drops in ts_rank_cd, and falls out of
# the LIMIT against a full production corpus — while the "costos" phrasing
# keeps them. Vector search is semantic and doesn't need this; the exact-match
# leg is the one that deterministically breaks on synonyms.
_COST_PRICE_WORD_RE = re.compile(
    r"\b(precios?|tarifas?|cuesta(?:n)?|vale(?:n)?)\b",
    re.IGNORECASE,
)
# "valor/valores" alone is ambiguous ("valores institucionales" = principles,
# not prices) — only treated as pecuniary beside an explicit enrollment/money
# context word, so a principles question never gets price terms appended.
# NOTE: spelled `valor(?:es)?`, NOT `valores?` — the latter parses as
# "valore"+`s?` and never matches the singular "valor" (same irregular-plural
# trap _FACTUAL_PATTERNS documents for valor->valores).
_VALOR_WORD_RE = re.compile(r"\bvalor(?:es)?\b", re.IGNORECASE)
_PECUNIARY_CONTEXT_RE = re.compile(
    r"\b("
    r"matr[ií]culas?|matricular|inscripci[oó]n(?:es)?|inscribir|"
    r"pagos?|pagar|derechos?|pecuniarios?|financiaci[oó]n|becas?|"
    r"subsidios?|descuentos?|cuotas?|semestres?|ciclos?|programas?|"
    r"carreras?|cu[aá]nto|costos?|precios?|tarifas?|cuesta(?:n)?|vale(?:n)?"
    r")\b",
    re.IGNORECASE,
)
# The query already carries the canonical wording — nothing to add (also
# keeps today's working "costos" phrasing byte-identical, so its retrieval
# behavior and cache keys don't shift at all).
_ALREADY_CANONICAL_RE = re.compile(
    r"\b(costos?|derechos?|pecuniarios?)\b",
    re.IGNORECASE,
)

# Appended to the full-text query only (see expand_cost_synonyms). Covers the
# three literal wordings found in the corpus: "costos" (FICB024), "derechos
# pecuniarios" (resolutions) and "valor" (the Tríptico Oferta Académica price
# table — confirmed live 2026-10-12, the served answer quotes "Matrícula o
# valor total del semestre financiero" verbatim).
_COST_SYNONYM_EXPANSION = "costos derechos pecuniarios valor"


# "pagar"/"pagos" aren't in _COST_PRICE_WORD_RE (that list feeds the FTS
# synonym expansion, where appending price terms to "¿cómo pago la
# matrícula?" would be noise) but they are an unmistakable pecuniary signal
# for the retrieval-scope decision below.
_PAYMENT_WORD_RE = re.compile(r"\b(pagar|pagos?|pague|pagu[eé]n|inscripci[oó]n(?:es)?|matr[ií]culas?)\b", re.IGNORECASE)


def is_pecuniary_query(query: str) -> bool:
    """True if the query is about money — costs, prices, enrollment fees,
    how/how much to pay. Mirrors `is_procedural_query`'s role for
    `ChatService._run_rag`'s `exclude_document_type='pensum'` filter: the
    answer to any of these lives in the Tríptico de oferta / resoluciones de
    derechos pecuniarios / FICB024, never in a curriculum document, yet the
    curriculum documents flood the candidate pool for sharing "semestre",
    "ciclo tecnológico" or a program name. Confirmed live 2026-10-12 via the
    admin /rag/search endpoint: for "¿cuánto toca pagar para entrar al ciclo
    tecnológico?" and "¿qué valor tiene el semestre en una tecnología?",
    4–6 of the top-10 results were pensum chunks and the Tríptico (the only
    document with the prices) was not in the top 10 at all; for the
    canonical "costos de inscripción y matrícula..." wording it reached
    rank 10 of 10 — found by the FTS leg alone, score 0.35.

    Same ambiguity guard as expand_cost_synonyms: "valor/valores" counts only
    beside an explicit enrollment/money word, so "¿cuáles son los valores
    institucionales?" is NOT pecuniary.
    """
    if _ALREADY_CANONICAL_RE.search(query) or _COST_PRICE_WORD_RE.search(query):
        return True
    if _VALOR_WORD_RE.search(query) and _PECUNIARY_CONTEXT_RE.search(query):
        return True
    return bool(_PAYMENT_WORD_RE.search(query))


def expand_cost_synonyms(query: str) -> str:
    """Append canonical price terms to a pecuniary query phrased with a synonym.

    Expansion (append), never replacement: the original words stay, so nothing
    is lost if the corpus happens to use the synonym literally too, and
    non-pecuniary queries are returned byte-identical (zero behavior change
    for all other traffic — see _ALREADY_CANONICAL_RE / _VALOR_WORD_RE above).

    Meant for the exact-match retrieval leg only (rag_service._keyword_search),
    not for what's shown to the LLM or used as a cache key.
    """
    if _ALREADY_CANONICAL_RE.search(query):
        return query
    if _COST_PRICE_WORD_RE.search(query):
        return f"{query} {_COST_SYNONYM_EXPANSION}"
    if _VALOR_WORD_RE.search(query) and _PECUNIARY_CONTEXT_RE.search(query):
        return f"{query} {_COST_SYNONYM_EXPANSION}"
    return query


# Canonical form for price-synonym words in word-set comparisons (the
# answer-cache entity guard — see cache.AsyncAnswerCache._entity_guard_passes).
# Same live case as expand_cost_synonyms above, one layer downstream:
# 2026-10-12, "¿cuáles son los costos de inscripción y matrícula...?" answered
# and cached, but "...los precios..." was refused. The guard's "same
# question" subset check compares the new query's significant words against
# the cached question's — "precios" ∉ {"costos", ...} breaks the subset, and
# the title fallback ("resolucion"/"pecuniarios" never named by the query)
# rejects a hit the cosine similarity had already approved (logged live:
# "guard rejected hit (similarity=0.973, entity mismatch)"). Mapping every
# price synonym to "costo" makes the guard see the same question it is.
# Normalized (accent-stripped, lowercase) forms only, matching
# _significant_words output — callers must canonicalize AFTER extracting
# significant words, not on raw text.
_PRICE_SYNONYM_CANONICAL = "costo"
_PRICE_SYNONYM_WORDS: frozenset[str] = frozenset({
    "precio", "precios", "valor", "valores", "tarifa", "tarifas",
    "cuesta", "cuestan", "vale", "valen", "costo", "costos",
})


def canonicalize_price_words(words: set[str]) -> set[str]:
    """Map every price-synonym word in `words` to "costo", leave the rest.

    Pure set transformation for guard comparisons only — never applied to text
    shown to the LLM or embedded for retrieval. Safe against the ambiguous
    "valores" (principles vs prices): the guard still requires cosine
    similarity >= threshold AND (question-subset OR title/entity overlap),
    and a genuinely different question ("valores institucionales") still
    breaks both checks on its remaining words — see the tests.
    """
    return {
        _PRICE_SYNONYM_CANONICAL if w in _PRICE_SYNONYM_WORDS else w
        for w in words
    }


def keyword_score(query: str, text: str) -> float:
    """Simple TF-style keyword overlap score [0, 1] between query and chunk text.

    Used as a lightweight re-ranking signal after the vector search.
    """
    q_tokens = set(re.findall(r"\w+", query.lower()))
    t_tokens = set(re.findall(r"\w+", text.lower()))
    if not q_tokens:
        return 0.0
    overlap = q_tokens & t_tokens
    # Precision from the query's perspective (how much of the query is covered)
    return len(overlap) / len(q_tokens)
