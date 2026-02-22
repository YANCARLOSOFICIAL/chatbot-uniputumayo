"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { MiniGuacamaya } from "@/components/avatar/AvatarDisplay";

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) {
      setUser(getUser());
    }
  }, []);

  // Close menu on route change / resize
  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="h-16 bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-800)] text-white flex items-center px-4 sm:px-6 shadow-md relative z-20 flex-shrink-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={() => setMenuOpen(false)}>
        <MiniGuacamaya className="w-8 h-8 flex-shrink-0" />
        <div className="hidden sm:block min-w-0">
          <h1 className="text-sm font-bold leading-tight">Nexus UniPutumayo</h1>
          <p className="text-xs text-green-200 leading-tight truncate">
            Universidad del Putumayo
          </p>
        </div>
        <span className="sm:hidden text-sm font-bold">Nexus</span>
      </Link>

      {/* Desktop nav */}
      <nav className="ml-auto hidden sm:flex items-center gap-1">
        <Link
          href="/chat"
          className="px-3 py-1.5 rounded-lg text-sm text-green-100 hover:text-white hover:bg-white/10 transition-colors"
        >
          Chat
        </Link>

        {mounted && user ? (
          <>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg text-sm text-green-100 hover:text-white hover:bg-white/10 transition-colors"
              >
                Admin
              </Link>
            )}
            <div className="flex items-center gap-2 ml-1 pl-3 border-l border-white/20">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold uppercase">
                {user.display_name?.[0] ?? "U"}
              </div>
              <span className="text-sm text-green-100 max-w-[120px] truncate hidden md:block">
                {user.display_name}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-sm text-green-200 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden lg:inline">Salir</span>
              </button>
            </div>
          </>
        ) : mounted ? (
          <Link
            href="/admin/login"
            className="px-3 py-1.5 rounded-lg text-sm bg-white/15 text-white hover:bg-white/25 transition-colors border border-white/20"
          >
            Iniciar Sesión
          </Link>
        ) : null}
      </nav>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="ml-auto sm:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Menú"
        aria-expanded={menuOpen}
      >
        {menuOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[var(--primary-800)] border-t border-white/10 shadow-xl sm:hidden z-50">
          <nav className="flex flex-col py-2">
            <Link
              href="/chat"
              onClick={() => setMenuOpen(false)}
              className="px-5 py-3 text-sm text-green-100 hover:bg-white/10 hover:text-white transition-colors"
            >
              Chat
            </Link>
            {mounted && user ? (
              <>
                {user.role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="px-5 py-3 text-sm text-green-100 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <div className="px-5 py-3 border-t border-white/10 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">
                    {user.display_name?.[0] ?? "U"}
                  </div>
                  <span className="text-sm text-green-200 flex-1 truncate">{user.display_name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-5 py-3 text-sm text-red-300 hover:bg-white/10 hover:text-red-200 transition-colors text-left flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar Sesión
                </button>
              </>
            ) : mounted ? (
              <Link
                href="/admin/login"
                onClick={() => setMenuOpen(false)}
                className="px-5 py-3 text-sm text-green-100 hover:bg-white/10 hover:text-white transition-colors"
              >
                Iniciar Sesión
              </Link>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
}
