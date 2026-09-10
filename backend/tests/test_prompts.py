from app.utils.prompts import (
    REFUSAL_MARKER,
    build_no_context_answer,
    strip_unsolicited_contact_block,
)


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


class TestStripUnsolicitedContactBlock:
    ANSWER = (
        "El programa de Ingeniería de Sistemas dura 10 semestres y tiene "
        "142 créditos académicos [2]."
    )

    def test_removes_appended_literal_contact_block(self):
        polluted = (
            self.ANSWER
            + "\n\nPara más detalles, contacta a Uniputumayo:\n"
            "Sede Principal, sector Aire Libre, barrio Luis Carlos Galán, Mocoa\n"
            "Horario: lunes a viernes, 8:00 a.m. a 12:00 m. y 2:00 p.m. a 6:00 p.m.\n"
            "Línea de atención: 3138052807"
        )
        assert strip_unsolicited_contact_block(polluted) == self.ANSWER

    def test_removes_block_with_trailing_closing_line(self):
        polluted = (
            self.ANSWER
            + "\n\nSede Principal, sector Aire Libre, barrio Luis Carlos Galán, Mocoa\n"
            "Línea de atención: 3138052807\n\n"
            "¿Hay algo más en lo que pueda ayudarte?"
        )
        assert strip_unsolicited_contact_block(polluted) == self.ANSWER

    def test_no_op_when_no_contact_block(self):
        assert strip_unsolicited_contact_block(self.ANSWER) == self.ANSWER

    def test_no_op_on_genuine_refusal(self):
        # A real refusal legitimately carries the contact block — leave it.
        refusal = build_no_context_answer()
        assert strip_unsolicited_contact_block(refusal) == refusal

    def test_no_op_on_verification_exhausted_refusal(self):
        refusal = build_no_context_answer(verification_exhausted=True)
        assert strip_unsolicited_contact_block(refusal) == refusal

    def test_keeps_a_legitimately_referenced_phone_in_body(self):
        # Phone number as part of the actual answer (not a trailing block) —
        # there's grounded content after it, so nothing is stripped.
        answer = (
            "La línea de atención de admisiones es 3138052807 [1]. El horario "
            "de atención es de lunes a viernes [1]."
        )
        assert strip_unsolicited_contact_block(answer) == answer

    def test_preserves_body_when_only_tail_is_contact(self):
        polluted = self.ANSWER + "\n\nLínea de atención: 3138052807"
        assert strip_unsolicited_contact_block(polluted) == self.ANSWER
