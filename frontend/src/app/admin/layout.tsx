"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { isAuthenticated, getUser } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") { setChecked(true); return; }
    if (!isAuthenticated())          { router.replace("/admin/login"); return; }
    const user = getUser();
    if (!user || user.role !== "admin") { router.replace("/chat"); return; }
    setChecked(true);
  }, [pathname, router]);

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
      <AdminSidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
