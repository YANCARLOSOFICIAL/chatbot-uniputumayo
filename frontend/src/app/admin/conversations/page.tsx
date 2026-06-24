"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageCircle, Search, CheckCircle2, Clock, User, RefreshCw, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/Toast";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface ConvItem {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "ahora";
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getConversations();
      setConversations(data as unknown as ConvItem[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando conversaciones");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = conversations.filter((c) =>
    !search || (c.title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const todayCount = conversations.filter((c) => {
    const d = new Date(c.created_at); const t = new Date(); t.setHours(0, 0, 0, 0); return d >= t;
  }).length;

  const weekCount = conversations.filter((c) => {
    const d = new Date(c.created_at); const w = new Date(); w.setDate(w.getDate() - 7); return d >= w;
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Conversaciones"
        subtitle={loading ? "Cargando..." : `${conversations.length} conversacion${conversations.length !== 1 ? "es" : ""} en total`}
        action={
          <button onClick={load} disabled={loading} className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {/* Editorial stats strip — moved above table, NOT 3 equal cards below */}
        <div style={{ display: "flex", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: 24 }}>
          {[
            { label: "Total",        value: loading ? "..." : conversations.length, color: "var(--brand-primary)" },
            { label: "Esta semana",  value: loading ? "..." : weekCount,            color: "#7BB52E" },
            { label: "Hoy",          value: loading ? "..." : todayCount,           color: "var(--success)" },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ flex: 1, padding: "22px 24px", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,3vw,38px)", fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 7, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 380, marginBottom: 16 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversacion..."
            className="input"
            style={{ paddingLeft: 34, width: "100%", boxSizing: "border-box" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex" }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "56px 0", display: "flex", justifyContent: "center", gap: 5 }}>
              {[0, 0.12, 0.24].map((d) => (
                <span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-primary)", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <MessageCircle size={22} style={{ color: "var(--text-3)" }} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>
                {search ? "Sin resultados" : "Sin conversaciones"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {search ? "Prueba con otro termino." : "Las conversaciones apareceran aqui."}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Titulo", "Inicio", "Ultima actividad", "Estado"].map((h) => (
                      <th key={h} style={{ padding: "10px 18px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id}
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <User size={13} style={{ color: "var(--brand-primary)" }} />
                          </div>
                          <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text-1)" }}>
                            {c.title ?? "Sin titulo"}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px", color: "var(--text-3)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                        {new Date(c.created_at).toLocaleDateString("es-CO")}
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: 12, color: "var(--text-3)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={10} /> {timeAgo(c.updated_at)}
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: "rgba(47,143,78,0.1)", color: "var(--success)", border: "1px solid rgba(47,143,78,0.2)" }}>
                          <CheckCircle2 size={9} /> Activa
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && search && (
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10, fontFamily: "var(--font-mono)" }}>
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para &quot;{search}&quot;
          </p>
        )}
      </div>
    </div>
  );
}
