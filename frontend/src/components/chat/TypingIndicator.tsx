"use client";

import { memo } from "react";
import { GuacamayaAvatar } from "./GuacamayaAvatar";

const BARS = [0, 0.15, 0.3, 0.45, 0.6];

export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex gap-3" style={{ alignItems: "flex-start" }}>
      <div className="shrink-0" style={{ marginTop: 2 }}>
        <GuacamayaAvatar state="thinking" size={28} className="drop-shadow-sm" />
      </div>
      <div className="msg-bot" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
        <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 20 }}>
          {BARS.map((delay, i) => (
            <span
              key={i}
              className="wave-bar"
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-3)" }}>Buscando en el catalogo</span>
      </div>
    </div>
  );
});
