"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuthenticated, useAuthUser, useIsClient } from "@/hooks/useAuthState";

const DESKTOP_SIDEBAR_KEY = "admin_sidebar_open";
const SIDEBAR_EVENT = "guaca:admin-sidebar";

const subscribeSidebar = (cb: () => void) => {
  window.addEventListener(SIDEBAR_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

const getSidebarOpen = () => localStorage.getItem(DESKTOP_SIDEBAR_KEY) !== "0";
const getServerSidebarOpen = () => true;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const isClient = useIsClient();
  const authed   = useAuthenticated();
  const user     = useAuthUser();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const desktopOpen = useSyncExternalStore(subscribeSidebar, getSidebarOpen, getServerSidebarOpen);

  const isLogin = pathname === "/admin/login";

  const toggleDesktopSidebar = () => {
    localStorage.setItem(DESKTOP_SIDEBAR_KEY, desktopOpen ? "0" : "1");
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };

  // Redirección fuera del render: sin setState dentro del efecto.
  useEffect(() => {
    if (!isClient || isLogin) return;
    if (!authed) { router.replace("/admin/login"); return; }
    if (user?.role !== "admin") { router.replace("/chat"); }
  }, [isClient, isLogin, authed, user, router]);

  if (isLogin) return <>{children}</>;

  if (!isClient || !authed || user?.role !== "admin") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 7, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 16, height: 16, borderRadius: 2, background: "var(--paper)" }} />
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 0.12, 0.24].map((d) => (
              <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand)", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <AdminSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        desktopOpen={desktopOpen}
      />

      {/* Toggle de colapso — solo desktop, anclado al borde del sidebar */}
      <button
        onClick={toggleDesktopSidebar}
        className="hidden md:flex"
        aria-label={desktopOpen ? "Colapsar barra lateral" : "Expandir barra lateral"}
        title={desktopOpen ? "Colapsar" : "Expandir"}
        style={{
          position: "fixed", top: 16,
          left: desktopOpen ? 239 : -13,
          zIndex: 30, width: 26, height: 26, borderRadius: "50%",
          alignItems: "center", justifyContent: "center",
          background: "var(--surface)", border: "1px solid var(--rule)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--ink-3)", cursor: "pointer", padding: 0,
          transition: "left 0.2s var(--ease-out)",
        }}
      >
        <PanelLeft size={13} strokeWidth={1.75} style={{ transform: desktopOpen ? "none" : "scaleX(-1)" }} />
      </button>

      <main className="admin-main">
        {/* Barra superior solo en móvil */}
        <div className="admin-mobilebar">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="admin-icon-btn"
            aria-label="Abrir menú"
          >
            <Menu size={17} strokeWidth={1.7} />
          </button>
          <span className="admin-mobilebar-title">Guaca Admin</span>
        </div>

        {children}
      </main>
    </div>
  );
}
