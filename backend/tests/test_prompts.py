from app.utils.prompts import REFUSAL_MARKER, build_no_context_answer


class TestBuildNoContextAnswer:
    def test_contains_the_refusal_marker(self):
        assert REFUSAL_MARKER in build_no_context_answer()

    def test_is_deterministic(self):
        assert build_no_context_answer() == build_no_context_answer()

    def test_verification_exhausted_still_contains_the_refusal_marker(self):
        # Downstream refusal detection (goldstandard_eval_service, _filter_cited_sources)
        # matches on REFUSAL_MARKER alone — the exhausted-loop variant must keep it intact.
        assert REFUSAL_MARKER in build_no_context_answer(verification_exhausted=True)

    def test_verification_exhausted_wording_differs_from_no_context(self):
        # Distinct cause (RAG found relevant context but nothing passed grounding
        # review) must not read as "the knowledge base has nothing" — see
        # prompts.py's _VERIFICATION_EXHAUSTED_ANSWER docstring.
        assert build_no_context_answer(verification_exhausted=True) != build_no_context_answer()
