"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div
        className={className}
        style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-3)" }}
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={className}
      style={{
        width: 36, height: 36, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--text-3)", transition: "color 150ms, background 150ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--brand)";
        (e.currentTarget as HTMLElement).style.background = "var(--surface-3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
    </button>
  );
}
