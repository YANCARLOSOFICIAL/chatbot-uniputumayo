"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, MessageCircle, Users,
  BarChart3, Settings, LogOut, X, Tags, FlaskConical, HelpCircle,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { useAuthUser } from "@/hooks/useAuthState";

const NAV_ITEMS = [
  { id: "overview",      href: "/admin",               icon: LayoutDashboard, label: "Resumen" },
  { id: "knowledge",     href: "/admin/documents",     icon: BookOpen,        label: "Documentos" },
  { id: "catalogs",      href: "/admin/catalogos",     icon: Tags,            label: "Catálogos" },
  { id: "faq",           href: "/admin/faq",           icon: HelpCircle,      label: "Preguntas frecuentes" },
  { id: "conversations", href: "/admin/conversations", icon: MessageCircle,   label: "Conversaciones" },
  { id: "users",         href: "/admin/users",         icon: Users,           label: "Usuarios" },
  { id: "analytics",     href: "/admin/analytics",     icon: BarChart3,       label: "Métricas" },
  { id: "rag-eval",      href: "/admin/rag-eval",      icon: FlaskConical,    label: "Evaluación RAG" },
  { id: "settings",      href: "/admin/config",        icon: Settings,        label: "Configuración" },
];

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Controla el ancho del sidebar en desktop (colapsable). Default: true. */
  desktopOpen?: boolean;
}

export function AdminSidebar({ isOpen, onClose, desktopOpen = true }: AdminSidebarProps) {
  const pathname = usePathname();
  const user = useAuthUser();

  const handleLogout = () => { logout(); window.location.href = "/"; };

  const initials = user?.display_name
    ? user.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  const sidebar = (
    <aside className="admin-sidebar">
      {/* Brand */}
      <div className="admin-brand">
        <div className="admin-brand-mark">
          <Image src="/isotipo.webp" alt="Guaca" width={24} height={24} style={{ objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="admin-brand-name">Guaca</div>
          <div className="admin-brand-sub">Admin</div>
        </div>
        <button
          onClick={onClose}
          className="admin-icon-btn admin-close-mobile"
          style={{ width: 26, height: 26 }}
          aria-label="Cerrar menú"
        >
          <X size={13} />
        </button>
      </div>

      {/* Nav */}
      <nav className="admin-nav sb-scroll">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className="admin-nav-link"
              data-active={isActive}
            >
              <span className="admin-nav-icon">
                <item.icon size={15} strokeWidth={isActive ? 2 : 1.7} />
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && (
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Quick link to chat */}
      <div style={{ padding: "6px 8px 10px", borderTop: "1px solid var(--sb-border)" }}>
        <Link href="/chat" className="admin-link-foot">
          <MessageCircle size={11} strokeWidth={1.6} /> Ver chat
        </Link>
      </div>

      {/* User footer */}
      <div className="admin-sidebar-foot">
        <div className="admin-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="admin-user-name">{user?.display_name ?? "Administrador"}</div>
          <div className="admin-user-role">Admin</div>
        </div>
        <button onClick={handleLogout} title="Cerrar sesión" className="admin-icon-btn" aria-label="Cerrar sesión">
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div
        className="hidden md:flex flex-shrink-0 overflow-hidden transition-all duration-200 relative"
        style={{ width: desktopOpen ? 252 : 0, zIndex: 1 }}
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
