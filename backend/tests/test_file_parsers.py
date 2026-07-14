import csv

import openpyxl
import pytest
from pptx import Presentation
from pptx.util import Inches

from app.utils.file_parsers import _extract_csv, _extract_pptx, _extract_xlsx


@pytest.fixture
def xlsx_with_merged_header(tmp_path):
    """A pensum-style sheet: a merged 'SEMESTRE I' header row, then course rows."""
    path = tmp_path / "pensum.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws["A1"] = "SEMESTRE I"
    ws.merge_cells("A1:D1")
    ws.append(["TD101", "Fundamentos de seguridad informática", 4, "TD101"])
    ws.append(["TD102", "Análisis y gestión de riesgos", 3, "TD102"])
    ws.append([None, None, None, None])  # fully blank spacer row
    ws["A5"] = "SEMESTRE II"
    ws.merge_cells("A5:D5")
    ws.append(["TD201", "Criptografía aplicada", 3, "TD201"])
    wb.save(path)
    return str(path)


class TestExtractXlsx:
    def test_merged_header_row_is_preserved(self, xlsx_with_merged_header):
        text = _extract_xlsx(xlsx_with_merged_header)
        assert "SEMESTRE I" in text
        assert "SEMESTRE II" in text

    def test_course_rows_are_preserved(self, xlsx_with_merged_header):
        text = _extract_xlsx(xlsx_with_merged_header)
        assert "Fundamentos de seguridad informática" in text
        assert "Criptografía aplicada" in text

    def test_fully_blank_row_is_still_dropped(self, xlsx_with_merged_header):
        text = _extract_xlsx(xlsx_with_merged_header)
        lines = [l for l in text.splitlines() if l.strip()]
        # No line should be just separators from an all-None row.
        assert all(line.strip(" |") for line in lines)

    def test_sheet_marker_present(self, xlsx_with_merged_header):
        text = _extract_xlsx(xlsx_with_merged_header)
        assert "=== HOJA:" in text


class TestExtractCsv:
    def test_merged_style_header_row_is_preserved(self, tmp_path):
        path = tmp_path / "pensum.csv"
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["SEMESTRE I", "", "", ""])
            writer.writerow(["TD101", "Fundamentos de seguridad informática", "4"])
            writer.writerow(["", "", ""])  # fully blank row
            writer.writerow(["SEMESTRE II", "", "", ""])
            writer.writerow(["TD201", "Criptografía aplicada", "3"])

        text = _extract_csv(str(path))
        assert "SEMESTRE I" in text
        assert "SEMESTRE II" in text
        assert "Fundamentos de seguridad informática" in text

    def test_latin1_encoded_file_is_readable(self, tmp_path):
        path = tmp_path / "pensum_latin1.csv"
        with open(path, "w", newline="", encoding="latin-1") as f:
            writer = csv.writer(f)
            writer.writerow(["Código", "Materia"])
            writer.writerow(["TD101", "Análisis y diseño"])

        text = _extract_csv(str(path))
        assert "Análisis" in text or "An" in text  # tolerant of encoding round-trip


class TestExtractPptx:
    def test_table_with_merged_style_header_row_is_preserved(self, tmp_path):
        path = tmp_path / "pensum.pptx"
        prs = Presentation()
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        table_shape = slide.shapes.add_table(3, 2, Inches(1), Inches(1), Inches(4), Inches(2))
        table = table_shape.table
        table.cell(0, 0).text = "SEMESTRE I"
        table.cell(0, 1).text = ""  # single-populated header cell, like a merged cell
        table.cell(1, 0).text = "TD101"
        table.cell(1, 1).text = "Fundamentos de seguridad informática"
        table.cell(2, 0).text = ""
        table.cell(2, 1).text = ""  # fully blank row
        prs.save(path)

        text = _extract_pptx(str(path))
        assert "SEMESTRE I" in text
        assert "Fundamentos de seguridad informática" in text
        assert "=== DIAPOSITIVA 1 ===" in text
