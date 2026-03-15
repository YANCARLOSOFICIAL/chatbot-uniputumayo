"use client";

import { useState } from "react";
import { Check, Copy, Mic, Clock, Zap, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types/chat";

interface MessageBubbleProps {
  message: Message;
}

/* ─── User bubble ─── */
function UserMessage({ message }: { message: Message }) {
  const timeStr = new Date(message.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex justify-end gap-2.5 group">
      <div className="flex flex-col items-end gap-1 max-w-[78%] sm:max-w-[65%]">
        {message.input_type === "voice" && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-4)] px-1">
            <Mic size={9} /> Mensaje de voz
          </span>
        )}

        {/* Bubble */}
        <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-[var(--brand)] text-white shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        <span className="text-[10px] text-[var(--text-4)] px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {timeStr}
        </span>
      </div>

      {/* Avatar */}
      <div className="shrink-0 self-end mb-1">
        <div className="w-8 h-8 rounded-full bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center">
          <svg className="w-4 h-4 text-[var(--text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ─── Bot message — card bubble style ─── */
function BotMessage({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const timeStr = new Date(message.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit",
  });
  const isStreaming = message.id.startsWith("streaming-");

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm ring-2 ring-emerald-500/20">
          <Sparkles size={14} className="text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label */}
        <p className="text-xs font-semibold text-[var(--brand)] mb-2 flex items-center gap-1.5">
          Nexus
          {message.input_type === "voice" && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--text-4)] bg-[var(--surface-3)] border border-[var(--border)] px-1.5 py-0.5 rounded-full font-normal">
              <Mic size={8} /> voz
            </span>
          )}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-[var(--brand)] rounded-sm ml-1 animate-pulse" />
          )}
        </p>

        {/* Card bubble */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="prose-chat text-[var(--text-1)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || " "}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer actions */}
        {!isStreaming && (
          <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-4)]">
              <Clock size={10} /> {timeStr}
            </span>
            {message.response_time_ms && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-4)]">
                <Zap size={10} /> {(message.response_time_ms / 1000).toFixed(1)}s
              </span>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-[var(--text-4)] hover:text-[var(--brand)] transition-colors px-1.5 py-0.5 rounded hover:bg-[var(--surface-3)]"
              aria-label="Copiar respuesta"
            >
              {copied ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Copiar</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main export ─── */
export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  return <BotMessage message={message} />;
}
