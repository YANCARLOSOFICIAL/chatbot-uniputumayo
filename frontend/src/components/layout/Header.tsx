"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, Settings, User, ChevronDown, Sparkles } from "lucide-react";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) setUser(getUser());
  }, []);

  useEffect(() => {
    const close = () => setDropdownOpen(false);
    window.addEventListener("resize", close);
    document.addEventListener("click", close);
    return () => { window.removeEventListener("resize", close); document.removeEventListener("click", close); };
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="h-14 bg-[var(--bg)] border-b border-[var(--border)] flex items-center px-4 sm:px-5 z-20 flex-shrink-0 shadow-[var(--shadow-xs)]">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 group mr-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="hidden sm:block font-bold text-sm text-[var(--text-1)]">
          Nexus
          <span className="font-normal text-[var(--text-3)]"> · UniPutumayo</span>
        </span>
      </Link>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle size="sm" />

        <Link href="/chat"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-all">
          Chat
        </Link>

        {mounted && user ? (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl hover:bg-[var(--surface-3)] transition-all group"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--brand)] to-teal-600 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm">
                {user.display_name?.[0] ?? "U"}
              </div>
              <span className="hidden md:block text-sm text-[var(--text-2)] max-w-[120px] truncate">
                {user.display_name}
              </span>
              <ChevronDown size={13} className={`text-[var(--text-4)] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden z-50 animate-scale-in">
                <div className="px-3 py-2.5 border-b border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--text-1)] truncate">{user.display_name}</p>
                  <p className="text-[10px] text-[var(--text-3)] capitalize">{user.role}</p>
                </div>
                <div className="py-1">
                  {user.role === "admin" && (
                    <Link href="/admin" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-all">
                      <Settings size={14} className="text-[var(--text-4)]" /> Panel de administrador
                    </Link>
                  )}
                  <Link href="/chat" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-all">
                    <User size={14} className="text-[var(--text-4)]" /> Mi cuenta
                  </Link>
                </div>
                <div className="py-1 border-t border-[var(--border)]">
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-dim)] transition-all">
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : mounted ? (
          <Link href="/admin/login"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-all shadow-sm">
            Iniciar sesión
          </Link>
        ) : null}
      </div>
    </header>
  );
}
