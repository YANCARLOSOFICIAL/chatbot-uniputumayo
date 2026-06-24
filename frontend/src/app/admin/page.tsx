"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  FileText, Settings, Users, Activity,
  CheckCircle2, XCircle, Clock, MessageSquare,
  Upload, Download, BarChart3,
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


function StatCard({ label, value, color, icon: Icon }: {
  label: string; value: string | number; color?: string; icon: React.ElementType;
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "var(--r)",
          background: (color ?? "var(--brand-primary)") + "18",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={20} style={{ color: color ?? "var(--brand-primary)" }} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: color ?? "var(--text-1)", lineHeight: 1 }}>{value}</div>
    </div>
  );
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
            <button className="btn btn-secondary btn-sm" onClick={() => load()}>
              <Download size={13} /> Actualizar
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
          borderRadius: "var(--r-lg)", overflow: "hidden",
          background: "var(--brand-primary-darker)",
          marginBottom: 24, padding: "24px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative",
        }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/hero-fondo.png')", backgroundSize: "cover", backgroundPosition: "center", opacity: .12 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginBottom: 2 }}>{greeting},</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "#fff" }}>
              {user?.display_name ?? "Administrador"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginTop: 2 }}>
              Panel de control de Nexus · UniPutumayo
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1 }}>
            {loading ? (
              <div style={{ width: 80, height: 28, borderRadius: 6, background: "rgba(255,255,255,.1)" }} />
            ) : health ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(255,255,255,.1)", borderRadius: "var(--r-pill)", fontSize: 12, color: "#fff" }}>
                {health.status === "healthy"
                  ? <CheckCircle2 size={13} style={{ color: "#7BB52E" }} />
                  : <XCircle size={13} style={{ color: "#E5484D" }} />}
                Sistema {health.status === "healthy" ? "activo" : "con problemas"}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(255,255,255,.1)", borderRadius: "var(--r-pill)", fontSize: 12, color: "rgba(255,255,255,.6)" }}>
                <XCircle size={13} /> Sin conexión
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
          <StatCard label="Conversaciones" value={loading ? "…" : conversations.length > 0 ? `${conversations.length}+` : "0"} icon={MessageSquare} color="var(--brand-primary)" />
          <StatCard label="Usuarios"       value={loading ? "…" : userCount ?? "—"}    icon={Users}         color="#8B5CF6" />
          <StatCard label="Documentos RAG" value={loading ? "…" : documents.length > 0 ? `${documents.length}+` : "0"} icon={FileText} color="var(--warning)" />
          <StatCard label="Sistema"        value={loading ? "…" : health?.status === "healthy" ? "OK" : "—"} icon={Activity}  color="var(--success)" />
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
                      width: 34, height: 34, borderRadius: "50%",
                      background: "var(--surface-2)", color: "var(--text-1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      <MessageSquare size={14} style={{ color: "var(--brand-primary)" }} />
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

        {/* Service status */}
        {health && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text-1)" }}>
              Estado del sistema
            </h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(health.services).map(([name, svc]) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r)", fontSize: 13,
                }}>
                  {svc.status === "healthy"
                    ? <CheckCircle2 size={13} style={{ color: "var(--success)" }} />
                    : <XCircle size={13} style={{ color: "var(--danger)" }} />}
                  <span style={{ fontWeight: 500, color: "var(--text-1)", textTransform: "capitalize" }}>{name}</span>
                  {svc.latency_ms != null && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-3)" }}>
                      <Clock size={10} /> {svc.latency_ms}ms
                    </span>
                  )}
                </div>
              ))}
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
