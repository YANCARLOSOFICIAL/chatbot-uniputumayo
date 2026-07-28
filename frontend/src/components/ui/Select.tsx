"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";

// Radix forbids an Item value of "" (that string is reserved to mean
// "cleared"), but the app's native <select> markup relies on value=""
// for "Sin especificar" / "General" placeholder-like options. Map it to
// a sentinel internally so callers can keep passing/receiving "".
const EMPTY_SENTINEL = "__none__";
const toInternal = (v: string) => (v === "" ? EMPTY_SENTINEL : v);
const toExternal = (v: string) => (v === EMPTY_SENTINEL ? "" : v);

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
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerStyle?: CSSProperties;
  triggerClassName?: string;
}) {
  return (
    <RadixSelect.Root
      value={toInternal(value)}
      onValueChange={(v) => onValueChange(toExternal(v))}
      disabled={disabled}
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
          <RadixSelect.Viewport style={{ padding: 4, maxHeight: 280, overflowY: "auto" }}>
            {options.map((o) => (
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
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
