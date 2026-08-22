from app.config import settings
from app.services import verification_graph
from app.utils.prompts import REFUSAL_MARKER

BASE_MESSAGES = [
    {"role": "system", "content": "sistema"},
    {"role": "user", "content": "¿cuántos créditos tiene el programa?"},
]


class FakeProvider:
    """Returns canned `generate()` responses in order; records every call's messages."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls: list[list[dict]] = []

    async def generate(self, messages, model, temperature, max_tokens):
        self.calls.append(messages)
        return self._responses.pop(0)


def patch_provider(monkeypatch, responses):
    fake = FakeProvider(responses)
    monkeypatch.setattr(verification_graph.ProviderFactory, "get_provider", lambda name: fake)
    return fake


def make_response(content: str) -> dict:
    return {"content": content, "finish_reason": "stop", "tokens_used": None}


async def test_approved_on_first_try(monkeypatch):
    fake = patch_provider(monkeypatch, [
        make_response("El programa tiene 160 créditos [1]."),
        make_response("SI"),
    ])
    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto: 160 créditos [1]",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["approved"] is True
    assert result["attempts"] == 1
    assert result["content"] == "El programa tiene 160 créditos [1]."
    assert len(fake.calls) == 2  # 1 generate + 1 grade


async def test_retries_once_then_approves(monkeypatch):
    fake = patch_provider(monkeypatch, [
        make_response("El programa tiene 500 créditos."),          # generate #1 (ungrounded)
        make_response("NO"),                                        # grade #1
        make_response("El programa tiene 160 créditos [1]."),       # generate #2 (retry)
        make_response("SI"),                                        # grade #2
    ])
    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto: 160 créditos [1]",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["attempts"] == 2
    assert result["approved"] is True
    assert result["content"] == "El programa tiene 160 créditos [1]."
    # Retry's generate call carries the corrective feedback as an extra turn
    retry_messages = fake.calls[2]
    assert retry_messages[-1]["content"] == verification_graph._RETRY_FEEDBACK
    assert retry_messages[:-1] == BASE_MESSAGES


async def test_exhausts_max_attempts_without_approval(monkeypatch):
    fake = patch_provider(monkeypatch, [
        make_response("Respuesta 1 inventada."),
        make_response("NO"),
        make_response("Respuesta 2 inventada."),
        make_response("NO"),
    ])
    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto real",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["attempts"] == 2  # settings.verification_max_attempts default
    assert result["approved"] is False
    assert result["content"] == "Respuesta 2 inventada."
    assert len(fake.calls) == 4  # never exceeds max_attempts * 2 calls


async def test_refusal_answer_skips_grading_call(monkeypatch):
    fake = patch_provider(monkeypatch, [
        make_response(f"{REFUSAL_MARKER}. Contacta a Uniputumayo."),
    ])
    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto real",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["approved"] is True
    assert result["attempts"] == 1
    assert len(fake.calls) == 1  # grading short-circuited, no wasted LLM call


async def test_grading_sees_context_beyond_old_4000_char_cap(monkeypatch):
    # The grader used to truncate context_text at a flat 4000 chars — too
    # small once rag_top_k=10 makes a full context routinely longer than
    # that, which could cut off the very chunk an answer was grounded in
    # and cause a false "not grounded" verdict. The cap now scales with
    # chunk_size * rag_top_k, so a marker placed just past the old cutoff
    # must still reach the grading prompt.
    marker = "MARCADOR_DESPUES_DE_4000_CHARS"
    padding = "x" * 4500
    context_text = f"{padding}{marker}"
    assert len(context_text) > 4000

    fake = patch_provider(monkeypatch, [
        make_response("Respuesta basada en el contexto."),
        make_response("SI"),
    ])
    await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text=context_text,
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    grade_call = fake.calls[1]
    assert marker in grade_call[0]["content"]


async def test_malformed_grade_response_fails_open(monkeypatch):
    # A grader response that isn't a clean "SI"/"NO" (e.g. an unclosed
    # reasoning fragment truncated by max_tokens=5) is not an exception, so
    # it must still fail open rather than being silently treated as "NO".
    fake = patch_provider(monkeypatch, [
        make_response("El programa tiene 160 créditos [1]."),
        make_response("<think>Voy a anali"),
    ])
    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto: 160 créditos [1]",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["approved"] is True
    assert result["attempts"] == 1


async def test_grading_context_narrowed_to_cited_sources_only(monkeypatch):
    # Real context_text shape from chat_service._run_rag: "[N] title\ncontent"
    # blocks joined by "\n\n---\n\n". The draft only cites [1], so the grade
    # call should drop the uncited [2] block entirely — confirmed by its
    # unique marker being absent from what the grader actually saw.
    context_text = (
        "[1] Malla Ingeniería Civil\nContenido real: 160 créditos"
        "\n\n---\n\n"
        "[2] MARCADOR_NO_CITADO_NO_DEBE_APARECER\nContenido de otro programa"
    )
    fake = patch_provider(monkeypatch, [
        make_response("El programa tiene 160 créditos [1]."),
        make_response("SI"),
    ])
    await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text=context_text,
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    grade_prompt = fake.calls[1][0]["content"]
    assert "160 créditos" in grade_prompt
    assert "MARCADOR_NO_CITADO_NO_DEBE_APARECER" not in grade_prompt


async def test_grading_falls_back_to_full_context_when_uncited(monkeypatch):
    # A draft with no "[N]" citation markers at all (e.g. a paraphrased
    # summary) can't be narrowed — grade against everything, same as before
    # this optimization existed.
    context_text = (
        "[1] Doc A\nContenido A"
        "\n\n---\n\n"
        "[2] Doc B\nContenido B"
    )
    fake = patch_provider(monkeypatch, [
        make_response("Respuesta sin marcadores de cita."),
        make_response("SI"),
    ])
    await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text=context_text,
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    grade_prompt = fake.calls[1][0]["content"]
    assert "Contenido A" in grade_prompt
    assert "Contenido B" in grade_prompt


async def test_grade_verdict_with_reasoning_prefix_is_parsed(monkeypatch):
    # The grade prompt now allows a short reason before the verdict (see
    # resolve_grader's docstring for why a bare one-word answer was dropped)
    # — the verdict must be read from the LAST line, not the whole response.
    fake = patch_provider(monkeypatch, [
        make_response("El programa tiene 160 créditos [1]."),
        make_response("Coincide exactamente con el contexto citado.\nSI"),
    ])
    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto: 160 créditos [1]",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["approved"] is True
    assert result["attempts"] == 1


async def test_grader_prefers_openai_when_configured(monkeypatch):
    # A model grading its own draft is a conflict of interest — when OpenAI
    # is configured, grading is routed there regardless of which provider
    # generated the draft (see resolve_grader).
    monkeypatch.setattr(verification_graph.runtime_config, "openai_api_key", "sk-real-key")
    monkeypatch.setattr(verification_graph.runtime_config, "openai_default_model", "gpt-5.4-mini")

    calls_by_provider: dict[str, list[dict]] = {"ollama": [], "openai": []}

    class TrackingProvider:
        def __init__(self, name, responses):
            self.name = name
            self._responses = list(responses)

        async def generate(self, messages, model, temperature, max_tokens):
            calls_by_provider[self.name].append({"messages": messages, "model": model})
            return self._responses.pop(0)

    ollama_fake = TrackingProvider("ollama", [make_response("El programa tiene 160 créditos [1].")])
    openai_fake = TrackingProvider("openai", [make_response("Coincide con el contexto.\nSI")])
    monkeypatch.setattr(
        verification_graph.ProviderFactory, "get_provider",
        lambda name: {"ollama": ollama_fake, "openai": openai_fake}[name],
    )

    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto: 160 créditos [1]",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["approved"] is True
    assert len(calls_by_provider["ollama"]) == 1  # only the generation call
    assert len(calls_by_provider["openai"]) == 1  # grading routed to openai
    assert calls_by_provider["openai"][0]["model"] == "gpt-5.4-mini"


async def test_grader_falls_back_to_self_when_openai_not_configured(monkeypatch):
    monkeypatch.setattr(verification_graph.runtime_config, "openai_api_key", None)
    fake = patch_provider(monkeypatch, [
        make_response("El programa tiene 160 créditos [1]."),
        make_response("SI"),
    ])
    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto: 160 créditos [1]",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    assert result["approved"] is True
    assert len(fake.calls) == 2


async def test_grading_error_fails_open(monkeypatch):
    class BrokenGradeProvider(FakeProvider):
        async def generate(self, messages, model, temperature, max_tokens):
            self.calls.append(messages)
            if len(self.calls) == 1:
                return make_response("Respuesta con datos del contexto.")
            raise RuntimeError("modelo no disponible")

    fake = BrokenGradeProvider([])
    monkeypatch.setattr(verification_graph.ProviderFactory, "get_provider", lambda name: fake)

    result = await verification_graph.generate_verified(
        messages=BASE_MESSAGES, context_text="Contexto real",
        provider_name="ollama", model="qwen3:8b", temperature=0.05, max_tokens=2048,
    )
    # A broken grader must never block the chat — approve by default rather
    # than looping forever or surfacing an error to the user.
    assert result["approved"] is True
    assert result["attempts"] == 1
