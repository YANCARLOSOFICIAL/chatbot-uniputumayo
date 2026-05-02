"use client";

import { useState } from "react";
import { Check, Copy, Mic, Clock, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/types/chat";
import { GuacamayaAvatar } from "./GuacamayaAvatar";

interface MessageBubbleProps {
  message: Message;
}

function UserMessage({ message }: { message: Message }) {
  const timeStr = new Date(message.created_at).toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex justify-end group">
      <div className="flex flex-col items-end gap-1 max-w-[75%] sm:max-w-[62%]">
        {message.input_type === "voice" && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-3)]">
            <Mic size={9} /> voz
          </span>
        )}
        <div className="msg-user px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <span className="text-[9px] text-[var(--text-3)] opacity-0 group-hover:opacity-100 transition-opacity">
          {timeStr}
        </span>
      </div>
    </div>
  );
}

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
    <div className="flex gap-3 group" style={{ alignItems: "flex-start" }}>
      <div className="shrink-0" style={{ marginTop: 2 }}>
        <GuacamayaAvatar
          state={isStreaming ? "speaking" : "idle"}
          size={28}
          className="drop-shadow-sm"
        />
      </div>

      <div className="flex-1 min-w-0" style={{ maxWidth: "78%" }}>
        <div className="msg-bot relative">
          <div className="prose-chat text-[var(--text-1)]">
            {isStreaming && !message.content && <span className="streaming-cursor" />}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content + (isStreaming && message.content ? " █" : "")}
            </ReactMarkdown>
          </div>
        </div>

        {!isStreaming && (
          <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-3)]">
              <Clock size={9} /> {timeStr}
            </span>
            {message.response_time_ms && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                <Zap size={9} /> {(message.response_time_ms / 1000).toFixed(1)}s
              </span>
            )}
            {message.input_type === "voice" && (
              <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-3)]">
                <Mic size={9} /> voz
              </span>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-[var(--text-3)] hover:text-[var(--brand)] transition-colors px-1.5 py-0.5 rounded hover:bg-[var(--surface-3)]"
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
