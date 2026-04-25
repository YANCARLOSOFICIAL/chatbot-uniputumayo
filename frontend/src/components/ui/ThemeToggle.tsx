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
    const sz = size === "sm" ? "w-7 h-7" : "w-8 h-8";
    return <div className={`${sz} rounded-md bg-[var(--surface-3)] ${className}`} />;
  }

  const isDark = resolvedTheme === "dark";
  const sz = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const iconSz = size === "sm" ? 13 : 14;

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`
        ${sz} rounded-md flex items-center justify-center cursor-pointer
        text-[var(--text-3)]
        hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]
        transition-colors duration-150
        ${className}
      `}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {isDark ? (
        <Sun size={iconSz} />
      ) : (
        <Moon size={iconSz} />
      )}
    </button>
  );
}
