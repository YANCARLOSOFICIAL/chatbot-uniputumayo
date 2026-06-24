import React from "react";

interface AdminHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  return (
    <header style={{
      padding: "22px 32px 18px",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
      display: "flex", justifyContent: "space-between",
      alignItems: "flex-start", flexShrink: 0, gap: 16,
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{
          width: 3, borderRadius: 9999, alignSelf: "stretch", flexShrink: 0,
          background: "linear-gradient(180deg, #1B6E94 0%, #7BB52E 100%)",
          minHeight: 32,
        }} />
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800,
            margin: 0, color: "var(--text-1)", letterSpacing: "-0.025em", lineHeight: 1.1,
          }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 5 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {action && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {action}
        </div>
      )}
    </header>
  );
}
