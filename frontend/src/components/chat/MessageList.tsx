"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, GraduationCap, BookOpen,
  Clock, FileText, Mic, Globe, ArrowRight, HelpCircle, BookmarkCheck
} from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { SourceCard } from "./SourceCard";
import { GuacamayaAvatar } from "./GuacamayaAvatar";
import { apiClient } from "@/lib/api/client";
import type { Message, SourceInfo, FaqSuggestion } from "@/types/chat";
import type { LucideIcon } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  sources: SourceInfo[];
  faqSuggestion?: FaqSuggestion | null;
  isLoading: boolean;
  onQuickReply?: (text: string) => void;
  onRegenerate?: () => void;
}

/* ── "¿Te refieres a…?" — related curated FAQ for the latest turn ── */
function FaqSuggestionChip({ suggestion, onSelect }: { suggestion: FaqSuggestion; onSelect?: (q: string) => void }) {
  return (
    <div className="pl-8 animate-fade-up">
      <div className="faq-suggest">
        <BookmarkCheck size={13} style={{ color: "var(--brand)", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 180 }}>
          ¿Te refieres a <strong>«{suggestion.question}»</strong>?
          Hay una respuesta oficial en Preguntas frecuentes.
        </span>
        <button
          onClick={() => onSelect?.(suggestion.question)}
          className="btn btn-primary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
        >
          Ver respuesta <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

interface SuggestionCard {
  icon: LucideIcon;
  label: string;
  query: string;
}

// Fallback usado mientras carga /api/v1/chat/suggestions o si falla —
// las tarjetas reales se generan en el backend a partir de lo indexado.
const DEFAULT_CARDS: SuggestionCard[] = [
  { icon: GraduationCap, label: "Programas académicos", query: "¿Qué programas académicos ofrece Uniputumayo?" },
  { icon: Globe, label: "Sedes", query: "¿Cuáles son las sedes de Uniputumayo?" },
  { icon: FileText, label: "Proceso de admisión", query: "¿Cómo es el proceso de admisión en Uniputumayo?" },
  { icon: BookOpen, label: "Contacto", query: "¿Cómo puedo contactar a Uniputumayo?" },
];

const DOC_TYPE_ICONS: Record<string, LucideIcon> = {
  pensum: BookOpen,
  admision: FileText,
  perfil: GraduationCap,
  mision: Globe,
  reglamento: FileText,
};

const CARD_HINTS = [
  "Programas, SNIES y sedes",
  "Mocoa, Sibundoy y Puerto Asís",
  "Pasos, fechas y documentos",
  "Canales de atención oficiales",
];

/* ── Welcome / empty state ── */
function WelcomeState({ onSend }: { onSend?: (q: string) => void }) {
  const [CARDS, setCards] = useState<SuggestionCard[]>(DEFAULT_CARDS);

  useEffect(() => {
    apiClient.getSuggestions()
      .then((data) => {
        if (!data.length) return;
        setCards(data.map((s) => ({
          icon: (s.document_type && DOC_TYPE_ICONS[s.document_type]) || GraduationCap,
          label: s.label,
          query: s.query,
        })));
      })
      .catch(() => {
        // Se queda con DEFAULT_CARDS — no hay conexión o la KB está vacía.
      });
  }, []);

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-avatar animate-fade-up">
          <GuacamayaAvatar state="idle" size={56} />
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <span className="eyebrow">Asistente institucional</span>
          <h1>¿Qué quieres saber de la UniPutumayo?</h1>
          <p className="welcome-sub">
            Pregunta por programas, costos, sedes o admisión. Cada respuesta
            viene del catálogo oficial, con su fuente citada.
          </p>
        </div>

        {onSend && (
          <div className="prompt-grid animate-fade-up" style={{ animationDelay: "0.1s" }}>
            {CARDS.slice(0, 4).map(({ icon: Icon, label, query }, i) => (
              <button key={label} onClick={() => onSend(query)} className="prompt-tile">
                <span className="prompt-tile-icon">
                  <Icon size={14} strokeWidth={1.6} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="prompt-tile-label">{label}</span>
                  <span className="prompt-tile-desc">{CARD_HINTS[i] ?? "Respuesta con fuentes verificadas"}</span>
                </span>
                <ArrowRight size={12} strokeWidth={1.6} style={{ color: "var(--ink-3)", flexShrink: 0, marginTop: 4 }} />
              </button>
            ))}
          </div>
        )}

        <div className="welcome-caps animate-fade-up" style={{ animationDelay: "0.16s" }}>
          {[
            { icon: Mic,      label: "Voz y texto" },
            { icon: Clock,    label: "24/7" },
            { icon: FileText, label: "Fuentes citadas" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="welcome-cap">
              <Icon size={9} strokeWidth={1.6} /> {label}
            </span>
          ))}
        </div>

        <Link href="/faq" className="welcome-faq animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <HelpCircle size={12} strokeWidth={1.7} /> Ver preguntas frecuentes revisadas
        </Link>
      </div>
    </div>
  );
}

/* ── Main ── */
export function MessageList({ messages, sources, faqSuggestion, isLoading, onQuickReply, onRegenerate }: MessageListProps) {
  const scrollRef       = useRef<HTMLDivElement>(null);
  const [showBtn, setShowBtn] = useState(false);
  const isAtBottomRef   = useRef(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);

  const handleCitationClick = (n: number) => {
    setSourcesOpen(true);
    requestAnimationFrame(() => {
      document.getElementById(`source-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setHighlightedSource(n);
    setTimeout(() => setHighlightedSource((cur) => (cur === n ? null : cur)), 1500);
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    // La bienvenida debe quedar arriba: no hay mensajes que seguir.
    if (messages.length === 0) return;
    // Durante streaming (isLoading) usar salto instantáneo: smooth por token = jank.
    if (isAtBottomRef.current) scrollToBottom(!isLoading);
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
        // "off" while a response is streaming so screen readers don't try to
        // announce every incoming token; back to "polite" once it settles so
        // the finished message is announced exactly once.
        aria-live={isLoading ? "off" : "polite"}
        aria-label="Mensajes"
      >
        {isEmpty ? (
          <WelcomeState onSend={onQuickReply} />
        ) : (
          <div className="chat-thread space-y-5">
            <div className="chat-day">Hoy</div>
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
                    // `sources` only ever holds the latest turn's sources (see
                    // ChatContext), so wiring citation clicks on older messages
                    // would open/highlight the wrong turn's source list.
                    onCitationClick={isLast ? handleCitationClick : undefined}
                  />
                </div>
              );
            });
            })()}

            {sources.length > 0 && (
              <div className="pl-8">
                <SourceCard
                  sources={sources}
                  open={sourcesOpen}
                  onOpenChange={setSourcesOpen}
                  highlightedIndex={highlightedSource}
                />
              </div>
            )}

            {!isLoading && faqSuggestion && (
              <FaqSuggestionChip suggestion={faqSuggestion} onSelect={onQuickReply} />
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
          className="chat-scroll-fab animate-fade-up"
          aria-label="Ir al final"
        >
          <ChevronDown size={12} /> Ir al final
        </button>
      )}
    </div>
  );
}
