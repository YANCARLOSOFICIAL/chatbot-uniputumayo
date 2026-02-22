"use client";

import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface ChatInputProps {
  onSend: (message: string) => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  isListening: boolean;
  isLoading: boolean;
  isVoiceSupported: boolean;
}

export function ChatInput({
  onSend,
  onVoiceStart,
  onVoiceStop,
  isListening,
  isLoading,
  isVoiceSupported,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 130) + "px";
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    resizeTextarea();
  };

  const resetTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
    resetTextarea();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="bg-white border-t border-gray-100 px-3 sm:px-4 py-3 flex-shrink-0">
      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center justify-center gap-2 mb-2 py-1.5 px-3 bg-red-50 rounded-xl border border-red-100">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-600 font-medium">Escuchando… Habla ahora</span>
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse [animation-delay:300ms]" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
        {/* Voice button */}
        {isVoiceSupported && (
          <button
            type="button"
            onClick={isListening ? onVoiceStop : onVoiceStart}
            disabled={isLoading}
            title={isListening ? "Detener grabación" : "Hablar"}
            aria-label={isListening ? "Detener grabación" : "Hablar"}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-1",
              isListening
                ? "bg-red-500 text-white ring-red-300 shadow-md shadow-red-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 focus:ring-gray-300",
              isLoading && "opacity-40 cursor-not-allowed"
            )}
          >
            {isListening ? (
              /* Stop icon */
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              /* Mic icon */
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
        )}

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Escuchando…" : "Escribe tu pregunta… (Enter para enviar)"}
            rows={1}
            disabled={isLoading || isListening}
            className={cn(
              "w-full resize-none rounded-2xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900",
              "placeholder-gray-400 leading-relaxed",
              "focus:border-[var(--primary-500)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary-500)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150",
              isListening ? "border-red-200 bg-red-50/30" : "border-gray-200"
            )}
            style={{ maxHeight: "130px", overflowY: "auto" }}
          />
          {/* Character hint */}
          {input.length > 200 && (
            <span className="absolute bottom-2 right-3 text-xs text-gray-400 pointer-events-none">
              {input.length}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar mensaje"
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full text-white flex items-center justify-center",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--primary-400)]",
            "transition-all duration-150",
            canSend
              ? "bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-600)] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>

      {/* Hint text */}
      <p className="text-center text-xs text-gray-400 mt-2 hidden sm:block">
        <kbd className="font-mono bg-gray-100 px-1 rounded text-[10px]">Enter</kbd> para enviar ·{" "}
        <kbd className="font-mono bg-gray-100 px-1 rounded text-[10px]">Shift+Enter</kbd> para nueva línea
      </p>
    </div>
  );
}
