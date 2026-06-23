"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { SourceInfo } from "@/types/chat";

interface SourceCardProps {
  sources: SourceInfo[];
}

export function SourceCard({ sources }: SourceCardProps) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-3)] hover:text-[var(--brand-primary)] bg-transparent border-none cursor-pointer p-0 transition-colors duration-100"
      >
        <BookOpen size={11} strokeWidth={1.5} />
        <span>
          {sources.length} fuente{sources.length !== 1 ? "s" : ""} consultada{sources.length !== 1 ? "s" : ""}
        </span>
        {open ? <ChevronUp size={10} strokeWidth={1.5} /> : <ChevronDown size={10} strokeWidth={1.5} />}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {sources.map((source) => {
            const score = source.score;
            const dotColor = score >= 0.6 ? "var(--success)" : score >= 0.4 ? "var(--warning)" : "var(--text-3)";
            return (
              <div key={source.chunk_id} className="citation-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "var(--r)",
                    background: "var(--brand-primary-lighter)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <BookOpen size={13} style={{ color: "var(--brand-primary)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {source.document_title}
                    </div>
                    {source.program && (
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {source.program}
                      </div>
                    )}
                  </div>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
