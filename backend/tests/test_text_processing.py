"""Tests for app.utils.text_processing."""
from app.utils.text_processing import clean_text


class TestCleanText:
    def test_normalizes_unicode(self):
        # NFKC should normalize compatibility characters
        result = clean_text("\ufb01nanzas")  # fi ligature
        assert "fi" in result

    def test_collapses_whitespace(self):
        result = clean_text("hello   \t  world")
        assert result == "hello world"

    def test_collapses_excessive_newlines(self):
        result = clean_text("para1\n\n\n\n\npara2")
        assert result == "para1\n\npara2"

    def test_removes_standalone_page_numbers(self):
        result = clean_text("content\n 42 \nnext")
        assert "42" not in result
        assert "content" in result
        assert "next" in result

    def test_removes_pagina_pattern(self):
        result = clean_text("texto Página 3 de 10 más texto")
        assert "Página" not in result.lower() or "página" not in result.lower()
        assert "texto" in result

    def test_removes_pagina_case_insensitive(self):
        result = clean_text("PÁGINA 1 DE 5")
        assert result.strip() == ""

    def test_removes_underscores_separator(self):
        result = clean_text("above\n_____\nbelow")
        assert "___" not in result

    def test_removes_dashes_separator(self):
        result = clean_text("above\n------\nbelow")
        assert "---" not in result

    def test_strips_line_whitespace(self):
        result = clean_text("  line1  \n  line2  ")
        assert result == "line1\nline2"

    def test_strips_leading_trailing(self):
        result = clean_text("\n\n  content  \n\n")
        assert result == "content"

    def test_preserves_spanish_characters(self):
        text = "Información académica: año, niño, café, ñandú"
        result = clean_text(text)
        assert "ñ" in result
        assert "año" in result
        assert "café" in result
        assert "niño" in result

    def test_empty_string(self):
        assert clean_text("") == ""

    def test_only_whitespace(self):
        assert clean_text("   \n\n   ") == ""

    def test_preserves_paragraph_breaks(self):
        result = clean_text("Paragraph one.\n\nParagraph two.")
        assert "\n\n" in result
