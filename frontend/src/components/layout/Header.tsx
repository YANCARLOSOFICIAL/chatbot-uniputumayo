"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { MiniGuacamaya } from "@/components/avatar/AvatarDisplay";

export function Header() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) {
      setUser(getUser());
    }
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="h-16 bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-800)] text-white flex items-center px-6 shadow-md">
      <Link href="/" className="flex items-center gap-3">
        <MiniGuacamaya className="w-8 h-8" />
        <div>
          <h1 className="text-sm font-bold leading-tight">Chatbot IUP</h1>
          <p className="text-xs text-green-200 leading-tight">
            Universidad del Putumayo
          </p>
        </div>
      </Link>

      <nav className="ml-auto flex items-center gap-4">
        <Link
          href="/chat"
          className="text-sm text-green-100 hover:text-white transition-colors"
        >
          Chat
        </Link>

        {mounted && user ? (
          <>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="text-sm text-green-100 hover:text-white transition-colors"
              >
                Admin
              </Link>
            )}
            <span className="text-sm text-green-200">{user.display_name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-green-200 hover:text-white transition-colors"
            >
              Cerrar Sesión
            </button>
          </>
        ) : mounted ? (
          <>
            <Link
              href="/admin/login"
              className="text-sm text-green-100 hover:text-white transition-colors"
            >
              Iniciar Sesión
            </Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
