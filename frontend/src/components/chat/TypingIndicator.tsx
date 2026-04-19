"use client";

import { GuacamayaAvatar } from "./GuacamayaAvatar";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-up">
      {/* Guacamaya pensando */}
      <div className="shrink-0 mt-0.5">
        <GuacamayaAvatar state="thinking" size={32} className="drop-shadow-sm" />
      </div>
      <div className="pt-1">
        <p className="text-[11px] font-semibold text-[var(--text-4)] mb-2 uppercase tracking-wider">Nexus</p>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] typing-dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] typing-dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] typing-dot-3" />
        </div>
      </div>
    </div>
  );
}
