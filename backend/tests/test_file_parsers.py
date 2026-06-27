"""Tests for app.utils.file_parsers."""
import os
import tempfile

import pytest

from app.utils.file_parsers import (
    normalize_extension,
    extract_text,
    _xlsx_cell_str,
    _extract_txt,
    _extract_csv,
    SUPPORTED_EXTENSIONS,
)


class TestNormalizeExtension:
    def test_known_extensions(self):
        assert normalize_extension("pdf") == "pdf"
        assert normalize_extension("docx") == "docx"
        assert normalize_extension("doc") == "docx"
        assert normalize_extension("txt") == "txt"
        assert normalize_extension("md") == "txt"
        assert normalize_extension("xlsx") == "xlsx"
        assert normalize_extension("xls") == "xls"
        assert normalize_extension("csv") == "csv"
        assert normalize_extension("pptx") == "pptx"

    def test_case_insensitive(self):
        assert normalize_extension("PDF") == "pdf"
        assert normalize_extension("Docx") == "docx"

    def test_strips_leading_dot(self):
        assert normalize_extension(".pdf") == "pdf"
        assert normalize_extension(".txt") == "txt"

    def test_unknown_returns_none(self):
        assert normalize_extension("exe") is None
        assert normalize_extension("jpg") is None
        assert normalize_extension("zip") is None

    def test_empty_string(self):
        assert normalize_extension("") is None


class TestSupportedExtensions:
    def test_is_sorted(self):
        assert SUPPORTED_EXTENSIONS == sorted(SUPPORTED_EXTENSIONS)

    def test_contains_expected(self):
        for ext in ["pdf", "docx", "txt", "xlsx", "csv", "pptx"]:
            assert ext in SUPPORTED_EXTENSIONS


class TestXlsxCellStr:
    def test_none_returns_empty(self):
        assert _xlsx_cell_str(None) == ""

    def test_float_integer_returns_int_string(self):
        assert _xlsx_cell_str(42.0) == "42"

    def test_float_non_integer(self):
        assert _xlsx_cell_str(3.14) == "3.14"

    def test_string_strips(self):
        assert _xlsx_cell_str("  hello  ") == "hello"

    def test_integer(self):
        assert _xlsx_cell_str(7) == "7"


class TestExtractTxt:
    def test_reads_utf8(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write("Información académica: café, niño")
            path = f.name
        try:
            result = _extract_txt(path)
            assert "café" in result
            assert "niño" in result
        finally:
            os.unlink(path)

    def test_reads_latin1(self):
        with tempfile.NamedTemporaryFile(mode="wb", suffix=".txt", delete=False) as f:
            f.write("Información".encode("latin-1"))
            path = f.name
        try:
            result = _extract_txt(path)
            assert "Informaci" in result
        finally:
            os.unlink(path)


class TestExtractCsv:
    def test_parses_simple_csv(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("col1,col2,col3\nval1,val2,val3\n")
            path = f.name
        try:
            result = _extract_csv(path)
            assert "col1" in result
            assert "val2" in result
            # pipe-separated output
            assert "|" in result
        finally:
            os.unlink(path)

    def test_skips_single_column_rows(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("only_one\na,b\n")
            path = f.name
        try:
            result = _extract_csv(path)
            # "only_one" row has < 2 non-empty cells, should be skipped
            assert "only_one" not in result
            assert "a" in result
        finally:
            os.unlink(path)


class TestExtractTextDispatch:
    def test_unsupported_type_raises(self):
        with pytest.raises(ValueError, match="no soportado"):
            extract_text("/fake/path", "unknown_type")

    def test_dispatches_txt(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write("test content")
            path = f.name
        try:
            result = extract_text(path, "txt")
            assert "test content" in result
        finally:
            os.unlink(path)
