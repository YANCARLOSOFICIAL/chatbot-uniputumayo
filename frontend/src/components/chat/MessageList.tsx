"use client";

import { useRef, useEffect, useState } from "react";
import {
  ChevronDown, Sparkles, GraduationCap, BookOpen,
  Clock, FileText, Mic, Globe
} from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { SourceCard } from "./SourceCard";
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
    label: "Programas",
    query: "¿Cuáles son los programas académicos de la Institución Universitaria del Putumayo?",
  },
  {
    icon: BookOpen,
    label: "Admisión",
    query: "¿Cuáles son los requisitos de admisión para ingresar a la IUP?",
  },
  {
    icon: FileText,
    label: "Pensum",
    query: "¿Cuál es el pensum de la carrera de Ingeniería de Sistemas?",
  },
  {
    icon: Clock,
    label: "Horarios",
    query: "¿Cuáles son los horarios de atención de la Institución Universitaria del Putumayo?",
  },
];

/* ── Welcome / empty state ── */
function WelcomeState({ onSend }: { onSend?: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 select-none">
      {/* Icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-[var(--brand)] rounded-2xl blur-2xl opacity-20 animate-pulse" />
        <div className="relative w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center shadow-lg">
          <Sparkles size={24} className="text-white" strokeWidth={1.5} />
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-1)] text-center mb-2 tracking-tight">
        ¿En qué puedo ayudarte?
      </h1>
      <p className="text-center text-[var(--text-3)] max-w-sm mb-8 text-sm leading-relaxed">
        Soy Nexus, asistente de la IUP. Pregúntame sobre programas, admisión, horarios y más.
      </p>

      {/* Quick action cards */}
      {onSend && (
        <div className="w-full max-w-lg grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
          {CARDS.map(({ icon: Icon, label, query }) => (
            <button
              key={label}
              onClick={() => onSend(query)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)] hover:bg-[var(--brand-dim)] hover:-translate-y-0.5 transition-all duration-200 group text-center"
            >
              <Icon size={18} className="text-[var(--brand)] group-hover:scale-110 transition-transform" strokeWidth={1.5} />
              <span className="text-xs font-medium text-[var(--text-2)]">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Capabilities */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
          { icon: Mic, label: "Voz y texto" },
          { icon: Globe, label: "Español colombiano" },
          { icon: FileText, label: "Fuentes citadas" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-[11px] text-[var(--text-4)] px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]"
          >
            <Icon size={11} strokeWidth={1.5} /> {label}
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
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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
              <div className="pl-10">
                <SourceCard sources={sources} />
              </div>
            )}

            {isLoading && <TypingIndicator />}
            <div className="h-4" />
          </div>
        )}
      </div>

      {/* Scroll FAB */}
      {showBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-md)] text-xs text-[var(--text-3)] hover:text-[var(--brand)] hover:border-[var(--brand)] transition-all animate-fade-up"
          aria-label="Ir al final"
        >
          <ChevronDown size={13} /> Ir al final
        </button>
      )}
    </div>
  );
}
