"use client";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-up">
      <div className="shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center shadow-sm">
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-white">
            <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z"
              fill="currentColor" />
          </svg>
        </div>
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
