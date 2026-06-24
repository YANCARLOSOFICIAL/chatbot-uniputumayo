"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Settings, Users,
  CheckCircle2, XCircle, Clock, MessageSquare,
  Upload, RefreshCw, BarChart3,
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
        subtitle="Panel de control · Nexus UniPutumayo"
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

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {/* Welcome banner */}
        <div style={{
          borderRadius: 16, overflow: "hidden",
          background: "#0B3447",
          marginBottom: 24, padding: "28px 32px",
          display: "grid", gridTemplateColumns: "1fr auto",
          alignItems: "center", gap: 20,
          position: "relative", minHeight: 120,
        }}>
          {/* Background image */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/estudiantes.jpg')", backgroundSize: "cover", backgroundPosition: "center top", opacity: 0.09 }} />
          {/* Gradient overlay left-to-right */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(11,52,71,0.95) 55%, rgba(11,52,71,0.6) 100%)" }} />

          {/* Left: greeting */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 10,
              padding: "3px 10px", borderRadius: 9999,
              border: "1px solid rgba(123,181,46,0.3)",
              background: "rgba(123,181,46,0.08)",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
              textTransform: "uppercase", color: "#7BB52E",
              fontFamily: "var(--font-mono)",
            }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#7BB52E", display: "inline-block", animation: "pulse-soft 2s ease-in-out infinite" }} />
              Panel de control
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,2.2vw,28px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              {greeting}, {user?.display_name ?? "Administrador"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
              Nexus · UniPutumayo — Sistema RAG institucional
            </div>
          </div>

          {/* Right: system status pill */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {loading ? (
              <div style={{ width: 90, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.08)", animation: "shimmer 1.5s ease-in-out infinite" }} />
            ) : health ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", fontSize: 13, color: "#fff", fontWeight: 500 }}>
                {health.status === "healthy"
                  ? <CheckCircle2 size={14} style={{ color: "#7BB52E" }} />
                  : <XCircle size={14} style={{ color: "#E5484D" }} />}
                Sistema {health.status === "healthy" ? "activo" : "con problemas"}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(255,255,255,0.06)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                <XCircle size={14} /> Sin conexion
              </div>
            )}
          </div>
        </div>

        {/* Editorial number strip — NOT 4 equal icon cards */}
        <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: 24 }}>
          {[
            { label: "Conversaciones", value: loading ? "..." : conversations.length > 0 ? `${conversations.length}+` : "0", color: "var(--brand-primary)" },
            { label: "Usuarios",       value: loading ? "..." : userCount ?? "—",                                            color: "#8B5CF6" },
            { label: "Documentos RAG", value: loading ? "..." : documents.length > 0 ? `${documents.length}+` : "0",        color: "var(--warning)" },
            { label: "Sistema",        value: loading ? "..." : health?.status === "healthy" ? "OK" : "—",                   color: health?.status === "healthy" ? "var(--success)" : "var(--error)" },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, padding: "22px 20px", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,3vw,40px)", fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Two-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Knowledge base — real data */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
                Base de conocimiento
              </h3>
              <Link href="/admin/documents" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>Ver todo</Link>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div className="shimmer" style={{ height: 14, borderRadius: 6, width: "60%", margin: "0 auto" }} />
                </div>
              ) : documents.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
                  Sin documentos. <Link href="/admin/documents" style={{ color: "var(--brand-primary)" }}>Sube el primero →</Link>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="admin-table" style={{ width: "100%" }}>
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
                              <FileText size={14} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
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

          {/* Recent conversations — real data */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
                Conversaciones recientes
              </h3>
              <Link href="/admin/conversations" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>Ver todas</Link>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <div className="shimmer" style={{ height: 14, borderRadius: 6, width: "60%", margin: "0 auto" }} />
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
                  Sin conversaciones aún.
                </div>
              ) : (
                conversations.map((c, i) => (
                  <div key={c.id} style={{
                    padding: "13px 18px",
                    borderBottom: i < conversations.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: "var(--brand-dim)",
                      border: "1px solid var(--brand-light)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <MessageSquare size={13} style={{ color: "var(--brand-primary)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.title ?? "Sin título"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
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

        {/* Service status — horizontal editorial bar */}
        {health && Object.keys(health.services).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 18px", borderBottom: "1px solid var(--border)" }}>
                <BarChart3 size={13} style={{ color: "var(--brand-primary)" }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Estado del sistema</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: health.status === "healthy" ? "var(--success)" : "var(--error)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
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
                      borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background 0.1s",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: ok ? "var(--success)" : "var(--error)", boxShadow: ok ? "0 0 5px var(--success)" : "0 0 5px var(--error)", flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)", textTransform: "capitalize" }}>{name}</span>
                      {svc.latency_ms != null && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
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

        {/* Module nav — editorial list, not equal-card grid */}
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 10px", color: "var(--text-1)" }}>
            Modulos
          </h3>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {[
              { href: "/admin/documents",     Icon: FileText,      label: "Documentos",      desc: "Base de conocimiento RAG",    color: "var(--brand-primary)", featured: true },
              { href: "/admin/config",        Icon: Settings,      label: "Configuracion IA", desc: "Proveedores, modelos, API",   color: "#8B5CF6",              featured: false },
              { href: "/admin/users",         Icon: Users,         label: "Usuarios",          desc: "Roles y permisos",            color: "var(--success)",       featured: false },
              { href: "/admin/conversations", Icon: MessageSquare, label: "Conversaciones",    desc: "Historial de interacciones",  color: "var(--warning)",       featured: false },
              { href: "/admin/analytics",     Icon: BarChart3,     label: "Metricas",          desc: "Estadisticas de uso",         color: "var(--brand-primary)", featured: false },
            ].map(({ href, Icon, label, desc, color, featured }, i, arr) => (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "13px 18px",
                  textDecoration: "none",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.12s",
                  background: featured ? "var(--brand-dim)" : "transparent",
                }}
                className="hover:bg-[var(--surface-3)]"
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: color + "14",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: featured ? 700 : 500, color: "var(--text-1)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.75">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
          <Link href="/chat" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
            className="hover:text-[var(--brand-primary)] transition-colors">
            <MessageSquare size={13} /> Ir al chat
          </Link>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}
            className="hover:text-[var(--brand-primary)] transition-colors">
            Página principal
          </Link>
        </div>
      </div>
    </div>
  );
}
