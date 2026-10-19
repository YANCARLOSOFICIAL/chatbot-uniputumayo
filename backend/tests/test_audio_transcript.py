from app.routers.audio import clean_transcript


class TestCleanTranscript:
    def test_keeps_real_speech(self):
        assert clean_transcript("¡Hola!") == "¡Hola!"
        assert clean_transcript("Hola guaca, buenas tardes.") == "Hola guaca, buenas tardes."
        assert clean_transcript(" cuántos créditos tiene ingeniería de sistemas. ") == "cuántos créditos tiene ingeniería de sistemas."

    def test_drops_known_whisper_artifacts(self):
        for artifact in [
            "Subtítulos realizados por la comunidad de Amara.org",
            "Subtítulos por la comunidad de Amara.org.",
            "Gracias por ver el video.",
            "¡Gracias por ver!",
            "Suscríbete al canal",
            "[Música]",
            "música",
        ]:
            assert clean_transcript(artifact) == "", artifact

    def test_empty_and_whitespace(self):
        assert clean_transcript("") == ""
        assert clean_transcript("   ") == ""

    def test_artifact_inside_real_speech_is_kept(self):
        # Only a transcript that is NOTHING BUT the artifact is dropped.
        assert clean_transcript("gracias por ver la malla, ¿cuántos créditos tiene?") != ""
