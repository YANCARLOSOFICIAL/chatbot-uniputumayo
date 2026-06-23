"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, MessageCircle, Users,
  BarChart3, Settings, LogOut
} from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth";

const NAV_ITEMS = [
  { id: "overview",      href: "/admin",           icon: LayoutDashboard, label: "Resumen" },
  { id: "knowledge",     href: "/admin/documents",  icon: BookOpen,        label: "Base de conocimiento" },
  { id: "conversations", href: "/admin/conversations", icon: MessageCircle, label: "Conversaciones" },
  { id: "users",         href: "/admin/users",      icon: Users,           label: "Usuarios" },
  { id: "analytics",     href: "/admin/analytics",  icon: BarChart3,       label: "Métricas" },
  { id: "settings",      href: "/admin/config",     icon: Settings,        label: "Configuración" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => { setUser(getUser()); }, []);

  const handleLogout = () => { logout(); window.location.href = "/"; };

  const initials = user?.display_name
    ? user.display_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  return (
    <aside style={{
      width: 248, flexShrink: 0,
      background: "var(--brand-primary-darker)",
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/isotipo.webp" alt="UniPutumayo" style={{ height: 28, objectFit: "contain" }} />
        <div style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>
          Nexus Admin
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "8px 8px", flex: 1, overflowY: "auto" }} className="sb-scroll">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.id}
              href={item.href}
              className={[
                "flex items-center gap-2.5 px-3 py-2.5 rounded-md mb-0.5 text-[13px] font-medium transition-all duration-100 no-underline",
                isActive
                  ? "bg-white/10 text-white active-left-border"
                  : "text-white/75 hover:bg-white/[0.06] hover:text-white",
              ].join(" ")}
              style={{ textDecoration: "none" }}
            >
              <item.icon size={16} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "var(--brand-accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.display_name ?? "Administrador"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>Admin</div>
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 4, borderRadius: 4, display: "flex" }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
