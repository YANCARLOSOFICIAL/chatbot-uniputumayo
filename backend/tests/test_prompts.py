from app.utils.prompts import REFUSAL_MARKER, build_no_context_answer


class TestBuildNoContextAnswer:
    def test_contains_the_refusal_marker(self):
        assert REFUSAL_MARKER in build_no_context_answer()

    def test_is_deterministic(self):
        assert build_no_context_answer() == build_no_context_answer()
