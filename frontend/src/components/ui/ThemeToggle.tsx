"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useIsClient } from "@/hooks/useAuthState";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsClient();

  if (!mounted) {
    return (
      <div
        className={className}
        style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", background: "var(--surface-2)" }}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={className}
      style={{
        width: 34, height: 34, borderRadius: "var(--r-sm)",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: "1px solid transparent", cursor: "pointer",
        color: "var(--ink-3)",
        transition: "color var(--dur-micro), background-color var(--dur-micro), border-color var(--dur-micro)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.color = "var(--brand)";
        el.style.background = "var(--surface-2)";
        el.style.borderColor = "var(--rule)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.color = "var(--ink-3)";
        el.style.background = "transparent";
        el.style.borderColor = "transparent";
      }}
    >
      {isDark ? <Sun size={15} strokeWidth={1.7} /> : <Moon size={15} strokeWidth={1.7} />}
    </button>
  );
}
