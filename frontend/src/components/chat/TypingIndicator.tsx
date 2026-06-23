"use client";

import { memo } from "react";
import { GuacamayaAvatar } from "./GuacamayaAvatar";

export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex gap-3" style={{ alignItems: "flex-start" }}>
      <div className="shrink-0" style={{ marginTop: 2 }}>
        <GuacamayaAvatar state="thinking" size={28} className="drop-shadow-sm" />
      </div>
      <div className="msg-bot" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
        <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
          <span className="typing-dot-1" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)", display: "inline-block" }} />
          <span className="typing-dot-2" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)", display: "inline-block" }} />
          <span className="typing-dot-3" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)", display: "inline-block" }} />
        </span>
        <span style={{ fontSize: 13, color: "var(--text-3)" }}>Buscando en el catálogo…</span>
      </div>
    </div>
  );
});
