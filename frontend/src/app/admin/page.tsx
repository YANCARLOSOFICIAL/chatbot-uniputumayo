"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Settings, Users,
  CheckCircle2, XCircle, Clock, MessageSquare,
  Upload, RefreshCw, BarChart3, ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getUser } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface HealthData {
  status: string;
  services: Record<string, { status: string; latency_ms?: number }>;
}

interface DocumentItem {
  id: string;
  title: string;
  ingestion_status: string;
  total_chunks: number;
  created_at?: string;
}

interface ConvItem {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed" || status === "indexed")
    return <span className="badge badge-suc">● Indexado</span>;
  if (status === "processing")
    return <span className="badge badge-pri">● Procesando</span>;
  return <span className="badge badge-err">● Falló</span>;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

export default function AdminPage() {
  const [health, setHealth]         = useState<HealthData | null>(null);
  const [documents, setDocuments]   = useState<DocumentItem[]>([]);
  const [conversations, setConvs]   = useState<ConvItem[]>([]);
  const [userCount, setUserCount]   = useState<number | null>(null);
  const [user, setUser]             = useState<{ display_name?: string } | null>(null);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setUser(getUser());
    try {
      const [healthData, docs, convs, users] = await Promise.allSettled([
        apiClient.checkHealth(),
        apiClient.getDocuments(1, 5),
        apiClient.getConversations(5, 0),
        apiClient.getUsers(),
      ]);
      if (healthData.status === "fulfilled") setHealth(healthData.value);
      if (docs.status === "fulfilled")       setDocuments(docs.value as unknown as DocumentItem[]);
      if (convs.status === "fulfilled")      setConvs(convs.value as unknown as ConvItem[]);
      if (users.status === "fulfilled")      setUserCount(users.value.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Resumen"
        subtitle="Panel de control · Guaca UniPutumayo"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => load()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={12} /> Actualizar
            </button>
            <Link href="/admin/documents" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
              <Upload size={13} /> Subir documento
            </Link>
          </div>
        }
      />

      <div className="admin-content">

        {/* Banner de bienvenida */}
        <div className="admin-hero">
          <div className="admin-hero-img" aria-hidden />
          <div className="admin-hero-scrim" aria-hidden />

          <div className="admin-hero-body">
            <div className="admin-hero-badge">
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
              Panel de control
            </div>
            <div className="admin-hero-title">
              {greeting}, {user?.display_name ?? "Administrador"}
            </div>
            <div className="admin-hero-sub">
              Guaca · UniPutumayo — Sistema RAG institucional
            </div>
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            {loading ? (
              <div style={{ width: 96, height: 34, borderRadius: "var(--r-sm)", background: "rgba(255,255,255,0.08)" }} className="shimmer" />
            ) : health ? (
              <div className="admin-hero-status">
                {health.status === "healthy"
                  ? <CheckCircle2 size={14} style={{ color: "var(--accent)" }} />
                  : <XCircle size={14} style={{ color: "var(--danger)" }} />}
                Sistema {health.status === "healthy" ? "activo" : "con problemas"}
              </div>
            ) : (
              <div className="admin-hero-status" style={{ color: "rgba(255,255,255,0.55)" }}>
                <XCircle size={14} /> Sin conexión
              </div>
            )}
          </div>
        </div>

        {/* Cifras editoriales */}
        <div className="admin-kpi-strip">
          {[
            { label: "Conversaciones", value: loading ? "..." : conversations.length > 0 ? `${conversations.length}+` : "0", color: "var(--brand)" },
            { label: "Usuarios",       value: loading ? "..." : userCount ?? "—",                                       color: "var(--accent-ink)" },
            { label: "Documentos RAG", value: loading ? "..." : documents.length > 0 ? `${documents.length}+` : "0",     color: "var(--warning)" },
            { label: "Sistema",        value: loading ? "..." : health?.status === "healthy" ? "OK" : "—",                color: health?.status === "healthy" ? "var(--success)" : "var(--danger)" },
          ].map((s) => (
            <div key={s.label} className="admin-kpi-cell">
              <div className="admin-kpi-value" style={{ color: s.color }}>{s.value}</div>
              <div className="admin-kpi-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Dos columnas */}
        <div className="analytics-2col">
          {/* Base de conocimiento */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
              <h3 className="admin-section-title">Base de conocimiento</h3>
              <Link href="/admin/documents" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>Ver todo</Link>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div className="shimmer" style={{ height: 14, borderRadius: 6, width: "60%", margin: "0 auto" }} />
                </div>
              ) : documents.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>
                  Sin documentos. <Link href="/admin/documents" style={{ color: "var(--brand)" }}>Sube el primero →</Link>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Chunks</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FileText size={14} style={{ color: "var(--brand)", flexShrink: 0 }} />
                              <span style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                                {d.title}
                              </span>
                            </div>
                          </td>
                          <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{d.total_chunks}</span></td>
                          <td><StatusBadge status={d.ingestion_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Conversaciones recientes */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
              <h3 className="admin-section-title">Conversaciones recientes</h3>
              <Link href="/admin/conversations" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>Ver todas</Link>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div className="shimmer" style={{ height: 14, borderRadius: 6, width: "60%", margin: "0 auto" }} />
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>
                  Sin conversaciones aún.
                </div>
              ) : (
                conversations.map((c, i) => (
                  <div key={c.id} style={{
                    padding: "13px 18px",
                    borderBottom: i < conversations.length - 1 ? "1px solid var(--rule)" : "none",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "var(--r-sm)",
                      background: "var(--brand-tint)",
                      border: "1px solid var(--brand-soft)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <MessageSquare size={13} style={{ color: "var(--brand)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.title ?? "Sin título"}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Clock size={9} /> {timeAgo(c.updated_at)}
                      </div>
                    </div>
                    <span className="badge badge-suc">Activa</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Estado de servicios */}
        {health && Object.keys(health.services).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 18px", borderBottom: "1px solid var(--rule)" }}>
                <BarChart3 size={13} style={{ color: "var(--brand)" }} />
                <span className="admin-section-title" style={{ fontSize: 13 }}>Estado del sistema</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: health.status === "healthy" ? "var(--success)" : "var(--danger)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {health.status === "healthy" ? "Todos los servicios activos" : "Degradado"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {Object.entries(health.services).map(([name, svc], i, arr) => {
                  const ok = svc.status === "healthy";
                  return (
                    <div key={name} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "12px 18px", flex: "0 0 auto",
                      borderRight: i < arr.length - 1 ? "1px solid var(--rule)" : "none",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? "var(--success)" : "var(--danger)", flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--ink)", textTransform: "capitalize" }}>{name}</span>
                      {svc.latency_ms != null && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                          <Clock size={9} /> {svc.latency_ms}ms
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Módulos */}
        <div style={{ marginTop: 24 }}>
          <h3 className="admin-section-title" style={{ marginBottom: 10 }}>Módulos</h3>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {[
              { href: "/admin/documents",     Icon: FileText,      label: "Documentos",      desc: "Base de conocimiento RAG",    iconBg: "var(--brand-tint)", iconColor: "var(--brand)",       featured: true },
              { href: "/admin/config",        Icon: Settings,      label: "Configuración IA", desc: "Proveedores, modelos, API",   iconBg: "var(--surface-2)",  iconColor: "var(--ink-2)",       featured: false },
              { href: "/admin/users",         Icon: Users,         label: "Usuarios",         desc: "Roles y permisos",            iconBg: "var(--success-bg)", iconColor: "var(--success)",     featured: false },
              { href: "/admin/conversations", Icon: MessageSquare, label: "Conversaciones",   desc: "Historial de interacciones",  iconBg: "var(--warning-bg)", iconColor: "var(--warning)",     featured: false },
              { href: "/admin/analytics",     Icon: BarChart3,     label: "Métricas",         desc: "Estadísticas de uso",         iconBg: "var(--accent-soft)", iconColor: "var(--accent-ink)", featured: false },
            ].map(({ href, Icon, label, desc, iconBg, iconColor, featured }, i, arr) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "13px 18px",
                  textDecoration: "none",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--rule)" : "none",
                  background: featured ? "var(--brand-tint)" : "transparent",
                  transition: "background-color var(--dur-micro)",
                }}
                className="hover:bg-[var(--surface-2)]"
              >
                <div style={{
                  width: 34, height: 34, borderRadius: "var(--r-sm)", flexShrink: 0,
                  background: iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={16} style={{ color: iconColor }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: featured ? 600 : 500, color: "var(--ink)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{desc}</div>
                </div>
                <ChevronRight size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }} strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
          <Link href="/chat" style={{ fontSize: 12.5, color: "var(--ink-2)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
            className="hover:text-[var(--brand)] transition-colors">
            <MessageSquare size={13} /> Ir al chat
          </Link>
          <Link href="/" style={{ fontSize: 12.5, color: "var(--ink-2)", textDecoration: "none" }}
            className="hover:text-[var(--brand)] transition-colors">
            Página principal
          </Link>
        </div>
      </div>
    </div>
  );
}
