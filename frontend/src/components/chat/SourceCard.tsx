"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import type { SourceInfo } from "@/types/chat";

interface SourceCardProps {
  sources: SourceInfo[];
}

export function SourceCard({ sources }: SourceCardProps) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[11px] text-[var(--text-4)] hover:text-[var(--brand)] transition-colors font-medium"
      >
        <FileText size={11} strokeWidth={1.5} />
        <span>
          {sources.length} fuente{sources.length !== 1 ? "s" : ""} consultada{sources.length !== 1 ? "s" : ""}
        </span>
        {open ? <ChevronUp size={10} strokeWidth={1.5} /> : <ChevronDown size={10} strokeWidth={1.5} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2 animate-fade-down">
          {sources.map((source) => {
            const pct = Math.round(source.score * 100);
            return (
              <div
                key={source.chunk_id}
                className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]/30 transition-colors"
              >
                <FileText size={12} strokeWidth={1.5} className="text-[var(--text-4)] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--text-2)] truncate">
                    {source.document_title}
                  </p>
                  {source.program && (
                    <p className="text-[10px] text-[var(--text-4)] truncate mt-0.5">{source.program}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-0.5 rounded-full bg-[var(--surface-3)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--text-4)] tabular-nums">{pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
