import React from "react";

interface AdminHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  return (
    <header className="admin-header">
      <div style={{ display: "flex", gap: 14, alignItems: "stretch", minWidth: 0 }}>
        <div className="admin-header-rule" aria-hidden />
        <div style={{ minWidth: 0 }}>
          <h1 className="admin-header-title">{title}</h1>
          {subtitle && <div className="admin-header-sub">{subtitle}</div>}
        </div>
      </div>
      {action && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {action}
        </div>
      )}
    </header>
  );
}
