"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";

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
    if (!trimmed && !isLoading) { triggerShake(); return; }
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    reset();
    textareaRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const canSend = value.trim().length > 0 && !isLoading && !isListening;
  const showCounter = value.length > 200;

  return (
    <div
      className={`flat-input-bar${isListening ? " listening" : ""}${shaking ? " animate-shake" : ""}`}
      style={{ flexShrink: 0 }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Listening banner */}
        {isListening && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 10, padding: "6px 10px", borderRadius: 8,
            background: "rgba(123,181,46,0.08)", border: "1px solid rgba(123,181,46,0.2)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-accent)", display: "inline-block", animation: "pulse-soft 1s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, color: "var(--brand-accent)", fontWeight: 500 }}>Escuchando</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>

          {/* Voice button */}
          {isVoiceSupported && (
            <button
              type="button"
              onClick={isListening ? onVoiceStop : onVoiceStart}
              disabled={isLoading}
              aria-label={isListening ? "Detener" : "Microfono"}
              style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: isListening ? "rgba(123,181,46,0.12)" : "var(--surface-3)",
                border: isListening ? "1px solid rgba(123,181,46,0.3)" : "1px solid var(--border)",
                color: isListening ? "var(--brand-accent)" : "var(--text-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.4 : 1,
                transition: "all 0.15s",
              }}
            >
              {isListening
                ? <Square size={13} fill="currentColor" strokeWidth={2} />
                : <Mic size={15} strokeWidth={1.5} />
              }
            </button>
          )}

          {/* Textarea + counter */}
          <div style={{ flex: 1, position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKey}
              placeholder={
                isListening ? "Escuchando..."
                : isLoading  ? "Buscando en el catalogo..."
                : "Preguntale a Nexus sobre programas, sedes, requisitos..."
              }
              rows={1}
              disabled={isLoading || isListening}
              aria-label="Mensaje"
              style={{
                width: "100%", resize: "none",
                background: "transparent", border: "none", outline: "none",
                fontFamily: "var(--font-body)", fontSize: 15,
                color: "var(--text-1)", lineHeight: 1.55,
                maxHeight: 140, overflowY: "auto",
                paddingBottom: showCounter ? 18 : 0,
                opacity: (isLoading || isListening) ? 0.5 : 1,
              }}
            />
            {showCounter && (
              <span style={{
                position: "absolute", bottom: 0, right: 0,
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: value.length > 500 ? "var(--error)" : "var(--text-3)",
                fontVariantNumeric: "tabular-nums",
              }}>
                {value.length}
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={() => submit()}
            disabled={!canSend}
            aria-label="Enviar"
            style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              background: canSend ? "var(--brand-primary)" : "var(--surface-3)",
              border: "none",
              color: canSend ? "#fff" : "var(--text-3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: canSend ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            {isLoading ? (
              <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
                {[0, 0.1, 0.2].map((d) => (
                  <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.7)", display: "inline-block", animation: `pulse-soft 1s ${d}s ease-in-out infinite` }} />
                ))}
              </span>
            ) : (
              <ArrowUp size={17} strokeWidth={2.5} />
            )}
          </button>
        </div>

        {!isListening && !isLoading && (
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, opacity: 0.6, textAlign: "center" }}>
            Nexus puede equivocarse. Verifica informacion critica con admisiones.
          </p>
        )}
      </div>
    </div>
  );
}
