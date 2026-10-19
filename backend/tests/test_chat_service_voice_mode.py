from app.services.chat_service import ChatService, _RAGContext
from app.utils.prompts import VOICE_STYLE_NOTE, GREETING_PROMPT

# Voice mode (input_type == "voice"): the answer is read aloud sentence by
# sentence, so the system prompt asks for short spoken sentences without
# lists or formatting. Grounding rules are unchanged.


def _ctx(quality="good"):
    return _RAGContext(
        context_text="[1] El programa tiene 142 créditos.", sources_payload=[], source_infos=[],
        quality=quality, embed_ms=0, search_ms=0,
    )


class TestVoiceModePrompt:
    def test_voice_mode_appends_the_spoken_style_note(self):
        svc = ChatService(db=None)
        messages = svc._build_messages(_ctx(), [], "¿cuántos créditos tiene?", provider_name="openai", voice_mode=True)
        assert messages[0].role == "system"
        assert messages[0].content.endswith(VOICE_STYLE_NOTE)
        assert "142 créditos" in messages[0].content  # grounding context still present

    def test_text_mode_is_unchanged(self):
        svc = ChatService(db=None)
        messages = svc._build_messages(_ctx(), [], "¿cuántos créditos tiene?", provider_name="openai")
        assert VOICE_STYLE_NOTE not in messages[0].content

    def test_greeting_in_voice_mode_also_gets_the_note(self):
        svc = ChatService(db=None)
        messages = svc._build_messages(_ctx("none"), [], "hola", is_greeting_msg=True, provider_name="openai", voice_mode=True)
        assert messages[0].content.startswith(GREETING_PROMPT)
        assert messages[0].content.endswith(VOICE_STYLE_NOTE)

    def test_note_forbids_lists_and_asks_for_short_sentences(self):
        assert "Sin listas" in VOICE_STYLE_NOTE
        assert "Frases cortas" in VOICE_STYLE_NOTE
