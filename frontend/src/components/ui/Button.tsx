"use client";

import { cn } from "@/lib/utils/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]",
          {
            "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] focus:ring-[var(--brand)] shadow-sm hover:-translate-y-0.5 hover:shadow-md":
              variant === "primary",
            "bg-[var(--surface-3)] text-[var(--text-1)] hover:bg-[var(--border)] focus:ring-[var(--border)] border border-[var(--border)]":
              variant === "secondary",
            "bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-3)] focus:ring-[var(--border)]":
              variant === "ghost",
            "bg-[var(--error)] text-white hover:opacity-90 focus:ring-[var(--error)]":
              variant === "danger",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2 text-sm": size === "md",
            "px-6 py-3 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
