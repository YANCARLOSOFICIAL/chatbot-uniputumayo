"""Query analysis utilities for adaptive RAG behavior."""
from __future__ import annotations

import re


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
