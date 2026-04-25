"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FileText, Settings, Users, Activity, CheckCircle2, XCircle,
  Clock, ArrowRight, MessageSquare
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getUser } from "@/lib/auth";

interface HealthData {
  status: string;
  services: Record<string, { status: string; latency_ms?: number }>;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + "14", color }}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[11px] text-[var(--text-3)] mb-0.5">{label}</p>
        <p className="text-lg font-bold text-[var(--text-1)] leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-[var(--text-3)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function NavCard({ href, icon: Icon, title, description, color }: {
  href: string; icon: React.ElementType; title: string; description: string; color: string;
}) {
  return (
    <Link href={href}
      className="group bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-2)] hover:shadow-[var(--shadow-md)] transition-all card-interactive">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: color + "14", color }}>
          <Icon size={20} />
        </div>
        <ArrowRight size={14} className="text-[var(--text-3)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <h3 className="font-semibold text-[var(--text-1)] text-sm mb-1">{title}</h3>
      <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{description}</p>
    </Link>
  );
}

export default function AdminPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [user, setUser] = useState<{ display_name?: string } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    setUser(getUser());
    apiClient.checkHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoadingHealth(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">

      {/* Welcome — solid brand gradient, no dot patterns */}
      <div className="rounded-xl overflow-hidden bg-gradient-to-r from-[#031928] via-[#09618F] to-[#0a5f88]">
        <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="text-white">
            <p className="text-[13px] text-white/60 mb-0.5">{greeting},</p>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">
              {user?.display_name || "Administrador"}
            </h1>
            <p className="text-white/50 text-[13px] mt-0.5">Panel de control de Nexus</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Activity}      label="Estado sistema" value={health?.status === "healthy" ? "Activo" : "—"} sub="Verificado ahora" color="#30a46c" />
        <StatCard icon={MessageSquare} label="Conversaciones" value="—" sub="Sin datos aún" color="#0091ff" />
        <StatCard icon={FileText}      label="Documentos"     value="—" sub="Sin datos aún" color="#e5a000" />
        <StatCard icon={Users}         label="Usuarios"       value="—" sub="Sin datos aún" color="#8b5cf6" />
      </div>

      {/* System health */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        <h2 className="text-[13px] font-semibold text-[var(--text-1)] mb-3 flex items-center gap-1.5">
          <Activity size={13} className="text-[var(--brand)]" />
          Estado del sistema
        </h2>

        {loadingHealth ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-24 rounded-md shimmer" />
            ))}
          </div>
        ) : health ? (
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
              {health.status === "healthy" ? <CheckCircle2 size={12} className="text-[var(--success)]" /> : <XCircle size={12} className="text-[var(--error)]" />}
              <span className="text-[11px] font-medium text-[var(--text-1)]">Sistema: {health.status}</span>
            </div>
            {Object.entries(health.services).map(([name, svc]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                {svc.status === "healthy"
                  ? <CheckCircle2 size={12} className="text-[var(--success)]" />
                  : <XCircle size={12} className="text-[var(--error)]" />
                }
                <span className="text-[11px] font-medium text-[var(--text-1)] capitalize">{name}</span>
                {svc.latency_ms != null && (
                  <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-3)]">
                    <Clock size={9} /> {svc.latency_ms}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-2)]">
            <XCircle size={13} className="text-[var(--error)]" />
            No se pudo conectar con el servidor
          </div>
        )}
      </div>

      {/* Navigation */}
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text-1)] mb-3">Módulos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <NavCard
            href="/admin/documents"
            icon={FileText}
            title="Documentos"
            description="Subir y administrar documentos académicos para la base de conocimientos."
            color="#0091ff"
          />
          <NavCard
            href="/admin/config"
            icon={Settings}
            title="Configuración IA"
            description="Configurar proveedores de IA, modelos de lenguaje y API keys."
            color="#8b5cf6"
          />
          <NavCard
            href="/admin/users"
            icon={Users}
            title="Usuarios"
            description="Gestionar usuarios registrados, roles y permisos de acceso."
            color="#30a46c"
          />
        </div>
      </div>

      {/* Quick links — inline */}
      <div className="flex gap-3 text-[13px]">
        <Link href="/chat" className="text-[var(--text-2)] hover:text-[var(--brand)] transition-colors flex items-center gap-1">
          <MessageSquare size={12} /> Ir al chat
        </Link>
        <Link href="/" className="text-[var(--text-2)] hover:text-[var(--brand)] transition-colors">
          Página principal
        </Link>
      </div>
    </div>
  );
}
