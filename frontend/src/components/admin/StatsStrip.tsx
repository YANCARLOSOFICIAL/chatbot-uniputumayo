"use client";

import type { ReactNode } from "react";

export interface StatItem {
  label: string;
  value: string | number | ReactNode;
  color: string;
}

interface StatsStripProps {
  items: StatItem[];
  borderRadius?: number;
}

export function StatsStrip({ items, borderRadius = 12 }: StatsStripProps) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        marginBottom: 24,
      }}
    >
      {items.map((s, i) => (
        <div
          key={s.label}
          style={{
            flex: 1,
            padding: "22px 24px",
            borderRight:
              i < items.length - 1 ? "1px solid var(--border)" : "none",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px,3vw,38px)",
              fontWeight: 900,
              color: s.color,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            {s.value}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-3)",
              marginTop: 7,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
