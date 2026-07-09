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
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setOpenState(v); };
  if (!sources.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      {/* Toggle — subtle, editorial */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px 4px 8px", borderRadius: 9999,
          border: "1px solid var(--border)", background: "var(--surface)",
          fontSize: 11, fontWeight: 600, color: "var(--text-3)",
          cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand-primary)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--brand-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)";
        }}
      >
        <BookOpen size={10} strokeWidth={2} style={{ color: "var(--brand-primary)" }} />
        {sources.length} {sources.length === 1 ? "fuente" : "fuentes"}
        {open ? <ChevronUp size={10} strokeWidth={2} /> : <ChevronDown size={10} strokeWidth={2} />}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {sources.map((source, i) => {
            const score = source.score;
            const dotColor = score >= 0.55 ? "var(--success)" : score >= 0.38 ? "var(--warning)" : "var(--text-3)";
            // Matches the "[N]" citation marker in the message text, which is
            // this source's original retrieval position — NOT its index in
            // this (possibly filtered/non-contiguous) list.
            const n = source.citation_number;
            const isHighlighted = highlightedIndex === n;
            return (
              <div
                key={source.chunk_id}
                id={`source-${n}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px",
                  borderBottom: i < sources.length - 1 ? "1px solid var(--border)" : "none",
                  background: isHighlighted ? "var(--brand-dim)" : "var(--surface)",
                  outline: isHighlighted ? "2px solid var(--brand-primary)" : "none",
                  outlineOffset: -2,
                  transition: "background 0.3s, outline-color 0.3s",
                }}
                onMouseEnter={(e) => { if (!isHighlighted) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { if (!isHighlighted) (e.currentTarget as HTMLDivElement).style.background = "var(--surface)"; }}
              >
                {/* Index */}
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  color: "var(--text-3)", width: 16, flexShrink: 0, textAlign: "right",
                }}>
                  {n}
                </span>

                {/* Doc icon */}
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: "var(--brand-dim)", border: "1px solid var(--brand-light)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BookOpen size={11} style={{ color: "var(--brand-primary)" }} />
                </div>

                {/* Title + program */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "var(--text-1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    lineHeight: 1.3,
                  }}>
                    {source.document_title}
                  </div>
                  {source.program && (
                    <div style={{
                      fontSize: 10, color: "var(--text-3)", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      fontFamily: "var(--font-mono)",
                    }}>
                      {source.program}
                    </div>
                  )}
                </div>

                {/* Relevance dot */}
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: dotColor, flexShrink: 0,
                  boxShadow: `0 0 4px ${dotColor}`,
                }} title={`Relevancia: ${Math.round(score * 100)}%`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
