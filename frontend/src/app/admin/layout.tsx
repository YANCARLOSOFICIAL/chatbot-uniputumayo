"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, PanelLeft } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { isAuthenticated, getUser } from "@/lib/auth";

const DESKTOP_SIDEBAR_KEY = "admin_sidebar_open";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checked, setChecked] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  // Restaurar preferencia de colapso guardada — se aplica post-montaje para
  // que el primer render (SSR + cliente) coincida con el default `true`.
  useEffect(() => {
    const stored = localStorage.getItem(DESKTOP_SIDEBAR_KEY);
    if (stored !== null) setDesktopOpen(stored === "1");
  }, []);

  const toggleDesktopSidebar = () => {
    setDesktopOpen((prev) => {
      const next = !prev;
      localStorage.setItem(DESKTOP_SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  };

  useEffect(() => {
    if (pathname === "/admin/login") { setChecked(true); return; }
    if (!isAuthenticated())          { router.replace("/admin/login"); return; }
    const user = getUser();
    if (!user || user.role !== "admin") { router.replace("/chat"); return; }
    setChecked(true);
  }, [pathname, router]);

  // Cerrar overlay móvil al cambiar de ruta
  useEffect(() => { setMobileSidebarOpen(false); }, [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  if (!checked) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: "var(--brand-primary)" }} />
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 0.12, 0.24].map((d) => (
              <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--brand-primary)", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg)", position: "relative" }}>
      {/* Ambient glass backdrop — subtle (lower opacity than chat/landing,
          this is a data dashboard, not a marketing surface) so the glass
          header/KPI cards have real detail to refract without competing with
          the actual data. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-8%", right: "15%", width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(27,110,148,0.10), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-12%", left: "30%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(123,181,46,0.08), transparent 70%)" }} />
      </div>

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
          background: "var(--surface)", border: "1px solid var(--border)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          color: "var(--text-3)", cursor: "pointer", padding: 0,
          transition: "left 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <PanelLeft size={13} strokeWidth={1.75} style={{ transform: desktopOpen ? "none" : "scaleX(-1)" }} />
      </button>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto", position: "relative", zIndex: 1 }}>
        {/* Barra superior solo en móvil */}
        <div className="flex md:hidden items-center gap-3 px-4 h-14 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text-1)" }}>
            Guaca Admin
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}
