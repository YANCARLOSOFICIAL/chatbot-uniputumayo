"use client";

import { useState } from "react";
import { Check, Copy, Mic, Clock, Zap } from "lucide-react";
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
    <div className="flex justify-end group">
      <div className="flex flex-col items-end gap-1 max-w-[75%] sm:max-w-[62%]">
        {message.input_type === "voice" && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-4)]">
            <Mic size={9} /> voz
          </span>
        )}
        <div className="msg-user px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm">
          {message.content}
        </div>
        <span className="text-[9px] text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity">
          {timeStr}
        </span>
      </div>
    </div>
  );
}

/* ─── Bot message — flat text, no card ─── */
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
      {/* Small avatar icon */}
      <div className="shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-white">
            <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z"
              fill="currentColor" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[11px] font-semibold text-[var(--text-4)] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
          Nexus
          {message.input_type === "voice" && (
            <span className="inline-flex items-center gap-0.5 text-[9px] bg-[var(--surface-3)] border border-[var(--border)] px-1.5 py-0.5 rounded normal-case font-normal">
              <Mic size={7} strokeWidth={1.5} /> voz
            </span>
          )}
          {isStreaming && <span className="streaming-cursor" />}
        </p>

        <div className="prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || " "}
          </ReactMarkdown>
        </div>

        {!isStreaming && (
          <div className="flex items-center gap-3 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-4)]">
              <Clock size={9} /> {timeStr}
            </span>
            {message.response_time_ms && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-4)]">
                <Zap size={9} /> {(message.response_time_ms / 1000).toFixed(1)}s
              </span>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-[var(--text-4)] hover:text-[var(--brand)] transition-colors px-1.5 py-0.5 rounded hover:bg-[var(--surface-3)]"
            >
              {copied ? <><Check size={9} /> Copiado</> : <><Copy size={9} /> Copiar</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  return <BotMessage message={message} />;
}
