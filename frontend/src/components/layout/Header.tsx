"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, Settings, User, ChevronDown } from "lucide-react";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";

export function Header() {
  const [user, setUser]           = useState<AuthUser | null>(null);
  const [mounted, setMounted]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) setUser(getUser());
  }, []);

  useEffect(() => {
    const close = () => setDropdownOpen(false);
    window.addEventListener("resize", close);
    document.addEventListener("click", close);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("click", close);
    };
  }, []);

  const handleLogout = () => { logout(); setUser(null); window.location.href = "/"; };

  return (
    <header className="h-12 bg-[var(--bg)] border-b border-[var(--border)] flex items-center px-4 sm:px-6 z-20 flex-shrink-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 group mr-6">
        <div className="w-7 h-7 rounded-lg bg-[var(--brand)] flex items-center justify-center">
          <span className="text-white text-[11px] font-extrabold">N</span>
        </div>
        <div className="hidden sm:flex items-baseline gap-1">
          <span className="font-semibold text-[13px] text-[var(--text-1)]">Nexus</span>
          <span className="text-[12px] text-[var(--text-3)]">Admin</span>
        </div>
      </Link>

      {/* Right */}
      <div className="ml-auto flex items-center gap-1">
        <Link href="/chat"
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[13px] text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors">
          Chat
        </Link>

        {mounted && user ? (
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg hover:bg-[var(--surface-3)] transition-colors"
            >
              <div className="w-6 h-6 rounded-full gradient-brand flex items-center justify-center text-white text-[10px] font-bold uppercase">
                {user.display_name?.[0] ?? "U"}
              </div>
              <span className="hidden md:block text-[13px] text-[var(--text-2)] max-w-[100px] truncate">
                {user.display_name}
              </span>
              <ChevronDown size={11} className={`text-[var(--text-3)] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden z-50 animate-scale-in">
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <p className="text-[12px] font-semibold text-[var(--text-1)] truncate">{user.display_name}</p>
                  <p className="text-[10px] text-[var(--text-3)] capitalize">{user.role}</p>
                </div>
                <div className="py-0.5">
                  {user.role === "admin" && (
                    <Link href="/admin" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-colors">
                      <Settings size={12} className="text-[var(--text-3)]" /> Admin
                    </Link>
                  )}
                  <Link href="/chat" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-colors">
                    <User size={12} className="text-[var(--text-3)]" /> Mi cuenta
                  </Link>
                </div>
                <div className="py-0.5 border-t border-[var(--border)]">
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--error)] hover:bg-[var(--error-dim)] transition-colors">
                    <LogOut size={12} /> Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : mounted ? (
          <Link href="/admin/login"
            className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-colors">
            Iniciar sesión
          </Link>
        ) : null}
      </div>
    </header>
  );
}
