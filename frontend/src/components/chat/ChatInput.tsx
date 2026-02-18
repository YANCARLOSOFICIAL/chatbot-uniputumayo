"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <form onSubmit={handleSubmit} className="flex items-end gap-2 max-w-3xl mx-auto">
        {isVoiceSupported && (
          <button
            type="button"
            onClick={isListening ? onVoiceStop : onVoiceStart}
            disabled={isLoading}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
              {
                "bg-red-500 text-white animate-pulse": isListening,
                "bg-gray-100 text-gray-600 hover:bg-gray-200": !isListening,
                "opacity-50 cursor-not-allowed": isLoading,
              }
            )}
            title={isListening ? "Detener grabación" : "Hablar"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}

        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta..."
            rows={1}
            disabled={isLoading || isListening}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--primary-500)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--primary-500)] disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-500)] text-white flex items-center justify-center hover:shadow-md hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
