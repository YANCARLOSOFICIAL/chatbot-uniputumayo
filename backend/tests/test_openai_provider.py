import httpx
import openai
import pytest

from app.providers import openai_provider as mod
from app.providers.openai_provider import OpenAIProvider, _estimate_tokens, _TokenRateLimiter


def make_rate_limit_error() -> openai.RateLimitError:
    resp = httpx.Response(
        status_code=429,
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )
    return openai.RateLimitError("rate limited", response=resp, body=None)


class FakeCompletions:
    """Returns canned responses/exceptions in order, same shape as the SDK's
    `client.chat.completions.create()` — used to test the provider without a
    real OpenAI client."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def create(self, **kwargs):
        self.calls += 1
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


class FakeChat:
    def __init__(self, completions):
        self.completions = completions


class FakeClient:
    def __init__(self, responses):
        self.chat = FakeChat(FakeCompletions(responses))


def make_completion_response(content: str = "ok"):
    class Choice:
        message = type("M", (), {"content": content})()
        finish_reason = "stop"

    class Response:
        choices = [Choice()]
        usage = None

    return Response()


def test_estimate_tokens_scales_with_prompt_and_completion_budget():
    messages = [{"role": "user", "content": "x" * 400}]
    estimate = _estimate_tokens(messages, max_tokens=100)
    assert estimate == (400 // 4) + 100


async def test_token_rate_limiter_lets_requests_through_under_budget():
    limiter = _TokenRateLimiter(tokens_per_minute=1000)
    # Well under budget — must not sleep at all.
    await limiter.reserve(100)
    await limiter.reserve(100)
    assert sum(t for _, t in limiter._window) == 200


async def test_token_rate_limiter_waits_when_budget_exhausted(monkeypatch):
    limiter = _TokenRateLimiter(tokens_per_minute=100)
    await limiter.reserve(90)  # fills the budget

    slept: list[float] = []

    async def fake_sleep(seconds):
        slept.append(seconds)
        # Simulate the window aging out so the retry loop can succeed next pass.
        limiter._window.clear()

    monkeypatch.setattr(mod.asyncio, "sleep", fake_sleep)
    await limiter.reserve(50)  # would exceed budget — must wait, not raise
    assert slept  # at least one wait happened
    assert slept[0] > 0


async def test_token_rate_limiter_never_wedges_on_a_single_oversized_request():
    # A lone request bigger than the whole budget must still go through —
    # pacing prevents pile-ups, it shouldn't deadlock a legitimate request.
    limiter = _TokenRateLimiter(tokens_per_minute=100)
    await limiter.reserve(5000)
    assert limiter._window[-1][1] == 5000


async def test_generate_retries_once_on_rate_limit_then_succeeds(monkeypatch):
    provider = OpenAIProvider()
    provider.client = FakeClient([make_rate_limit_error(), make_completion_response("respuesta ok")])
    monkeypatch.setattr(mod, "_RATE_LIMIT_BACKOFF_S", 0.001)

    result = await provider.generate(
        messages=[{"role": "user", "content": "hola"}], model="gpt-4.1", max_tokens=10,
    )
    assert result["content"] == "respuesta ok"
    assert provider.client.chat.completions.calls == 2


async def test_generate_raises_after_exhausting_rate_limit_retries(monkeypatch):
    provider = OpenAIProvider()
    provider.client = FakeClient([make_rate_limit_error()] * 10)  # more than the retry budget
    monkeypatch.setattr(mod, "_RATE_LIMIT_BACKOFF_S", 0.001)

    with pytest.raises(openai.RateLimitError):
        await provider.generate(
            messages=[{"role": "user", "content": "hola"}], model="gpt-4.1", max_tokens=10,
        )


async def test_generate_paces_through_the_shared_rate_limiter(monkeypatch):
    provider = OpenAIProvider()
    provider.client = FakeClient([make_completion_response("ok")])

    reserved: list[int] = []

    async def fake_reserve(estimated_tokens):
        reserved.append(estimated_tokens)

    monkeypatch.setattr(provider._rate_limiter, "reserve", fake_reserve)
    await provider.generate(
        messages=[{"role": "user", "content": "x" * 40}], model="gpt-4.1", max_tokens=20,
    )
    assert reserved == [(40 // 4) + 20]
