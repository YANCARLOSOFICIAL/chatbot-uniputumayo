"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { LogOut, Settings, User, ChevronDown } from "lucide-react";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";

export function Header() {
  const [user, setUser]                 = useState<AuthUser | null>(null);
  const [mounted, setMounted]           = useState(false);
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
    <header style={{
      height: 52,
      background: "var(--bg)",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 20px 0 18px",
      zIndex: 20, flexShrink: 0,
      gap: 0,
    }}>
      {/* Brand */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", marginRight: 24 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, overflow: "hidden", flexShrink: 0,
          background: "var(--brand-dim)", border: "1px solid var(--brand-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Image src="/isotipo.webp" alt="Nexus" width={22} height={22} style={{ objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            Nexus
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: "var(--brand-primary)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
            textTransform: "uppercase", opacity: 0.85,
          }}>
            Admin
          </span>
        </div>
      </Link>

      {/* Separator */}
      <div style={{ width: 1, height: 18, background: "var(--border)", marginRight: 20, flexShrink: 0 }} />

      {/* Nav link */}
      <Link href="/chat" style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 7,
        fontSize: 12, fontWeight: 500, color: "var(--text-3)",
        textDecoration: "none", transition: "color 0.12s, background 0.12s",
        border: "1px solid transparent",
      }}
        onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.color = "var(--text-1)"; el.style.background = "var(--surface-2)"; el.style.borderColor = "var(--border)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.color = "var(--text-3)"; el.style.background = "transparent"; el.style.borderColor = "transparent"; }}
      >
        Ir al chat
      </Link>

      {/* Right: user */}
      <div style={{ marginLeft: "auto" }}>
        {mounted && user ? (
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 6px 4px 4px", borderRadius: 8,
                background: dropdownOpen ? "var(--surface-2)" : "transparent",
                border: "1px solid transparent",
                cursor: "pointer", transition: "all 0.12s",
              }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "var(--surface-2)"; el.style.borderColor = "var(--border)"; }}
              onMouseLeave={(e) => { if (!dropdownOpen) { const el = e.currentTarget as HTMLButtonElement; el.style.background = "transparent"; el.style.borderColor = "transparent"; } }}
            >
              {/* Squircle avatar (not circle) */}
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: "linear-gradient(135deg, #1B6E94, #7BB52E)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase",
                letterSpacing: "0.02em",
              }}>
                {user.display_name?.[0] ?? "A"}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.display_name}
              </span>
              <ChevronDown size={11} style={{ color: "var(--text-3)", transition: "transform 0.15s", transform: dropdownOpen ? "rotate(180deg)" : "none" }} />
            </button>

            {dropdownOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                width: 192, borderRadius: 11,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)",
                overflow: "hidden", zIndex: 50,
                animation: "fade-up 0.12s cubic-bezier(0.16,1,0.3,1)",
              }}>
                <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.display_name}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", margin: 0, textTransform: "capitalize", fontFamily: "var(--font-mono)" }}>{user.role}</p>
                </div>
                <div style={{ padding: "4px 0" }}>
                  {user.role === "admin" && (
                    <Link href="/admin" onClick={() => setDropdownOpen(false)} style={dropdownLinkStyle}>
                      <Settings size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} /> Panel admin
                    </Link>
                  )}
                  <Link href="/chat" onClick={() => setDropdownOpen(false)} style={dropdownLinkStyle}>
                    <User size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} /> Mi cuenta
                  </Link>
                </div>
                <div style={{ padding: "4px 0", borderTop: "1px solid var(--border)" }}>
                  <button onClick={handleLogout} style={{
                    ...dropdownLinkStyle as React.CSSProperties,
                    width: "100%", border: "none", cursor: "pointer",
                    color: "var(--error)", background: "none",
                    textAlign: "left",
                  }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--error-dim)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <LogOut size={12} style={{ flexShrink: 0 }} /> Cerrar sesion
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : mounted ? (
          <Link href="/admin/login" style={{
            padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: "var(--brand-primary)", color: "#fff",
            textDecoration: "none", display: "inline-block", transition: "opacity 0.12s",
          }}>
            Iniciar sesion
          </Link>
        ) : null}
      </div>
    </header>
  );
}

const dropdownLinkStyle = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "7px 14px", fontSize: 12, fontWeight: 500,
  color: "var(--text-2)", textDecoration: "none",
  transition: "background 0.1s, color 0.1s",
};
