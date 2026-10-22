"use client";

import { useState, useEffect, useRef, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, Copy, Mic, Clock, Zap, RotateCcw, BookmarkCheck } from "lucide-react";
import type { Message } from "@/types/chat";
import { GuacamayaAvatar } from "./GuacamayaAvatar";

const MarkdownContent = dynamic(
  () => import("./MarkdownContent").then((m) => ({ default: m.MarkdownContent })),
  { ssr: false, loading: () => <span style={{ color: "var(--ink-3)", fontSize: 14, opacity: 0.5 }}>...</span> }
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, maxWidth: "78%" }}>
        {message.input_type === "voice" && (
          <span className="msg-meta-item" style={{ display: "inline-flex" }}>
            <Mic size={9} /> voz
          </span>
        )}
        <div className="msg-user-bubble">{message.content}</div>
        <div className="msg-meta" style={{ justifyContent: "flex-end", marginTop: 0 }}>
          <span className="msg-meta-item">{timeStr}</span>
        </div>
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
        <GuacamayaAvatar state={isStreaming ? "speaking" : "idle"} size={26} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Curated FAQ answer — written by the institution, not generated.
            Persisted via answer_source so it survives reloads. */}
        {message.answer_source === "faq" && (
          <Link
            href={message.faq_entry_id ? `/faq?id=${message.faq_entry_id}` : "/faq"}
            title="Esta respuesta viene de las Preguntas frecuentes revisadas por la institución"
            className="badge badge-pri"
            style={{ display: "inline-flex", marginBottom: 8, textDecoration: "none" }}
          >
            <BookmarkCheck size={10} strokeWidth={2} /> Pregunta frecuente · respuesta oficial
          </Link>
        )}

        {/* Flat message — editorial newspaper column style */}
        <div className="msg-bot-flat prose-chat" style={{ color: "var(--ink)" }}>
          {isStreaming && !message.content ? (
            <span className="streaming-cursor" />
          ) : (
            <MarkdownContent content={message.content} onCitationClick={onCitationClick} />
          )}
          {isStreaming && message.content && <span className="streaming-cursor" />}
        </div>

        {!isStreaming && (
          <div className="msg-meta">
            <span className="msg-meta-item">
              <Clock size={9} /> {timeStr}
            </span>
            {message.response_time_ms && (
              <span className="msg-meta-item">
                <Zap size={9} /> {(message.response_time_ms / 1000).toFixed(1)}s
              </span>
            )}
            {message.input_type === "voice" && (
              <span className="msg-meta-item">
                <Mic size={9} /> voz
              </span>
            )}
            <button onClick={handleCopy} className="msg-meta-btn">
              {copied ? <><Check size={9} /> Copiado</> : <><Copy size={9} /> Copiar</>}
            </button>
            {isLast && onRegenerate && (
              <button onClick={onRegenerate} className="msg-meta-btn">
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
