"use client";

import type { ElementType } from "react";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  padding?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  padding = "56px 0",
}: EmptyStateProps) {
  return (
    <div style={{ textAlign: "center", padding }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 12px",
        }}
      >
        <Icon size={22} style={{ color: "var(--text-3)" }} strokeWidth={1.5} />
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-2)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{description}</div>
    </div>
  );
}
