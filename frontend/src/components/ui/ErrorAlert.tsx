"use client";

import { AlertCircle, X } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onDismiss: () => void;
  marginBottom?: number;
}

export function ErrorAlert({ message, onDismiss, marginBottom = 20 }: ErrorAlertProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: "var(--r)",
        background: "var(--error-dim)",
        border: "1px solid rgba(200,54,44,0.2)",
        color: "var(--error)",
        fontSize: 13,
        marginBottom,
      }}
    >
      <AlertCircle size={14} style={{ flexShrink: 0 }} /> {message}
      <button
        onClick={onDismiss}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
