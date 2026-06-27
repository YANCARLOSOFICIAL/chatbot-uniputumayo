"""Query analysis utilities for adaptive RAG behavior."""
from __future__ import annotations

import re


# Keywords that indicate a factual/deterministic query
_FACTUAL_PATTERNS = re.compile(
    r"\b("
    r"materias?|asignaturas?|semestre|pensum|plan de estudios|créditos?|"
    r"código|códigos|requisito|prerrequisito|duración|cu[aá]ntos?|cu[aá]ntas?|"
    r"costo|precio|valor|matrícula|inscripci[oó]n|fecha|plazo|horario|"
    r"snies|acreditaci[oó]n|resoluci[oó]n|decreto|sedes?|facultad|"
    r"programa|programas|admisiones?|puntaje|promedio|título|grado|"
    r"modalidad|presencial|distancia|virtual|jornada|diurna|nocturna"
    r")\b",
    re.IGNORECASE,
)

_CONVERSATIONAL_PATTERNS = re.compile(
    r"\b(hola|buenas|buenos|saludos|gracias|por favor|ayuda|explica|"
    r"cu[eé]ntame|d[eé]jame saber|interesante|genial)\b",
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
