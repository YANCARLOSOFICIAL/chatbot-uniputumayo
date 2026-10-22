"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";

// Mirrors backend MessageCreate._MAX_MESSAGE_LEN (schemas/chat.py) so the
// user finds out before typing a message the server will reject.
const MAX_MESSAGE_LEN = 4000;

interface ChatInputProps {
  onSend: (message: string) => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  isListening: boolean;
  isLoading: boolean;
  isVoiceSupported: boolean;
}

export function ChatInput({
  onSend, onVoiceStart, onVoiceStop,
  isListening, isLoading, isVoiceSupported,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [shaking, setShaking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    resize();
  };

  const reset = () => {
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed || trimmed.length > MAX_MESSAGE_LEN) && !isLoading) { triggerShake(); return; }
    if (!trimmed || trimmed.length > MAX_MESSAGE_LEN || isLoading) return;
    onSend(trimmed);
    reset();
    textareaRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const canSend = value.trim().length > 0 && value.length <= MAX_MESSAGE_LEN && !isLoading && !isListening;
  const showCounter = value.length > 200;
  const overLimit = value.length > MAX_MESSAGE_LEN;

  return (
    <div className={`composer-wrap${shaking ? " animate-shake" : ""}`}>
      <div className="composer-inner">
        <div className={`composer${isListening ? " listening" : ""}`}>

          {/* Voice button */}
          {isVoiceSupported && (
            <button
              type="button"
              onClick={isListening ? onVoiceStop : onVoiceStart}
              disabled={isLoading}
              aria-label={isListening ? "Detener" : "Micrófono"}
              className={`composer-btn${isListening ? " listening" : ""}`}
            >
              {isListening
                ? <Square size={13} fill="currentColor" strokeWidth={2} />
                : <Mic size={15} strokeWidth={1.6} />
              }
            </button>
          )}

          {/* Textarea + counter */}
          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKey}
              placeholder={
                isListening ? "Escuchando..."
                : isLoading  ? "Buscando en el catálogo..."
                : "Pregúntale a Guaca..."
              }
              rows={1}
              maxLength={MAX_MESSAGE_LEN}
              disabled={isLoading || isListening}
              aria-label="Mensaje"
              style={{ paddingBottom: showCounter ? 18 : undefined }}
            />
            {showCounter && (
              <span
                className="composer-counter"
                style={{ color: overLimit ? "var(--danger)" : "var(--ink-3)" }}
              >
                {value.length > MAX_MESSAGE_LEN * 0.85 ? `${value.length}/${MAX_MESSAGE_LEN}` : value.length}
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={() => submit()}
            disabled={!canSend}
            aria-label="Enviar"
            className="composer-btn send"
          >
            {isLoading ? (
              <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
                {[0, 0.1, 0.2].map((d) => (
                  <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: `pulse-soft 1s ${d}s ease-in-out infinite` }} />
                ))}
              </span>
            ) : (
              <ArrowUp size={17} strokeWidth={2.4} />
            )}
          </button>
        </div>

        {!isListening && !isLoading && (
          <p className="composer-note">
            Guaca puede equivocarse. Verifica la información crítica con admisiones.
          </p>
        )}
      </div>
    </div>
  );
}
