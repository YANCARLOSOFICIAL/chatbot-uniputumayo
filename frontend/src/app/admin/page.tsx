"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FileText, Settings, Users, Activity,
  CheckCircle2, XCircle, Clock, MessageSquare,
  Upload, BarChart3, Download
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getUser } from "@/lib/auth";

interface HealthData {
  status: string;
  services: Record<string, { status: string; latency_ms?: number }>;
}

function AdminHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <header style={{
      padding: "20px 32px", borderBottom: "1px solid var(--border)",
      background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      flexShrink: 0,
    }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </header>
  );
}

function StatCard({ label, value, delta, color, icon: Icon }: {
  label: string; value: string; delta?: string; color?: string; icon: React.ElementType;
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--r)", background: (color ?? "var(--brand-primary)") + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={20} style={{ color: color ?? "var(--brand-primary)" }} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: color ?? "var(--text-1)", lineHeight: 1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: delta.startsWith("+") ? "var(--success)" : "var(--danger)" }}>
          {delta} vs. semana pasada
        </div>
      )}
    </div>
  );
}

const MOCK_DOCS = [
  { name: "Catálogo Académico 2026-1.pdf", type: "PDF", size: "4.2 MB", chunks: 312, status: "indexed", updated: "hoy" },
  { name: "PEI 2025 — Acuerdo 009.pdf",    type: "PDF", size: "1.8 MB", chunks: 156, status: "indexed", updated: "3d" },
  { name: "Resolución 0398.pdf",           type: "PDF", size: "420 KB", chunks: 28,  status: "indexed", updated: "5d" },
  { name: "Costos académicos 2026.xlsx",   type: "XLSX",size: "180 KB", chunks: 64,  status: "processing",updated: "12m" },
  { name: "Reglamento estudiantil.docx",   type: "DOCX",size: "720 KB", chunks: 92,  status: "indexed", updated: "1sem" },
];

const MOCK_CONVS = [
  { user: "Juliana M.", q: "¿Qué pregrados hay en Mocoa?",          when: "2 min", resolved: true,  msgs: 6 },
  { user: "Carlos A.", q: "Costos de Ingeniería Ambiental 2026",     when: "14 min",resolved: true,  msgs: 4 },
  { user: "Sofía P.",  q: "Requisitos de homologación",              when: "1 h",   resolved: false, msgs: 12, escalated: true },
  { user: "Daniel R.", q: "Especialización Gestión Ambiental — fechas",when: "3 h", resolved: true,  msgs: 5 },
  { user: "Anónimo",   q: "¿Hay clases nocturnas?",                  when: "5 h",   resolved: true,  msgs: 3 },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "indexed")    return <span className="badge badge-suc">● Indexado</span>;
  if (status === "processing") return <span className="badge badge-pri">● Procesando</span>;
  return <span className="badge badge-err">● Falló</span>;
}

export default function AdminPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [user, setUser]     = useState<{ display_name?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getUser());
    apiClient.checkHealth()
      .then(setHealth).catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Resumen"
        subtitle="Última semana · panel de control Nexus"
        actions={
          <>
            <button className="btn btn-secondary btn-sm"><Download size={13} /> Exportar</button>
            <Link href="/admin/documents" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}><Upload size={13} /> Subir documento</Link>
          </>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {/* Welcome */}
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
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "#fff" }}>{user?.display_name ?? "Administrador"}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Panel de control de Nexus · UniPutumayo</div>
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          <StatCard label="Conversaciones" value="2,418" delta="+12%"  icon={MessageSquare} color="var(--brand-primary)" />
          <StatCard label="Usuarios únicos" value="1,082"  delta="+8%"  icon={Users}         color="#8B5CF6" />
          <StatCard label="Tasa resolución"  value="92.4%" delta="+1.2%" icon={Activity}      color="var(--success)" />
          <StatCard label="Docs en RAG"      value="187"   delta="+6"   icon={FileText}      color="var(--warning)" />
        </div>

        {/* Two-col grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
          {/* Knowledge base */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>Base de conocimiento</h3>
              <Link href="/admin/documents" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>Ver todo</Link>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="admin-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Chunks</th>
                    <th>Estado</th>
                    <th>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_DOCS.map((d, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FileText size={14} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
                          <span style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{d.name}</span>
                        </div>
                      </td>
                      <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{d.chunks}</span></td>
                      <td><StatusBadge status={d.status} /></td>
                      <td style={{ color: "var(--text-3)", fontSize: 12 }}>{d.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent conversations */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>Conversaciones recientes</h3>
              <button className="btn btn-ghost btn-sm">Ver todas</button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {MOCK_CONVS.map((c, i) => (
                <div key={i} style={{ padding: "13px 18px", borderBottom: i < MOCK_CONVS.length - 1 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface-2)", color: "var(--text-1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {c.user.split(" ").map(s => s[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.user}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{c.when} · {c.msgs} msgs</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.q}</div>
                  </div>
                  {c.escalated
                    ? <span className="badge badge-warn">Escalado</span>
                    : c.resolved
                      ? <span className="badge badge-suc">Resuelto</span>
                      : <span className="badge badge-pri">Abierto</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Service status */}
        {health && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text-1)" }}>Estado del sistema</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(health.services).map(([name, svc]) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13 }}>
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

        {/* Navigation cards */}
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text-1)" }}>Módulos</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { href: "/admin/documents", icon: FileText,  title: "Documentos",      desc: "Gestionar base de conocimiento RAG.",    color: "var(--brand-primary)" },
              { href: "/admin/config",    icon: Settings,   title: "Configuración IA", desc: "Proveedores, modelos y API keys.",        color: "#8B5CF6" },
              { href: "/admin/users",     icon: Users,      title: "Usuarios",         desc: "Roles y permisos de acceso.",             color: "var(--success)" },
            ].map(({ href, icon: Icon, title, desc, color }) => (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div className="card card-interactive" style={{ padding: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "var(--r)", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick links */}
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
