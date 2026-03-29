"use client";

import { useRef, useEffect, useState } from "react";
import {
  ChevronDown, Sparkles, GraduationCap, BookOpen,
  Clock, FileText, Mic, Globe, ArrowRight
} from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { SourceCard } from "./SourceCard";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import type { Message, SourceInfo } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  sources: SourceInfo[];
  isLoading: boolean;
  onQuickReply?: (text: string) => void;
  avatarState?: "idle" | "listening" | "thinking" | "speaking";
}

const SUGGESTION_CARDS = [
  {
    icon: GraduationCap,
    bgColor: "bg-[#0d9488]/5",
    borderColor: "border-[#0d9488]/60",
    textColor: "text-[#0d9488]",
    title: "Programas académicos",
    description: "Conoce todos los programas que ofrece la IUP",
    query: "¿Cuáles son los programas académicos de la Institución Universitaria del Putumayo?",
  },
  {
    icon: BookOpen,
    bgColor: "bg-[#06b6d4]/5",
    borderColor: "border-[#06b6d4]/60",
    textColor: "text-[#06b6d4]",
    title: "Requisitos de admisión",
    description: "Documentos y pasos para ingresar a la IUP",
    query: "¿Cuáles son los requisitos de admisión para ingresar a la IUP?",
  },
  {
    icon: FileText,
    bgColor: "bg-[#7c3aed]/5",
    borderColor: "border-[#7c3aed]/60",
    textColor: "text-[#7c3aed]",
    title: "Pensum de Sistemas",
    description: "Plan de estudios de Ingeniería de Sistemas",
    query: "¿Cuál es el pensum de la carrera de Ingeniería de Sistemas?",
  },
  {
    icon: Clock,
    bgColor: "bg-[#f97316]/5",
    borderColor: "border-[#f97316]/60",
    textColor: "text-[#f97316]",
    title: "Horarios y atención",
    description: "Horarios de oficinas y servicios de la IUP",
    query: "¿Cuáles son los horarios de atención de la Institución Universitaria del Putumayo?",
  },
];

/* ─── Empty / Welcome state ─── */
function WelcomeState({ onSend }: { onSend?: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12 select-none">
      {/* Logo mark with glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-brand rounded-2xl blur-2xl opacity-30 animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-lg">
          <Sparkles size={28} className="text-white" strokeWidth={1.5} />
        </div>
      </div>

      {/* Main heading */}
      <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-1)] text-center mb-3">
        ¿En qué te puedo ayudar?
      </h1>

      {/* Subtitle */}
      <p className="text-center text-[var(--text-3)] max-w-md mb-10 leading-relaxed">
        Soy Nexus, el asistente virtual de la IUP. Pregúntame sobre programas académicos,
        admisión, horarios y más.
      </p>

      {/* Suggestion cards — 2×2 grid with premium styling */}
      {onSend && (
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {SUGGESTION_CARDS.map(({ icon: Icon, bgColor, borderColor, textColor, title, description, query }) => (
            <button
              key={title}
              onClick={() => onSend(query)}
              className={`group text-left p-5 rounded-lg border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] ${bgColor} ${borderColor} backdrop-blur-sm hover:shadow-[0_8px_16px_rgba(0,0,0,0.3)]`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${bgColor} ${textColor} transition-transform duration-200 group-hover:scale-110`}>
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-1)] mb-1.5">{title}</h3>
              <p className="text-xs text-[var(--text-3)] leading-snug">{description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Capabilities row */}
      <div className="flex flex-wrap justify-center gap-2.5">
        {[
          { icon: Mic, label: "Voz y texto" },
          { icon: Globe, label: "Español colombiano" },
          { icon: FileText, label: "Fuentes citadas" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--text-4)] px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] backdrop-blur-sm">
            <Icon size={12} strokeWidth={1.5} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export function MessageList({ messages, sources, isLoading, onQuickReply, avatarState = "idle" }: MessageListProps) {
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
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            {/* Avatar Display - Shows prominently during conversation */}
            <div className="flex justify-center mb-8 animate-fade-up">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {/* Avatar glow effect for active states */}
                  {avatarState !== "idle" && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d9488] to-[#7c3aed] rounded-full blur-xl opacity-40 animate-pulse" />
                  )}
                  <AvatarDisplay state={avatarState as any} size="lg" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--text-1)]">NEXUS</p>
                  <p className="text-xs text-[var(--text-4)]">
                    {avatarState === "listening" && "Escuchando..."}
                    {avatarState === "thinking" && "Analizando..."}
                    {avatarState === "speaking" && "Respondiendo..."}
                    {avatarState === "idle" && "Listo para ayudar"}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-6">
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
