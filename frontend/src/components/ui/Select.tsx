"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState, type CSSProperties, type KeyboardEvent } from "react";

// Radix forbids an Item value of "" (that string is reserved to mean
// "cleared"), but the app's native <select> markup relies on value=""
// for "Sin especificar" / "General" placeholder-like options. Map it to
// a sentinel internally so callers can keep passing/receiving "".
const EMPTY_SENTINEL = "__none__";
const toInternal = (v: string) => (v === "" ? EMPTY_SENTINEL : v);
const toExternal = (v: string) => (v === EMPTY_SENTINEL ? "" : v);

// Accent/case-insensitive so "sistemas" matches "Sistemas" and "ingenieria"
// matches "Ingeniería" — catalogs are typed inconsistently by admins.
const normalize = (s: string) =>
  s.normalize("NFKD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase();

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  triggerStyle,
  triggerClassName = "input",
  searchable = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerStyle?: CSSProperties;
  triggerClassName?: string;
  // Adds a text filter above the list — for catalogs that can grow past a
  // comfortable scroll (programs/faculties/document types). Leave off for
  // short, fixed lists (roles, page-size) where it would just be noise.
  searchable?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = searchable && search.trim()
    ? options.filter((o) => normalize(o.label).includes(normalize(search)))
    : options;

  // Radix's own type-to-jump listens for keydown on the content and would
  // fight with typing into this input (stealing focus back to an item on
  // every keystroke) — stop propagation for anything that isn't a control
  // key Radix needs for closing/navigating out of the input.
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!["Escape", "Tab"].includes(e.key)) {
      e.stopPropagation();
    }
  };

  return (
    <RadixSelect.Root
      value={toInternal(value)}
      onValueChange={(v) => onValueChange(toExternal(v))}
      disabled={disabled}
      onOpenChange={(open) => { if (!open) setSearch(""); }}
    >
      <RadixSelect.Trigger
        className={triggerClassName}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
          ...triggerStyle,
        }}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r)", boxShadow: "var(--shadow-md)",
            overflow: "hidden", zIndex: 200,
            width: "var(--radix-select-trigger-width)",
          }}
        >
          {searchable && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 9px", borderBottom: "1px solid var(--border)" }}>
              <Search size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar..."
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: 13, color: "var(--text-1)", minWidth: 0,
                }}
              />
            </div>
          )}
          <RadixSelect.Viewport style={{ padding: 4, maxHeight: 280, overflowY: "auto" }}>
            {searchable && filtered.length === 0 ? (
              <div style={{ padding: "10px 9px", fontSize: 12, color: "var(--text-3)" }}>Sin resultados</div>
            ) : (
              filtered.map((o) => (
                <RadixSelect.Item
                  key={o.value}
                  value={toInternal(o.value)}
                  className="select-item"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 9px", borderRadius: 6, fontSize: 13,
                    color: "var(--text-1)", cursor: "pointer", outline: "none",
                    userSelect: "none",
                  }}
                >
                  <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator style={{ marginLeft: "auto", display: "flex", color: "var(--brand-primary)" }}>
                    <Check size={12} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))
            )}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
