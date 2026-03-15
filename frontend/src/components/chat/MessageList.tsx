"use client";

import { useRef, useEffect, useState } from "react";
import {
  ChevronDown, Sparkles, GraduationCap, BookOpen,
  Clock, FileText, Mic, Globe, ArrowRight
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
}

const SUGGESTION_CARDS = [
  {
    icon: GraduationCap,
    color: "#10b981",
    title: "Programas académicos",
    description: "Conoce todos los programas que ofrece la IUP",
    query: "¿Cuáles son los programas académicos de la Institución Universitaria del Putumayo?",
  },
  {
    icon: BookOpen,
    color: "#3b82f6",
    title: "Requisitos de admisión",
    description: "Documentos y pasos para ingresar a la IUP",
    query: "¿Cuáles son los requisitos de admisión para ingresar a la IUP?",
  },
  {
    icon: FileText,
    color: "#8b5cf6",
    title: "Pensum de Sistemas",
    description: "Plan de estudios de Ingeniería de Sistemas",
    query: "¿Cuál es el pensum de la carrera de Ingeniería de Sistemas?",
  },
  {
    icon: Clock,
    color: "#f59e0b",
    title: "Horarios y atención",
    description: "Horarios de oficinas y servicios de la IUP",
    query: "¿Cuáles son los horarios de atención de la Institución Universitaria del Putumayo?",
  },
];

/* ─── Empty / Welcome state ─── */
function WelcomeState({ onSend }: { onSend?: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 select-none">
      {/* Logo mark */}
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-5 shadow-[0_0_32px_rgba(16,185,129,.3)]">
        <Sparkles size={26} className="text-white" />
      </div>

      {/* Greeting */}
      <h1 className="text-2xl font-bold text-[var(--text-1)] text-center mb-2">
        ¿En qué te puedo ayudar?
      </h1>
      <p className="text-sm text-[var(--text-3)] text-center max-w-sm leading-relaxed mb-8">
        Soy Nexus, el asistente virtual de la IUP. Pregúntame sobre programas académicos,
        admisión, horarios y más.
      </p>

      {/* Suggestion cards — 2×2 grid */}
      {onSend && (
        <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTION_CARDS.map(({ icon: Icon, color, title, description, query }) => (
            <button
              key={title}
              onClick={() => onSend(query)}
              className="group text-left p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)] hover:shadow-[var(--shadow-md)] transition-all duration-200 hover:-translate-y-0.5 active:scale-[.98]"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                style={{ background: color + "18", color }}
              >
                <Icon size={18} />
              </div>
              <p className="text-sm font-semibold text-[var(--text-1)] mb-1">{title}</p>
              <p className="text-xs text-[var(--text-3)] leading-relaxed">{description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Capabilities row */}
      <div className="flex flex-wrap justify-center gap-3 mt-8">
        {[
          { icon: Mic, label: "Voz y texto" },
          { icon: Globe, label: "Español colombiano" },
          { icon: FileText, label: "Fuentes citadas" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--text-4)] px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
            <Icon size={12} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export function MessageList({ messages, sources, isLoading, onQuickReply }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  /* Auto-scroll when new messages arrive (only if already at bottom) */
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [messages, isLoading]);

  /* Detect scroll position */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      isAtBottomRef.current = dist < 80;
      setShowScrollBtn(dist > 200);
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
          /* Messages */
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i * 0.04, 0.2)}s`, animationFillMode: "both" }}
              >
                <MessageBubble message={msg} />
              </div>
            ))}

            {/* Sources */}
            {sources.length > 0 && (
              <div className="pl-10">
                <SourceCard sources={sources} />
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && <TypingIndicator />}

            {/* Bottom padding */}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-md)] text-xs text-[var(--text-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all animate-fade-up"
          aria-label="Ir al final"
        >
          <ChevronDown size={14} /> Ir al final
        </button>
      )}
    </div>
  );
}
