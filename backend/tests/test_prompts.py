"""Tests for app.utils.prompts."""
from app.utils.prompts import build_chat_prompt, _SYSTEM_NO_CONTEXT, _SYSTEM_WITH_CONTEXT


class TestBuildChatPrompt:
    def test_with_context(self):
        result = build_chat_prompt("Some relevant context about IUP")
        assert "Some relevant context about IUP" in result
        assert "CONTEXTO" in result

    def test_empty_context_returns_no_context_prompt(self):
        result = build_chat_prompt("")
        assert result == _SYSTEM_NO_CONTEXT

    def test_none_context_returns_no_context_prompt(self):
        result = build_chat_prompt(None)
        assert result == _SYSTEM_NO_CONTEXT

    def test_whitespace_only_returns_no_context_prompt(self):
        result = build_chat_prompt("   \n\t  ")
        assert result == _SYSTEM_NO_CONTEXT

    def test_with_context_mentions_nexus(self):
        result = build_chat_prompt("data")
        assert "Nexus" in result

    def test_no_context_mentions_nexus(self):
        result = build_chat_prompt("")
        assert "Nexus" in result

    def test_context_is_formatted_into_template(self):
        ctx = "Plan de estudios de Ingeniería"
        result = build_chat_prompt(ctx)
        assert ctx in result
        assert "{context}" not in result
