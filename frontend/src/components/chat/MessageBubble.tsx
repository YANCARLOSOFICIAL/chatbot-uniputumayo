"use client";

import { useState, useEffect, useRef, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, Copy, Mic, Clock, Zap, RotateCcw, BookmarkCheck } from "lucide-react";
import type { Message } from "@/types/chat";
import { GuacamayaAvatar } from "./GuacamayaAvatar";

const MarkdownContent = dynamic(
  () => import("./MarkdownContent").then((m) => ({ default: m.MarkdownContent })),
  { ssr: false, loading: () => <span style={{ color: "var(--text-2)", fontSize: 14, opacity: 0.5 }}>...</span> }
);

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
  onRegenerate?: () => void;
  onCitationClick?: (n: number) => void;
}

function UserMessage({ message }: { message: Message }) {
  const timeStr = new Date(message.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }} className="group">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, maxWidth: "72%" }}>
        {message.input_type === "voice" && (
          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-3)" }}>
            <Mic size={9} /> voz
          </span>
        )}
        <div
          style={{
            background: "var(--user-bg)", color: "#fff",
            padding: "10px 16px", borderRadius: "20px 20px 4px 20px",
            fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
        <span style={{ fontSize: 9, color: "var(--text-3)", opacity: 0 }} className="group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {timeStr}
        </span>
      </div>
    </div>
  );
}

function BotMessage({ message, isLast, onRegenerate, onCitationClick }: { message: Message; isLast?: boolean; onRegenerate?: () => void; onCitationClick?: (n: number) => void }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  const timeStr = new Date(message.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit",
  });
  const isStreaming = message.id.startsWith("streaming-");

  const handleCopy = () => {
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }} className="group">
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <GuacamayaAvatar
          state={isStreaming ? "speaking" : "idle"}
          size={26}
          className="drop-shadow-sm"
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: "82%" }}>
        {/* Curated FAQ answer — written by the institution, not generated.
            Persisted via answer_source so it survives reloads. */}
        {message.answer_source === "faq" && (
          <Link
            href={message.faq_entry_id ? `/faq?id=${message.faq_entry_id}` : "/faq"}
            title="Esta respuesta viene de las Preguntas frecuentes revisadas por la institución"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 6,
              padding: "3px 9px", borderRadius: 9999, fontSize: 10.5, fontWeight: 600,
              background: "var(--brand-dim)", border: "1px solid var(--brand-light)",
              color: "var(--brand-primary)", textDecoration: "none",
            }}
          >
            <BookmarkCheck size={10} strokeWidth={2} /> Pregunta frecuente · respuesta oficial
          </Link>
        )}
        {/* Flat message — editorial newspaper column style */}
        <div
          className="msg-bot-flat prose-chat"
          style={{ color: "var(--text-1)", fontSize: 14, lineHeight: 1.7 }}
        >
          {isStreaming && !message.content ? (
            <span className="streaming-cursor" />
          ) : (
            <MarkdownContent content={message.content} onCitationClick={onCitationClick} />
          )}
          {isStreaming && message.content && (
            <span className="streaming-cursor" />
          )}
        </div>

        {!isStreaming && (
          <div
            style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, opacity: 0 }}
            className="group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-150"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-3)" }}>
              <Clock size={9} /> {timeStr}
            </span>
            {message.response_time_ms && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-3)" }}>
                <Zap size={9} /> {(message.response_time_ms / 1000).toFixed(1)}s
              </span>
            )}
            {message.input_type === "voice" && (
              <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 10, color: "var(--text-3)" }}>
                <Mic size={9} /> voz
              </span>
            )}
            <button
              onClick={handleCopy}
              style={{
                display: "flex", alignItems: "center", gap: 3,
                fontSize: 10, color: "var(--text-3)", background: "none",
                border: "none", cursor: "pointer", padding: "2px 6px",
                borderRadius: 4, transition: "color 0.12s, background 0.12s",
              }}
              className="hover:text-[var(--brand)] hover:bg-[var(--surface-3)]"
            >
              {copied ? <><Check size={9} /> Copiado</> : <><Copy size={9} /> Copiar</>}
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                style={{
                  display: "flex", alignItems: "center", gap: 3,
                  fontSize: 10, color: "var(--text-3)", background: "none",
                  border: "none", cursor: "pointer", padding: "2px 6px",
                  borderRadius: 4, transition: "color 0.12s",
                }}
                className="hover:text-[var(--brand)]"
              >
                <RotateCcw size={9} /> Regenerar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, isLast, onRegenerate, onCitationClick }: MessageBubbleProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  return <BotMessage message={message} isLast={isLast} onRegenerate={onRegenerate} onCitationClick={onCitationClick} />;
});
