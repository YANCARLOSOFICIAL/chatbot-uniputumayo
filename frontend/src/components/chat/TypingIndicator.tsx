"use client";

import { memo } from "react";
import { GuacamayaAvatar } from "./GuacamayaAvatar";

const BARS = [0, 0.15, 0.3, 0.45, 0.6];

export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="group" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <GuacamayaAvatar state="thinking" size={26} />
      </div>
      <div className="msg-bot-flat" style={{ display: "inline-flex", alignItems: "center", gap: 10, paddingTop: 4, paddingBottom: 4 }}>
        <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 18 }}>
          {BARS.map((delay, i) => (
            <span key={i} className="wave-bar" style={{ animationDelay: `${delay}s` }} />
          ))}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", color: "var(--ink-3)" }}>
          Buscando en el catálogo
        </span>
      </div>
    </div>
  );
});
