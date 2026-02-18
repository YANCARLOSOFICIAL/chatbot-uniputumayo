"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { isAuthenticated, getUser } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Login page doesn't need auth check
    if (pathname === "/admin/login") {
      setChecked(true);
      return;
    }

    if (!isAuthenticated()) {
      router.replace("/admin/login");
      return;
    }

    const user = getUser();
    if (!user || user.role !== "admin") {
      router.replace("/chat");
      return;
    }

    setChecked(true);
  }, [pathname, router]);

  // Login page renders without header/padding
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--primary-500)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
