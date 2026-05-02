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
  avatarState?: "idle" | "listening" | "thinking" | "speaking";
}

const CARDS = [
  {
    icon: GraduationCap,
    label: "¿Qué pregrados hay en Mocoa?",
    query: "¿Qué pregrados hay en la sede Mocoa de UniPutumayo?",
  },
  {
    icon: Globe,
    label: "Programas en Sibundoy y Puerto Asís",
    query: "¿Qué programas académicos hay en las sedes de Sibundoy y Puerto Asís?",
  },
  {
    icon: FileText,
    label: "Requisitos de inscripción 2026-1",
    query: "¿Cuáles son los requisitos de inscripción para el período 2026-1 en UniPutumayo?",
  },
  {
    icon: BookOpen,
    label: "¿Cuáles son los costos académicos?",
    query: "¿Cuáles son los costos académicos y derechos de matrícula en UniPutumayo?",
  },
];

/* ── Welcome / empty state ── */
function WelcomeState({ onSend }: { onSend?: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 select-none">
      <div className="mb-5">
        <GuacamayaAvatar state="idle" size={64} className="drop-shadow-md" />
      </div>

      <div className="eyebrow-band mb-2" style={{ textAlign: "center" }}>NEXUS UNIPUTUMAYO</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, textAlign: "center", marginBottom: 8, color: "var(--text-1)", letterSpacing: "-0.015em" }}>
        ¡Hola! ¿En qué te puedo ayudar?
      </h1>
      <p className="text-center text-[var(--text-2)] max-w-xs mb-8 text-sm leading-relaxed">
        Pregúntame sobre programas, sedes, costos y trámites de UniPutumayo.
      </p>

      {onSend && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, maxWidth: 560, width: "100%" }}>
          {CARDS.map(({ icon: Icon, label, query }) => (
            <button
              key={label}
              onClick={() => onSend(query)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "13px 14px",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)", cursor: "pointer",
                fontFamily: "var(--font-body)", fontSize: 13,
                color: "var(--text-1)", textAlign: "left",
                transition: "all 120ms ease",
              }}
              className="hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] active:scale-[.98]"
            >
              <Icon size={16} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {[
          { icon: Mic, label: "Voz y texto" },
          { icon: Clock, label: "Disponible 24/7" },
          { icon: FileText, label: "Fuentes citadas" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1 text-[11px] text-[var(--text-3)] px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)]"
          >
            <Icon size={10} strokeWidth={1.5} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main ── */
export function MessageList({
  messages, sources, isLoading, onQuickReply,
}: MessageListProps) {
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
