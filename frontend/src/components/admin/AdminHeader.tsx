import React from "react";

interface AdminHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  return (
    <header style={{
      padding: "20px 32px",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      flexShrink: 0,
    }}>
      <div>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          margin: 0,
          color: "var(--text-1)",
        }}>
          {title}
        </h2>
        {subtitle && (
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </header>
  );
}
