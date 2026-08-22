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
    r"aplazamiento|aplazar|cancelaci[oó]n|cancelar|supletorio"
    r")\b",
    re.IGNORECASE,
)


def is_varying_topic_query(query: str) -> bool:
    """True if the query is about a topic that genuinely differs by program or
    faculty (see _VARYING_TOPIC_PATTERNS) — the first gate for deciding whether
    to ask "which program?" instead of answering directly. A query can only be
    treated as ambiguous if it passes this gate; institution-wide topics
    (admisión, costos, sedes, ...) never trigger a clarification regardless of
    how many programs' documents the RAG search happens to retrieve.

    Procedural questions (see _PROCEDURAL_TOPIC_PATTERNS) are excluded first,
    regardless of what curriculum nouns they happen to contain — they're
    about an institution-wide process, not program-specific content.
    """
    if _PROCEDURAL_TOPIC_PATTERNS.search(query):
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
