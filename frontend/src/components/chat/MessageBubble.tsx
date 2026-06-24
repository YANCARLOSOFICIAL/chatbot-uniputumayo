"use client";

import { useState, memo } from "react";
import dynamic from "next/dynamic";
import { Check, Copy, Mic, Clock, Zap, RotateCcw } from "lucide-react";
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
            background: "#1B6E94", color: "#fff",
            padding: "10px 16px", borderRadius: "20px 20px 4px 20px",
            fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
        <span style={{ fontSize: 9, color: "var(--text-3)", opacity: 0 }} className="group-hover:opacity-100 transition-opacity">
          {timeStr}
        </span>
      </div>
    </div>
  );
}

function BotMessage({ message, isLast, onRegenerate }: { message: Message; isLast?: boolean; onRegenerate?: () => void }) {
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
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }} className="group">
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <GuacamayaAvatar
          state={isStreaming ? "speaking" : "idle"}
          size={26}
          className="drop-shadow-sm"
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: "82%" }}>
        {/* Flat message — editorial newspaper column style */}
        <div
          className="msg-bot-flat prose-chat"
          style={{ color: "var(--text-1)", fontSize: 14, lineHeight: 1.7 }}
        >
          {isStreaming && !message.content ? (
            <span className="streaming-cursor" />
          ) : (
            <MarkdownContent content={message.content} />
          )}
          {isStreaming && message.content && (
            <span className="streaming-cursor" />
          )}
        </div>

        {!isStreaming && (
          <div
            style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, opacity: 0 }}
            className="group-hover:opacity-100 transition-opacity duration-150"
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

export const MessageBubble = memo(function MessageBubble({ message, isLast, onRegenerate }: MessageBubbleProps) {
  if (message.role === "user") return <UserMessage message={message} />;
  return <BotMessage message={message} isLast={isLast} onRegenerate={onRegenerate} />;
});
