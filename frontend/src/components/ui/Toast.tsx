"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

// Module-level event bus — callable from anywhere without hooks
const _listeners = new Set<(items: ToastItem[]) => void>();
let _items: ToastItem[] = [];

function _notify() {
  const snapshot = [..._items];
  _listeners.forEach((fn) => fn(snapshot));
}

function _add(type: ToastType, message: string, durationMs = 4500) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  _items = [..._items, { id, type, message }];
  _notify();
  setTimeout(() => {
    _items = _items.filter((t) => t.id !== id);
    _notify();
  }, durationMs);
}

export const toast = {
  success: (msg: string) => _add("success", msg),
  error:   (msg: string) => _add("error", msg),
  warning: (msg: string) => _add("warning", msg),
  info:    (msg: string) => _add("info", msg),
};

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: "var(--success-bg)",  border: "var(--success)", text: "var(--success)" },
  error:   { bg: "var(--danger-bg)",   border: "var(--danger)",  text: "var(--danger)"  },
  warning: { bg: "var(--warning-bg)",  border: "var(--warning)", text: "var(--warning)" },
  info:    { bg: "var(--brand-light)", border: "var(--brand)",   text: "var(--brand)"   },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = ICONS[item.type];
  const c = COLORS[item.type];
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl border shadow-[var(--shadow-md)] text-sm animate-slide-down"
      style={{
        background: c.bg, borderColor: c.border, color: c.text,
        padding: "12px 14px", minWidth: 260, maxWidth: 400,
      }}
    >
      <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1, lineHeight: 1.5 }}>{item.message}</span>
      <button
        onClick={onClose}
        style={{
          flexShrink: 0, width: 20, height: 20, background: "none", border: "none",
          cursor: "pointer", opacity: 0.6, color: "inherit", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.6")}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    _listeners.add(setItems);
    return () => { _listeners.delete(setItems); };
  }, []);

  if (!items.length) return null;

  return (
    <div
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
      }}
    >
      {items.map((item) => (
        <div key={item.id} style={{ pointerEvents: "auto" }}>
          <ToastCard
            item={item}
            onClose={() => {
              _items = _items.filter((t) => t.id !== item.id);
              _notify();
            }}
          />
        </div>
      ))}
    </div>
  );
}
