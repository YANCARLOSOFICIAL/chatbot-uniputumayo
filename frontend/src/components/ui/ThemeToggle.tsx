"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  size?: "sm" | "md";
  className?: string;
}

export function ThemeToggle({ size = "md", className = "" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    const sz = size === "sm" ? "w-8 h-8" : "w-9 h-9";
    return <div className={`${sz} rounded-lg bg-[var(--surface-3)] ${className}`} />;
  }

  const isDark = resolvedTheme === "dark";
  const sz = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const iconSz = size === "sm" ? 15 : 16;

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`
        ${sz} rounded-lg flex items-center justify-center cursor-pointer
        bg-[var(--surface-3)] text-[var(--text-3)]
        hover:bg-[var(--border)] hover:text-[var(--text-1)]
        border border-[var(--border)]
        transition-all duration-200
        ${className}
      `}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {isDark ? (
        <Sun size={iconSz} className="transition-transform duration-300 rotate-0" />
      ) : (
        <Moon size={iconSz} className="transition-transform duration-300" />
      )}
    </button>
  );
}
