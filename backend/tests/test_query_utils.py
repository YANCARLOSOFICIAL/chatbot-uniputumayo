from app.utils.query_utils import detect_temperature, is_greeting, keyword_score


class TestDetectTemperature:
    def test_factual_query_is_fully_deterministic(self):
        assert detect_temperature("¿Cuántos créditos tiene el programa de enfermería?") == 0.0

    def test_conversational_query_gets_higher_temperature(self):
        assert detect_temperature("Hola, gracias por la ayuda") == 0.15

    def test_general_query_gets_default(self):
        assert detect_temperature("Uniputumayo fue fundada en 1975", default=0.05) == 0.05

    def test_factual_wins_over_conversational_when_both_present(self):
        # "hola" is conversational, but "créditos" is factual — factual must win
        # so a real informational question doesn't get bumped to a higher temperature.
        assert detect_temperature("hola, cuántos créditos tiene medicina") == 0.0


class TestIsGreeting:
    def test_plain_greeting_is_greeting(self):
        assert is_greeting("hola") is True

    def test_greeting_with_factual_content_is_not_greeting(self):
        assert is_greeting("hola, cuánto cuesta la matrícula") is False

    def test_non_conversational_query_is_not_greeting(self):
        assert is_greeting("¿Qué programas académicos ofrece la universidad?") is False

    def test_long_conversational_message_is_not_short_circuited(self):
        long_msg = "hola buenas tardes " * 5
        assert is_greeting(long_msg) is False


class TestKeywordScore:
    def test_full_overlap_scores_one(self):
        assert keyword_score("créditos programa", "el programa tiene créditos") == 1.0

    def test_no_overlap_scores_zero(self):
        assert keyword_score("matrícula costo", "información sobre enfermería") == 0.0

    def test_empty_query_scores_zero(self):
        assert keyword_score("", "cualquier contenido") == 0.0

    def test_partial_overlap_is_proportional(self):
        score = keyword_score("materias creditos semestre", "el semestre tiene materias")
        assert score == 2 / 3
