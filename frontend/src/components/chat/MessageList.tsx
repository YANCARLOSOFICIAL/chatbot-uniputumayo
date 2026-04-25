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
      {/* Guacamaya — modest size, no halo effects */}
      <div className="mb-6">
        <GuacamayaAvatar state="idle" size={72} className="drop-shadow-lg" />
      </div>

      <h1 className="text-display text-xl sm:text-2xl text-[var(--text-1)] text-center mb-2">
        Pregúntale a <span className="gradient-text-iup">Nexus</span>
      </h1>
      <p className="text-center text-[var(--text-2)] max-w-sm mb-8 text-sm leading-relaxed">
        Información sobre programas, admisión, horarios y más de la IUP.
      </p>

      {/* Quick action chips — horizontal row */}
      {onSend && (
        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-lg">
          {CARDS.map(({ icon: Icon, label, query }) => (
            <button
              key={label}
              onClick={() => onSend(query)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)] hover:text-[var(--brand)] active:scale-[.97] transition-all text-[13px] text-[var(--text-2)]"
            >
              <Icon size={14} strokeWidth={1.5} />
              <span>{label}</span>
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
          aria-label="Ir al final"
        >
          <ChevronDown size={12} /> Ir al final
        </button>
      )}
    </div>
  );
}
