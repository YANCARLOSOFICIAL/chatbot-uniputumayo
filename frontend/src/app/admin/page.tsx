"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FileText, Settings, Users, Activity, CheckCircle2, XCircle,
  Clock, Zap, ArrowRight, TrendingUp, MessageSquare
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getUser } from "@/lib/auth";

interface HealthData {
  status: string;
  services: Record<string, { status: string; latency_ms?: number }>;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-[var(--success)]" : "bg-[var(--error)]"} ${ok ? "animate-pulse" : ""}`} />
      {ok ? "Activo" : "Error"}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex items-center gap-4 shadow-[var(--shadow-xs)]">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "20", color }}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-[var(--text-3)] mb-0.5">{label}</p>
        <p className="text-xl font-bold text-[var(--text-1)]">{value}</p>
        {sub && <p className="text-xs text-[var(--text-4)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function NavCard({ href, icon: Icon, title, description, color }: {
  href: string; icon: React.ElementType; title: string; description: string; color: string;
}) {
  return (
    <Link href={href}
      className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--brand)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: color + "20", color }}>
          <Icon size={22} />
        </div>
        <ArrowRight size={16} className="text-[var(--text-4)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all" />
      </div>
      <h3 className="font-semibold text-[var(--text-1)] mb-1.5">{title}</h3>
      <p className="text-sm text-[var(--text-3)] leading-relaxed">{description}</p>
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

      {/* ── Welcome ── */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#031928] via-[#09618F] to-[#0a4f75]" />
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#F7BF00] blur-3xl opacity-10" />
        <div className="relative z-10 p-6 sm:p-8 flex items-center justify-between gap-4">
          <div className="text-white">
            <p className="text-sm text-white/70 mb-1">{greeting},</p>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {user?.display_name || "Administrador"}
            </h1>
            <p className="text-white/70 text-sm mt-1">Panel de control de Nexus</p>
          </div>
          <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-white/10 border border-white/20 items-center justify-center">
            <Activity size={28} className="text-white" />
          </div>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity}      label="Estado sistema" value="Activo"    sub="Operando normalmente" color="#10b981" />
        <StatCard icon={MessageSquare} label="Conversaciones" value="—"         sub="Hoy"                  color="#3b82f6" />
        <StatCard icon={FileText}      label="Documentos"     value="—"         sub="En base de datos"     color="#f59e0b" />
        <StatCard icon={TrendingUp}    label="Precisión RAG"  value="—"         sub="Promedio"             color="#8b5cf6" />
      </div>

      {/* ── System health ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-xs)]">
        <h2 className="text-sm font-semibold text-[var(--text-1)] mb-4 flex items-center gap-2">
          <Activity size={15} className="text-[var(--brand)]" />
          Estado del sistema
        </h2>

        {loadingHealth ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-28 rounded-lg shimmer" />
            ))}
          </div>
        ) : health ? (
          <div className="flex flex-wrap gap-2.5">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[var(--surface-3)] border border-[var(--border)]">
              {health.status === "healthy" ? <CheckCircle2 size={14} className="text-[var(--success)]" /> : <XCircle size={14} className="text-[var(--error)]" />}
              <span className="text-xs font-medium text-[var(--text-1)]">Sistema: {health.status}</span>
            </div>
            {Object.entries(health.services).map(([name, svc]) => (
              <div key={name} className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[var(--surface-3)] border border-[var(--border)]">
                {svc.status === "healthy"
                  ? <CheckCircle2 size={14} className="text-[var(--success)]" />
                  : <XCircle size={14} className="text-[var(--error)]" />
                }
                <span className="text-xs font-medium text-[var(--text-1)] capitalize">{name}</span>
                {svc.latency_ms != null && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--text-4)]">
                    <Clock size={10} /> {svc.latency_ms}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--text-3)]">
            <XCircle size={14} className="text-[var(--error)]" />
            No se pudo conectar con el servidor
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-1)] mb-4">Módulos de administración</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NavCard
            href="/admin/documents"
            icon={FileText}
            title="Gestión de Documentos"
            description="Subir y administrar documentos académicos para la base de conocimientos del chatbot."
            color="#3b82f6"
          />
          <NavCard
            href="/admin/config"
            icon={Settings}
            title="Configuración IA"
            description="Configurar el proveedor de IA, modelos de lenguaje, embeddings y API keys."
            color="#8b5cf6"
          />
          <NavCard
            href="/admin/users"
            icon={Users}
            title="Gestión de Usuarios"
            description="Ver usuarios registrados, gestionar roles y permisos de acceso al sistema."
            color="#10b981"
          />
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="flex flex-wrap gap-2">
        <Link href="/chat"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-[var(--text-2)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all">
          <MessageSquare size={14} /> Ir al chat
        </Link>
        <Link href="/"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-[var(--text-2)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all">
          <Zap size={14} /> Página principal
        </Link>
      </div>
    </div>
  );
}
