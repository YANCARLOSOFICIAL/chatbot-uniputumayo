"""Tests for app.utils.query_utils."""
from app.utils.query_utils import detect_temperature, keyword_score


class TestDetectTemperature:
    def test_factual_query_returns_zero(self):
        assert detect_temperature("¿Cuáles son las materias del programa?") == 0.0
        assert detect_temperature("requisito de admisión") == 0.0
        assert detect_temperature("¿Cuántos semestres tiene?") == 0.0
        assert detect_temperature("pensum de ingeniería de sistemas") == 0.0
        assert detect_temperature("costo de matrícula") == 0.0
        assert detect_temperature("código SNIES del programa") == 0.0

    def test_conversational_query_returns_015(self):
        assert detect_temperature("Hola, buenos días") == 0.15
        assert detect_temperature("Gracias por la información") == 0.15
        assert detect_temperature("Cuéntame sobre la universidad") == 0.15

    def test_general_query_returns_default(self):
        # No factual or conversational patterns
        assert detect_temperature("¿Qué ofrece la IUP?") == 0.05
        assert detect_temperature("información general") == 0.05

    def test_custom_default(self):
        assert detect_temperature("¿Qué ofrece?", default=0.1) == 0.1

    def test_factual_takes_priority_over_conversational(self):
        # Contains both "hola" and "materias"
        assert detect_temperature("Hola, ¿cuáles son las materias?") == 0.0

    def test_empty_query(self):
        assert detect_temperature("") == 0.05

    def test_case_insensitive(self):
        assert detect_temperature("MATERIAS DEL PROGRAMA") == 0.0
        assert detect_temperature("HOLA QUÉ TAL") == 0.15


class TestKeywordScore:
    def test_full_overlap(self):
        assert keyword_score("hello world", "hello world") == 1.0

    def test_no_overlap(self):
        assert keyword_score("foo bar", "baz qux") == 0.0

    def test_partial_overlap(self):
        score = keyword_score("ingeniería sistemas", "programa de ingeniería")
        assert 0.0 < score < 1.0

    def test_empty_query(self):
        assert keyword_score("", "some text") == 0.0

    def test_case_insensitive(self):
        assert keyword_score("HELLO World", "hello world test") == 1.0

    def test_query_subset_of_text(self):
        score = keyword_score("one two", "one two three four five")
        assert score == 1.0

    def test_text_subset_of_query(self):
        score = keyword_score("one two three four", "one two")
        assert score == 0.5
