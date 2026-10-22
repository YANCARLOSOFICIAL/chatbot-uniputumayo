"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { SourceInfo } from "@/types/chat";

interface SourceCardProps {
  sources: SourceInfo[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  highlightedIndex?: number | null;
}

export function SourceCard({ sources, open: openProp, onOpenChange, highlightedIndex }: SourceCardProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setOpenState(v);
  };
  if (!sources.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      {/* Toggle — subtle, editorial */}
      <button onClick={() => setOpen(!open)} className="source-toggle">
        <BookOpen size={10} strokeWidth={2} style={{ color: "var(--brand)" }} />
        {sources.length} {sources.length === 1 ? "fuente" : "fuentes"}
        {open ? <ChevronUp size={10} strokeWidth={2} /> : <ChevronDown size={10} strokeWidth={2} />}
      </button>

      {open && (
        <div className="source-list">
          {sources.map((source) => {
            const score = source.score;
            const dotColor = score >= 0.55 ? "var(--success)" : score >= 0.38 ? "var(--warning)" : "var(--ink-3)";
            // Matches the "[N]" citation marker in the message text, which is
            // this source's original retrieval position — NOT its index in
            // this (possibly filtered/non-contiguous) list.
            const n = source.citation_number;
            const isHighlighted = highlightedIndex === n;
            return (
              <div
                key={source.chunk_id}
                id={`source-${n}`}
                className="source-item"
                data-highlight={isHighlighted}
              >
                {/* Index */}
                <span className="source-index">{n}</span>

                {/* Doc icon */}
                <div className="source-icon">
                  <BookOpen size={11} />
                </div>

                {/* Title + program + fragment */}
                <div className="source-body">
                  <div className="source-head">
                    <div className="source-title" title={source.document_title}>
                      {source.document_title}
                    </div>
                    {source.program && (
                      <div className="source-program">{source.program}</div>
                    )}
                    {/* Relevance dot */}
                    <div
                      className="source-dot"
                      style={{ background: dotColor }}
                      title={`Relevancia: ${Math.round(score * 100)}%`}
                    />
                  </div>
                  {source.content_preview && (
                    <div className="source-preview" data-expanded={isHighlighted}>
                      &ldquo;{source.content_preview.trim()}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
