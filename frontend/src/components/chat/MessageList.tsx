"use client";

import { useRef, useEffect, useState } from "react";
import {
  ChevronDown, GraduationCap, BookOpen,
  Clock, FileText, Mic, Globe
} from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { SourceCard } from "./SourceCard";
import { GuacamayaAvatar } from "./GuacamayaAvatar";
import type { Message, SourceInfo } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  sources: SourceInfo[];
  isLoading: boolean;
  onQuickReply?: (text: string) => void;
}

const CARDS = [
  {
    icon: GraduationCap,
    label: "Pregrados en Mocoa",
    query: "Que pregrados hay en la sede Mocoa de UniPutumayo?",
  },
  {
    icon: Globe,
    label: "Sedes Sibundoy y Puerto Asis",
    query: "Que programas academicos hay en las sedes de Sibundoy y Puerto Asis?",
  },
  {
    icon: FileText,
    label: "Requisitos 2026-1",
    query: "Cuales son los requisitos de inscripcion para el periodo 2026-1 en UniPutumayo?",
  },
  {
    icon: BookOpen,
    label: "Costos academicos",
    query: "Cuales son los costos academicos y derechos de matricula en UniPutumayo?",
  },
];

/* ── Welcome / empty state ── */
function WelcomeState({ onSend }: { onSend?: (q: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "48px 24px", userSelect: "none" }}>

      {/* Avatar */}
      <div className="animate-fade-up" style={{ animationDelay: "0s", marginBottom: 20 }}>
        <GuacamayaAvatar state="idle" size={56} className="drop-shadow-md" />
      </div>

      {/* Heading block */}
      <div className="animate-fade-up" style={{ animationDelay: "0.06s", textAlign: "center", marginBottom: 28, maxWidth: 420 }}>
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--text-3)",
            border: "1px solid var(--border)", borderRadius: 9999, padding: "4px 11px",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand-accent)", flexShrink: 0, animation: "pulse-soft 2s ease-in-out infinite" }} />
            Nexus · UniPutumayo
          </span>
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800,
          margin: "0 0 10px", color: "var(--text-1)",
          letterSpacing: "-0.025em", lineHeight: 1.1,
        }}>
          Que quieres saber<br />de UniPutumayo?
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0, lineHeight: 1.65 }}>
          Pregunta sobre programas, sedes, costos o tramites. Respuestas verificadas del catalogo oficial.
        </p>
      </div>

      {/* Prompt cards */}
      {onSend && (
        <div className="animate-fade-up" style={{ animationDelay: "0.12s", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 520 }}>
          {CARDS.map(({ icon: Icon, label, query }, i) => (
            <button
              key={label}
              onClick={() => onSend(query)}
              className="prompt-card"
              style={{ animationDelay: `${0.14 + i * 0.05}s`, animationFillMode: "both" }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: "var(--brand-dim)", border: "1px solid var(--brand-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={13} style={{ color: "var(--brand-primary)" }} />
              </div>
              <span style={{ fontSize: 12.5, lineHeight: 1.4, color: "var(--text-1)" }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Capabilities */}
      <div className="animate-fade-up" style={{ animationDelay: "0.35s", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 20 }}>
        {[
          { icon: Mic,      label: "Voz y texto" },
          { icon: Clock,    label: "24/7" },
          { icon: FileText, label: "Fuentes citadas" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 11,
            color: "var(--text-3)", padding: "4px 10px", borderRadius: 9999,
            border: "1px solid var(--border)", background: "var(--surface)",
          }}>
            <Icon size={10} strokeWidth={1.5} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main ── */
export function MessageList({ messages, sources, isLoading, onQuickReply }: MessageListProps) {
  const scrollRef       = useRef<HTMLDivElement>(null);
  const [showBtn, setShowBtn] = useState(false);
  const isAtBottomRef   = useRef(true);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      isAtBottomRef.current = dist < 80;
      setShowBtn(dist > 200);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto"
        aria-live="polite"
        aria-label="Mensajes"
      >
        {isEmpty ? (
          <WelcomeState onSend={onQuickReply} />
        ) : (
          <div className="max-w-2xl mx-auto px-4 sm:px-5 py-6 space-y-5">
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i * 0.03, 0.15)}s`, animationFillMode: "both" }}
              >
                <MessageBubble message={msg} />
              </div>
            ))}

            {sources.length > 0 && (
              <div className="pl-8">
                <SourceCard sources={sources} />
              </div>
            )}

            {isLoading && <TypingIndicator />}
            <div className="h-3" />
          </div>
        )}
      </div>

      {/* Scroll FAB */}
      {showBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-md)] text-[12px] text-[var(--text-2)] hover:text-[var(--brand)] hover:border-[var(--brand)] transition-all animate-fade-up"
          aria-label="Ir al final" style={{ textDecoration: "none" }}
        >
          <ChevronDown size={12} /> Ir al final
        </button>
      )}
    </div>
  );
}
