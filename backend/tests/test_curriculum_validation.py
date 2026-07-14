from app.services.document_service import DocumentService

RAW_TEXT = """
PLAN DE ESTUDIOS - ESPECIALIZACIÓN EN SEGURIDAD INFORMÁTICA

SEMESTRE I
TD101 Fundamentos de seguridad informática
TD102 Análisis y gestión de riesgos
TD103 Pruebas de penetración y hacking ético

SEMESTRE II
TD201 Criptografía aplicada
TD202 Seguridad en redes y sistemas
""" * 3  # repeated to comfortably clear the 20-significant-word sparsity floor


def service():
    return DocumentService(db=None)


class TestValidateCurriculumSummary:
    def test_keeps_courses_backed_by_source_text(self):
        summary = (
            "SEMESTRE 1: Fundamentos de seguridad informática, Análisis y gestión de riesgos\n"
            "SEMESTRE 2: Criptografía aplicada"
        )
        result = service()._validate_curriculum_summary(summary, RAW_TEXT)
        assert "Fundamentos de seguridad informática" in result
        assert "Criptografía aplicada" in result

    def test_drops_fabricated_course_not_in_source(self):
        summary = (
            "SEMESTRE 1: Fundamentos de seguridad informática, Inteligencia Artificial Cuántica Avanzada"
        )
        result = service()._validate_curriculum_summary(summary, RAW_TEXT)
        assert "Fundamentos de seguridad informática" in result
        assert "Inteligencia Artificial Cuántica Avanzada" not in result

    def test_drops_entire_semester_when_all_courses_fabricated(self):
        summary = "SEMESTRE 3: Materia Totalmente Inventada, Otra Materia Falsa"
        result = service()._validate_curriculum_summary(summary, RAW_TEXT)
        assert result == ""

    def test_ignores_lines_not_matching_semester_format(self):
        summary = "Esto no es una línea de semestre válida\nSEMESTRE 1: Criptografía aplicada"
        result = service()._validate_curriculum_summary(summary, RAW_TEXT)
        assert "Esto no es" not in result
        assert "Criptografía aplicada" in result

    def test_skips_validation_when_source_text_is_sparse_scanned_pdf(self):
        # A scanned/image-only PDF yields little to no extractable text layer —
        # validation must not reject the vision model's output in that case.
        sparse_raw_text = "Universidad"
        summary = "SEMESTRE 1: Materia Que No Aparece En El Texto Escaneado"
        result = service()._validate_curriculum_summary(summary, sparse_raw_text)
        assert result == summary
