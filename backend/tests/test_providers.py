"""Tests for providers: factory + OllamaProvider static helpers."""
from unittest.mock import patch, MagicMock

import pytest

from app.providers.provider_factory import ProviderFactory
from app.providers.ollama_provider import OllamaProvider


class TestOllamaStripThink:
    def test_strips_think_block(self):
        text = "Hello <think>internal reasoning</think> world"
        assert OllamaProvider._strip_think(text) == "Hello  world"

    def test_strips_multiline_think(self):
        text = "Before <think>\nreasoning\nsteps\n</think> After"
        assert OllamaProvider._strip_think(text) == "Before  After"

    def test_no_think_block(self):
        assert OllamaProvider._strip_think("Hello world") == "Hello world"

    def test_empty_think_block(self):
        assert OllamaProvider._strip_think("A <think></think> B") == "A  B"

    def test_multiple_think_blocks(self):
        text = "<think>a</think>Hello<think>b</think>World"
        assert OllamaProvider._strip_think(text) == "HelloWorld"

    def test_case_insensitive(self):
        text = "A <THINK>inner</THINK> B"
        assert OllamaProvider._strip_think(text) == "A  B"

    def test_strips_whitespace(self):
        text = "  <think>x</think>  result  "
        assert OllamaProvider._strip_think(text) == "result"


class TestProviderFactory:
    def setup_method(self):
        # Reset cached providers between tests
        ProviderFactory._providers = {}

    def test_get_ollama_provider(self):
        provider = ProviderFactory.get_provider("ollama")
        assert isinstance(provider, OllamaProvider)

    def test_get_openai_provider(self):
        from app.providers.openai_provider import OpenAIProvider
        provider = ProviderFactory.get_provider("openai")
        assert isinstance(provider, OpenAIProvider)

    def test_unknown_provider_raises(self):
        with pytest.raises(ValueError, match="Unknown LLM provider"):
            ProviderFactory.get_provider("anthropic")

    def test_caches_providers(self):
        p1 = ProviderFactory.get_provider("ollama")
        p2 = ProviderFactory.get_provider("ollama")
        assert p1 is p2

    def test_reset_provider(self):
        p1 = ProviderFactory.get_provider("ollama")
        ProviderFactory.reset_provider("ollama")
        p2 = ProviderFactory.get_provider("ollama")
        assert p1 is not p2

    def test_reset_nonexistent_is_noop(self):
        ProviderFactory.reset_provider("nonexistent")
