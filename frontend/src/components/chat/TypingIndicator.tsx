"use client";

import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-up">
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
          <Sparkles size={12} className="text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="pt-0.5">
        <p className="text-xs font-semibold text-[var(--brand)] mb-2">Nexus</p>
        <div className="flex items-center gap-1 h-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-4)] typing-dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-4)] typing-dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-4)] typing-dot-3" />
        </div>
      </div>
    </div>
  );
}
