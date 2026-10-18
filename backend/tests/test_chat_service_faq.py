import uuid

import pytest

from app.config import settings
from app.models.faq_entry import FaqEntry
from app.services import chat_service as cs
from app.services.chat_service import ChatService
from app.services.faq_service import FaqLookup, FaqMatch
from app.utils.prompts import REFUSAL_MARKER

# _check_faq_and_cache is the single entry point that embeds the user's
# question once and consults the curated FAQ, then the answer cache. These
# tests pin the ordering (FAQ wins), the disabled/unavailable paths, and the
# answer_source classification stored on every assistant message.


def _faq_entry():
    return FaqEntry(id=uuid.uuid4(), question="¿Cuánto cuesta la inscripción?", answer="Vale $X.")


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr(settings, "faq_enabled", True)
    monkeypatch.setattr(settings, "answer_cache_enabled", True)
    svc = ChatService(db=object())  # non-None: FAQ lookup requires a session

    async def fake_embed(query):
        return [0.1, 0.2, 0.3]

    async def fake_aliases():
        return {}

    svc._embed_query = fake_embed
    svc._get_program_aliases = fake_aliases
    return svc


def _wire_faq(monkeypatch, lookup: FaqLookup):
    calls = []

    class FakeFaqService:
        def __init__(self, db):
            pass

        async def match(self, embedding, query, aliases):
            calls.append(query)
            return lookup

    monkeypatch.setattr(cs, "FaqService", FakeFaqService)
    return calls


def _wire_cache(monkeypatch, cached):
    calls = []

    async def fake_find_similar(embedding, query_text=None, aliases=None):
        calls.append(query_text)
        return cached

    monkeypatch.setattr(cs.answer_cache, "find_similar", fake_find_similar)
    return calls


class TestCheckFaqAndCache:
    async def test_faq_hit_skips_the_answer_cache(self, service, monkeypatch):
        entry = _faq_entry()
        _wire_faq(monkeypatch, FaqLookup(hit=FaqMatch(entry, 0.95)))
        cache_calls = _wire_cache(monkeypatch, {"answer": "cached"})

        embedding, cached, lookup = await service._check_faq_and_cache("cuánto vale inscribirme")

        assert embedding == [0.1, 0.2, 0.3]
        assert cached is None
        assert lookup.hit is not None and lookup.hit.entry is entry
        assert cache_calls == []

    async def test_faq_suggestion_still_consults_cache(self, service, monkeypatch):
        entry = _faq_entry()
        _wire_faq(monkeypatch, FaqLookup(suggestion=FaqMatch(entry, 0.85)))
        _wire_cache(monkeypatch, {"answer": "cached"})

        embedding, cached, lookup = await service._check_faq_and_cache("pregunta")

        assert cached == {"answer": "cached"}
        assert lookup.hit is None and lookup.suggestion is not None

    async def test_faq_disabled_goes_straight_to_cache(self, service, monkeypatch):
        monkeypatch.setattr(settings, "faq_enabled", False)
        faq_calls = _wire_faq(monkeypatch, FaqLookup(hit=FaqMatch(_faq_entry(), 0.99)))
        _wire_cache(monkeypatch, None)

        embedding, cached, lookup = await service._check_faq_and_cache("pregunta")

        assert faq_calls == []
        assert embedding is not None and cached is None and lookup.hit is None

    async def test_both_disabled_does_not_embed(self, service, monkeypatch):
        monkeypatch.setattr(settings, "faq_enabled", False)
        monkeypatch.setattr(settings, "answer_cache_enabled", False)
        called = []

        async def fake_embed(query):
            called.append(query)
            return [1.0]

        service._embed_query = fake_embed
        embedding, cached, lookup = await service._check_faq_and_cache("pregunta")
        assert called == []
        assert embedding is None and cached is None and lookup.hit is None

    async def test_embedding_unavailable_skips_both(self, service, monkeypatch):
        async def fake_embed(query):
            return None

        service._embed_query = fake_embed
        faq_calls = _wire_faq(monkeypatch, FaqLookup(hit=FaqMatch(_faq_entry(), 0.99)))
        cache_calls = _wire_cache(monkeypatch, {"answer": "cached"})

        embedding, cached, lookup = await service._check_faq_and_cache("pregunta")

        assert embedding is None and cached is None and lookup.hit is None
        assert faq_calls == [] and cache_calls == []


class TestFaqSuggestionPayload:
    def test_none_without_suggestion(self):
        assert ChatService._faq_suggestion_payload(FaqLookup()) is None

    def test_payload_fields(self):
        entry = _faq_entry()
        out = ChatService._faq_suggestion_payload(FaqLookup(suggestion=FaqMatch(entry, 0.8567)))
        assert out is not None
        assert out.id == entry.id
        assert out.question == entry.question
        assert out.similarity == 0.857


class TestClassifyAnswerSource:
    def _c(self, **kw):
        base = dict(faq_hit=False, cached=False, clarification=False, greeting=False, content="texto")
        base.update(kw)
        return ChatService._classify_answer_source(**base)

    def test_priority_order(self):
        assert self._c(faq_hit=True, cached=True) == "faq"
        assert self._c(cached=True, clarification=True) == "cache"
        assert self._c(clarification=True, greeting=True) == "clarification"
        assert self._c(greeting=True) == "greeting"

    def test_refusal_vs_rag(self):
        assert self._c(content=f"Lo siento. {REFUSAL_MARKER}.") == "refusal"
        assert self._c(content="La matrícula cuesta...") == "rag"
