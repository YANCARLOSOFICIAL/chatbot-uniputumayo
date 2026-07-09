"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, MessageCircle, Users,
  BarChart3, Settings, LogOut, X, Tags,
} from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth";

const NAV_ITEMS = [
  { id: "overview",      href: "/admin",               icon: LayoutDashboard, label: "Resumen" },
  { id: "knowledge",     href: "/admin/documents",     icon: BookOpen,        label: "Documentos" },
  { id: "catalogs",      href: "/admin/catalogos",     icon: Tags,            label: "Catálogos" },
  { id: "conversations", href: "/admin/conversations", icon: MessageCircle,   label: "Conversaciones" },
  { id: "users",         href: "/admin/users",         icon: Users,           label: "Usuarios" },
  { id: "analytics",     href: "/admin/analytics",     icon: BarChart3,       label: "Metricas" },
  { id: "settings",      href: "/admin/config",        icon: Settings,        label: "Configuracion" },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Controla el ancho del sidebar en desktop (colapsable). Default: true. */
  desktopOpen?: boolean;
}

export function AdminSidebar({ isOpen, onClose, desktopOpen = true }: AdminSidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => { setUser(getUser()); }, []);

  const handleLogout = () => { logout(); window.location.href = "/"; };

  const initials = user?.display_name
    ? user.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  const sidebar = (
    <aside style={{
      width: 252,
      background: "var(--admin-sb-bg)",
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top brand gradient bar */}
      <div style={{
        height: 3, flexShrink: 0, width: "100%",
        background: "linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
      }} />

      {/* Ambient glow blob */}
      <div style={{
        position: "absolute", top: -60, left: -60,
        width: 240, height: 240, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(27,110,148,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Brand area */}
      <div style={{
        padding: "18px 16px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, overflow: "hidden", flexShrink: 0,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Image src="/isotipo.webp" alt="Guaca" width={26} height={26} style={{ objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>
            Guaca
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: "var(--brand-accent)", marginTop: 4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Admin
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "rgba(255,255,255,0.5)",
          }}
          className="md:hidden"
          aria-label="Cerrar menu"
        >
          <X size={14} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ padding: "10px 8px", flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }} className="sb-scroll">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                textDecoration: "none", fontSize: 13, fontWeight: isActive ? 600 : 500,
                color: isActive ? "#fff" : "rgba(255,255,255,0.70)",
                background: isActive
                  ? "linear-gradient(90deg, rgba(27,110,148,0.22) 0%, rgba(27,110,148,0.06) 100%)"
                  : "transparent",
                borderLeft: isActive ? "2.5px solid var(--brand-primary)" : "2.5px solid transparent",
                boxShadow: isActive ? "inset 0 0 12px rgba(27,110,148,0.06)" : "none",
                transition: "all 0.12s cubic-bezier(0.16,1,0.3,1)",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.background = "rgba(255,255,255,0.04)";
                  el.style.color = "rgba(255,255,255,0.75)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.background = "transparent";
                  el.style.color = "rgba(255,255,255,0.70)";
                }
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isActive ? "rgba(27,110,148,0.25)" : "rgba(255,255,255,0.04)",
                border: isActive ? "1px solid rgba(27,110,148,0.3)" : "1px solid transparent",
                transition: "all 0.12s",
              }}>
                <item.icon size={14} strokeWidth={isActive ? 2 : 1.75}
                  style={{ color: isActive ? "var(--brand-primary)" : "rgba(255,255,255,0.55)", transition: "color 0.12s" }} />
              </div>
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && (
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand-accent)", flexShrink: 0, boxShadow: "0 0 5px var(--brand-accent)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Separator + quick link to chat */}
      <div style={{ padding: "6px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", zIndex: 1 }}>
        <Link href="/chat" style={{
          display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
          borderRadius: 7, color: "rgba(255,255,255,0.52)", textDecoration: "none",
          fontSize: 11, fontWeight: 500, fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em", textTransform: "uppercase",
          transition: "color 0.12s",
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.80)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.52)"; }}
        >
          <MessageCircle size={10} strokeWidth={1.5} /> Ver chat
        </Link>
      </div>

      {/* User footer */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 10,
        position: "relative", zIndex: 1,
        background: "rgba(0,0,0,0.15)",
      }}>
        {/* Squircle avatar — not circle */}
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.01em",
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {user?.display_name ?? "Administrador"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginTop: 2 }}>
            Admin
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesion"
          style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            cursor: "pointer", color: "rgba(255,255,255,0.48)",
            transition: "all 0.12s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "rgba(200,54,44,0.15)";
            el.style.borderColor = "rgba(200,54,44,0.3)";
            el.style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "rgba(255,255,255,0.04)";
            el.style.borderColor = "rgba(255,255,255,0.06)";
            el.style.color = "rgba(255,255,255,0.48)";
          }}
        >
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div
        className="hidden md:flex flex-shrink-0 overflow-hidden transition-all duration-200"
        style={{ width: desktopOpen ? 252 : 0 }}
        aria-hidden={!desktopOpen}
      >
        {sidebar}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} aria-hidden />
      )}
      <div className={[
        "fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-200 ease-in-out flex-shrink-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}>
        {sidebar}
      </div>
    </>
  );
}
