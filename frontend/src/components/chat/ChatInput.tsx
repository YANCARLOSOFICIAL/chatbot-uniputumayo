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

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    reset();
    textareaRef.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const canSend = value.trim().length > 0 && !isLoading && !isListening;

  return (
    <div className="flex-shrink-0 px-3 pb-4 pt-2 bg-[var(--bg)]">
      <div className="max-w-2xl mx-auto">

        {/* Listening indicator */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--error)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--error)]" />
            </span>
            <span className="text-[11px] text-[var(--error)] font-medium">Escuchando…</span>
          </div>
        )}

        {/* Input card */}
        <div className={[
          "chat-input-area transition-all",
          isListening ? "border-[var(--error)]/30 shadow-lg shadow-[var(--error)]/5" : "",
        ].join(" ")}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder={
              isListening ? "Escuchando…"
              : isLoading  ? "Buscando en el catálogo…"
              : "Pregúntale a Nexus sobre programas, sedes, requisitos…"
            }
            rows={1}
            disabled={isLoading || isListening}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm text-[var(--text-1)] placeholder-[var(--text-3)] outline-none leading-relaxed disabled:opacity-40"
            style={{ maxHeight: "140px", overflowY: "auto" }}
            aria-label="Mensaje"
          />

          <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 gap-2">
            {/* Left: voice */}
            <div className="flex items-center gap-1">
              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={isListening ? onVoiceStop : onVoiceStart}
                  disabled={isLoading}
                  aria-label={isListening ? "Detener" : "Micrófono"}
                  className={[
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150",
                    isListening
                      ? "bg-red-500 text-white shadow-sm"
                      : "text-[var(--text-3)] hover:text-[var(--brand)] hover:bg-[var(--surface-3)]",
                    isLoading ? "opacity-30 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {isListening
                    ? <Square size={10} fill="currentColor" strokeWidth={2} />
                    : <Mic size={13} strokeWidth={1.5} />
                  }
                </button>
              )}
            </div>

            {/* Right: counter + send */}
            <div className="flex items-center gap-2">
              {value.length > 200 && (
                <span className={`text-[9px] tabular-nums ${value.length > 500 ? "text-[var(--error)]" : "text-[var(--text-3)]"}`}>
                  {value.length}
                </span>
              )}
              <button
                onClick={() => submit()}
                disabled={!canSend}
                aria-label="Enviar"
                className={[
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150",
                  canSend
                    ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] active:scale-95"
                    : "bg-[var(--surface-3)] text-[var(--text-3)] cursor-not-allowed",
                ].join(" ")}
              >
                {isLoading ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <ArrowUp size={13} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-[var(--text-3)] mt-2 opacity-70">
          Nexus puede equivocarse. Verifica información crítica con la oficina de admisiones.
        </p>
      </div>
    </div>
  );
}
