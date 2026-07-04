"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Server, Cloud, Check } from "lucide-react";
import { apiClient } from "@/lib/api/client";

export interface ModelSelection {
  provider: string | null; // null = use the server's configured default
  model: string | null;
}

interface ProviderInfo {
  name: string;
  models: string[];
  is_available: boolean;
  is_default: boolean;
  default_model: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Ollama (Local)",
  openai: "OpenAI (Nube)",
};

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  ollama: Server,
  openai: Cloud,
};

const STORAGE_KEY = "chat_llm_selection";

function loadSaved(): ModelSelection {
  if (typeof window === "undefined") return { provider: null, model: null };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { provider: null, model: null };
    const parsed = JSON.parse(raw);
    return { provider: parsed.provider ?? null, model: parsed.model ?? null };
  } catch {
    return { provider: null, model: null };
  }
}

export function ModelSelector({
  onChange,
}: {
  onChange: (selection: ModelSelection) => void;
}) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selection, setSelection] = useState<ModelSelection>({ provider: null, model: null });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadSaved();
    setSelection(saved);
    onChange(saved);
    apiClient
      .getProviders()
      .then((data) => setProviders(data.providers as ProviderInfo[]))
      .catch(() => setProviders([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const pick = (next: ModelSelection) => {
    setSelection(next);
    setOpen(false);
    onChange(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const activeLabel = selection.provider
    ? `${PROVIDER_LABELS[selection.provider] ?? selection.provider} · ${selection.model}`
    : "Automático";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors px-2.5 py-1.5 rounded-md border border-[var(--border)] max-w-[110px] sm:max-w-[200px]"
        style={{ whiteSpace: "nowrap" }}
        title="Elegir modelo de IA"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{activeLabel}</span>
        <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
            minWidth: 240, maxHeight: 320, overflowY: "auto",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 6,
          }}
        >
          <button
            onClick={() => pick({ provider: null, model: null })}
            className="w-full flex items-center justify-between text-[12px] px-2.5 py-2 rounded-md hover:bg-[var(--surface-3)] transition-colors"
            style={{ color: "var(--text-1)" }}
          >
            <span>Automático (recomendado)</span>
            {!selection.provider && <Check size={13} style={{ color: "var(--brand-primary)" }} />}
          </button>

          {providers.map((p) => {
            const Icon = PROVIDER_ICONS[p.name] ?? Server;
            return (
              <div key={p.name} style={{ marginTop: 4 }}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 8px 2px",
                    fontSize: 11, fontWeight: 600, color: "var(--text-3)",
                    textTransform: "uppercase", letterSpacing: "0.03em",
                  }}
                >
                  <Icon size={11} />
                  {PROVIDER_LABELS[p.name] ?? p.name}
                  {!p.is_available && <span style={{ fontWeight: 400, textTransform: "none" }}>· no disponible</span>}
                </div>
                {p.models.map((m) => (
                  <button
                    key={m}
                    disabled={!p.is_available}
                    onClick={() => pick({ provider: p.name, model: m })}
                    className="w-full flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md hover:bg-[var(--surface-3)] transition-colors"
                    style={{
                      color: p.is_available ? "var(--text-1)" : "var(--text-3)",
                      cursor: p.is_available ? "pointer" : "not-allowed",
                    }}
                  >
                    <span className="truncate">{m}</span>
                    {selection.provider === p.name && selection.model === m && (
                      <Check size={13} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
