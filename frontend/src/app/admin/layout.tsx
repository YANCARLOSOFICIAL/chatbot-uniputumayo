"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { isAuthenticated, getUser } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checked, setChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") { setChecked(true); return; }
    if (!isAuthenticated())          { router.replace("/admin/login"); return; }
    const user = getUser();
    if (!user || user.role !== "admin") { router.replace("/chat"); return; }
    setChecked(true);
  }, [pathname, router]);

  // Cerrar sidebar al cambiar de ruta en móvil
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  if (!checked) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--brand-primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
        {/* Barra superior solo en móvil */}
        <div className="flex md:hidden items-center gap-3 px-4 h-14 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text-1)" }}>
            Nexus Admin
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}
