"use client";

import { useRef, useEffect, useState } from "react";
import {
  ChevronDown, GraduationCap, BookOpen,
  Clock, FileText, Mic, Globe, ArrowRight
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
  onRegenerate?: () => void;
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "36px 24px 24px", userSelect: "none" }}>

      {/* Avatar */}
      <div className="animate-fade-up nexus-idle" style={{ marginBottom: 14 }}>
        <GuacamayaAvatar state="idle" size={52} />
      </div>

      {/* Heading */}
      <div className="animate-fade-up" style={{ animationDelay: "0.05s", textAlign: "center", marginBottom: 24, maxWidth: 360 }}>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(20px, 2.8vw, 26px)", fontWeight: 800,
          margin: "0 0 8px", color: "var(--text-1)",
          letterSpacing: "-0.022em", lineHeight: 1.12,
        }}>
          Que quieres saber de UniPutumayo?
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0, lineHeight: 1.6 }}>
          Respuestas del catalogo oficial, con fuentes citadas.
        </p>
      </div>

      {/* Suggestions — asymmetric: 1 featured wide + 3 compact hairline rows */}
      {onSend && (
        <div className="animate-fade-up" style={{ animationDelay: "0.1s", width: "100%", maxWidth: 456 }}>

          {/* Featured wide card */}
          <button
            onClick={() => onSend(CARDS[0].query)}
            className="prompt-card"
            style={{ width: "100%", marginBottom: 6, padding: "14px 16px", gap: 12 }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "var(--brand-dim)", border: "1px solid var(--brand-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <GraduationCap size={16} style={{ color: "var(--brand-primary)" }} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", marginBottom: 3, lineHeight: 1.2 }}>
                {CARDS[0].label}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.4 }}>
                Programa, sede, SNIES y requisitos de admision
              </div>
            </div>
            <ArrowRight size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} strokeWidth={1.5} />
          </button>

          {/* Compact hairline rows */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {CARDS.slice(1).map(({ icon: Icon, label, query }, i) => (
              <button
                key={label}
                onClick={() => onSend(query)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 14px",
                  background: "var(--surface)",
                  border: "none",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                  cursor: "pointer", textAlign: "left",
                  fontFamily: "var(--font-body)",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"; }}
              >
                <Icon size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} strokeWidth={1.5} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>{label}</span>
                <ArrowRight size={11} style={{ color: "var(--text-3)", opacity: 0.4, flexShrink: 0 }} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Capabilities */}
      <div className="animate-fade-up" style={{ animationDelay: "0.22s", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 5, marginTop: 18 }}>
        {[
          { icon: Mic,      label: "Voz y texto" },
          { icon: Clock,    label: "24/7" },
          { icon: FileText, label: "Fuentes citadas" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 11,
            color: "var(--text-3)", padding: "3px 9px", borderRadius: 9999,
            border: "1px solid var(--border)",
          }}>
            <Icon size={9} strokeWidth={1.5} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main ── */
export function MessageList({ messages, sources, isLoading, onQuickReply, onRegenerate }: MessageListProps) {
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
            {(() => {
              const lastBotIdx = messages.reduceRight((found, m, idx) => found === -1 && m.role === "assistant" ? idx : found, -1);
              return messages.map((msg, i) => {
              const isLast = msg.role === "assistant" && i === lastBotIdx;
              return (
                <div
                  key={msg.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.15)}s`, animationFillMode: "both" }}
                >
                  <MessageBubble
                    message={msg}
                    isLast={isLast}
                    onRegenerate={isLast && !isLoading ? onRegenerate : undefined}
                  />
                </div>
              );
            });
            })()}

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
