"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Square, Sparkles } from "lucide-react";

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

  /* Auto-resize */
  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
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
    <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto">

        {/* Listening banner */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mb-2 py-2 px-4 rounded-xl bg-red-500/8 border border-red-500/15">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs text-red-500 font-medium">Escuchando… habla ahora</span>
          </div>
        )}

        {/* Main input card */}
        <div className={[
          "relative rounded-2xl border bg-[var(--surface)] transition-all duration-200",
          isListening
            ? "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,.12)]"
            : "border-[var(--border)] shadow-[var(--shadow-md)] focus-within:border-[var(--brand)] focus-within:shadow-[var(--shadow-md),0_0_0_3px_rgba(16,185,129,.1)]",
        ].join(" ")}>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder={
              isListening ? "Escuchando tu voz…"
              : isLoading  ? "Nexus está respondiendo…"
              : "Pregunta algo sobre la IUP…"
            }
            rows={1}
            disabled={isLoading || isListening}
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm text-[var(--text-1)] placeholder-[var(--text-4)] outline-none leading-relaxed disabled:opacity-60"
            style={{ maxHeight: "160px", overflowY: "auto" }}
            aria-label="Escribe tu mensaje"
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            {/* Left: voice + model indicator */}
            <div className="flex items-center gap-1.5">
              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={isListening ? onVoiceStop : onVoiceStart}
                  disabled={isLoading}
                  aria-label={isListening ? "Detener" : "Usar micrófono"}
                  className={[
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                    isListening
                      ? "bg-red-500 text-white shadow-sm scale-105"
                      : "text-[var(--text-4)] hover:bg-[var(--surface-3)] hover:text-[var(--text-2)]",
                    isLoading ? "opacity-40 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {isListening ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}
                </button>
              )}

              {/* Model pill */}
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[10px] text-[var(--text-4)]">
                <Sparkles size={9} className="text-[var(--brand)]" />
                Nexus AI
              </div>
            </div>

            {/* Right: char count + send */}
            <div className="flex items-center gap-2">
              {value.length > 200 && (
                <span className={`text-[10px] tabular-nums ${value.length > 500 ? "text-[var(--error)]" : "text-[var(--text-4)]"}`}>
                  {value.length}
                </span>
              )}
              <button
                onClick={() => submit()}
                disabled={!canSend}
                aria-label="Enviar mensaje"
                className={[
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                  canSend
                    ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] shadow-sm active:scale-[.92] hover:scale-105"
                    : "bg-[var(--surface-3)] text-[var(--text-4)] cursor-not-allowed",
                ].join(" ")}
              >
                {isLoading ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <ArrowUp size={15} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-[10px] text-[var(--text-4)] mt-2 leading-relaxed">
          Nexus puede cometer errores. Verifica la información importante.
          {" "}<span className="hidden sm:inline">·{" "}
            <kbd className="font-sans">↵</kbd> enviar · <kbd className="font-sans">⇧↵</kbd> nueva línea
          </span>
        </p>
      </div>
    </div>
  );
}
