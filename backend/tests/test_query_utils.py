from app.utils.query_utils import (
    detect_temperature, is_greeting, keyword_score,
    is_varying_topic_query, mentions_entity,
)


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

    def test_help_verb_with_real_topic_is_not_greeting(self):
        # Confirmed live before the fix: "ayuda" was in _CONVERSATIONAL_PATTERNS
        # and "carrera" isn't a _FACTUAL_PATTERNS keyword, so this misclassified
        # as a greeting — the canned welcome reply was sent and RAG never ran.
        assert is_greeting("ayuda con la carrera de sistemas") is False

    def test_explain_verb_with_plural_requisito_is_not_greeting(self):
        # Confirmed live before the fix: _FACTUAL_PATTERNS only had the
        # singular "requisito" (no `s?`), so "requisitos" never matched, and
        # "explica" was still in _CONVERSATIONAL_PATTERNS — same failure mode.
        assert is_greeting("explica los requisitos") is False

    def test_tell_me_about_university_is_not_greeting(self):
        assert is_greeting("cuentame sobre la universidad") is False

    def test_plural_costos_is_recognized_as_factual(self):
        assert is_greeting("ayuda, cuales son los costos") is False

    def test_true_greeting_words_still_short_circuit(self):
        assert is_greeting("hola buenas") is True
        assert is_greeting("muchas gracias") is True


class TestIsVaryingTopicQuery:
    def test_pensum_varies_by_program(self):
        assert is_varying_topic_query("¿Cuáles son las materias del pensum?") is True

    def test_mission_varies_by_program(self):
        # Confirmed by the institution: mission/vision can differ by program
        # or faculty, unlike admission requirements (see below).
        assert is_varying_topic_query("¿Cuál es la misión del programa?") is True

    def test_credits_and_duration_vary(self):
        assert is_varying_topic_query("¿Cuántos créditos y qué duración tiene?") is True

    def test_admission_requirements_do_not_vary(self):
        # Confirmed by the institution: admission is the same process for
        # every program at Uniputumayo — must NOT trigger a clarification
        # even if RAG retrieves per-program admission documents.
        assert is_varying_topic_query("¿Cuáles son los requisitos de admisión?") is False

    def test_tuition_cost_does_not_vary(self):
        assert is_varying_topic_query("¿Cuál es el costo de la matrícula?") is False

    def test_campuses_do_not_vary(self):
        assert is_varying_topic_query("¿Cuáles son las sedes?") is False


class TestMentionsEntity:
    def test_full_name_mentioned(self):
        assert mentions_entity(
            "materias de Ingeniería de Sistemas", "Ingeniería de Sistemas"
        ) is True

    def test_name_not_mentioned(self):
        assert mentions_entity(
            "materias del segundo semestre", "Ingeniería de Sistemas"
        ) is False

    def test_accent_insensitive_for_voice_transcription(self):
        # STT output can drop accents ("Ingenieria" instead of "Ingeniería") —
        # the entity-mention check must still recognize it as the same word.
        assert mentions_entity("quiero saber de Ingenieria", "Ingeniería") is True

    def test_partial_overlap_below_threshold_is_not_mentioned(self):
        # Only 1 of the entity's 3 significant words ("ingenieria") appears —
        # 1/3 overlap is below the default 0.5 threshold.
        assert mentions_entity(
            "hablame de ingenieria por favor",
            "Ingeniería Agroindustrial Sostenible",
            min_overlap=0.5,
        ) is False


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
