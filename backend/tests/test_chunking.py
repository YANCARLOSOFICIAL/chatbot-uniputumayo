"""Tests for app.utils.chunking."""
from unittest.mock import patch

from app.utils.chunking import _count_tokens, _recursive_split, chunk_text


class TestCountTokens:
    def test_approximation(self):
        # ~4 chars per token
        assert _count_tokens("abcdefgh") == 2
        assert _count_tokens("a" * 100) == 25

    def test_empty(self):
        assert _count_tokens("") == 0


class TestRecursiveSplit:
    def test_short_text_returns_single_chunk(self):
        result = _recursive_split("short text", 100, 10, ["\n\n", "\n", ". ", " "])
        assert result == ["short text"]

    def test_empty_text(self):
        result = _recursive_split("", 100, 10, ["\n\n", "\n", ". ", " "])
        assert result == []

    def test_whitespace_only_text(self):
        result = _recursive_split("   ", 100, 10, ["\n\n", "\n", ". ", " "])
        assert result == []

    def test_splits_on_best_separator(self):
        text = "paragraph one\n\nparagraph two\n\nparagraph three"
        result = _recursive_split(text, 30, 0, ["\n\n", "\n", ". ", " "])
        assert len(result) >= 2
        assert "paragraph one" in result[0]

    def test_splits_with_overlap(self):
        text = "AAAA BBBB CCCC DDDD EEEE"
        result = _recursive_split(text, 12, 5, [" "])
        assert len(result) >= 2

    def test_hard_split_for_very_long_segment(self):
        # Single word longer than max_chars, only " " separator
        text = "A" * 200
        result = _recursive_split(text, 50, 10, [" "])
        assert len(result) >= 4
        for chunk in result:
            assert len(chunk) <= 50

    def test_falls_to_next_separator(self):
        # No double newlines in text, should fall to single newline
        text = "line one\nline two\nline three"
        result = _recursive_split(text, 15, 0, ["\n\n", "\n", " "])
        assert len(result) >= 2


class TestChunkText:
    @patch("app.utils.chunking.settings")
    def test_returns_list_of_dicts(self, mock_settings):
        mock_settings.chunk_size = 50
        mock_settings.chunk_overlap = 5
        text = "Hello world. " * 50
        result = chunk_text(text)
        assert len(result) >= 1
        for chunk in result:
            assert "content" in chunk
            assert "token_count" in chunk
            assert "metadata" in chunk
            assert "chunk_index" in chunk["metadata"]

    @patch("app.utils.chunking.settings")
    def test_explicit_params_override_settings(self, mock_settings):
        mock_settings.chunk_size = 999
        mock_settings.chunk_overlap = 0
        text = "word " * 200
        result = chunk_text(text, chunk_size=20, chunk_overlap=2)
        assert len(result) >= 2

    @patch("app.utils.chunking.settings")
    def test_empty_chunks_excluded(self, mock_settings):
        mock_settings.chunk_size = 50
        mock_settings.chunk_overlap = 5
        text = "Hello.\n\n\n\nWorld."
        result = chunk_text(text)
        for chunk in result:
            assert chunk["content"].strip() != ""

    @patch("app.utils.chunking.settings")
    def test_token_count_matches_content(self, mock_settings):
        mock_settings.chunk_size = 50
        mock_settings.chunk_overlap = 5
        text = "Test content for chunking. " * 30
        result = chunk_text(text)
        for chunk in result:
            assert chunk["token_count"] == len(chunk["content"]) // 4
