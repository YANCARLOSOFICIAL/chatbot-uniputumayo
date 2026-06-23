"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageCircle, Search, CheckCircle2, Clock, AlertTriangle, User } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
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
  if (diff < 60)   return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getConversations();
      setConversations(data as unknown as ConvItem[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = conversations.filter((c) =>
    !search || (c.title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Conversaciones"
        subtitle={loading ? "Cargando…" : `${conversations.length} conversación${conversations.length !== 1 ? "es" : ""} en total`}
        action={<button onClick={load} className="btn btn-secondary btn-sm">Actualizar</button>}
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 400, marginBottom: 20 }}>
          <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversación…"
            className="input"
            style={{ paddingLeft: 34, width: "100%", boxSizing: "border-box" }}
          />
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 0", gap: 10, color: "var(--text-3)" }}>
              <Spinner size="md" />
              Cargando conversaciones…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0" }}>
              <MessageCircle size={32} style={{ color: "var(--border)", margin: "0 auto 10px" }} />
              <div style={{ fontSize: 14, color: "var(--text-2)" }}>
                {search ? "Sin resultados para esa búsqueda." : "No hay conversaciones todavía."}
              </div>
            </div>
          ) : (
            <table className="admin-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Inicio</th>
                  <th>Última actividad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", background: "var(--brand-primary-lighter)",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <User size={13} style={{ color: "var(--brand-primary)" }} />
                        </div>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{c.title ?? "Sin título"}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                      {new Date(c.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} /> {timeAgo(c.updated_at)}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-suc" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={10} /> Activa
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Stats row */}
        {!loading && conversations.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            {[
              { label: "Total", value: conversations.length, icon: MessageCircle, color: "var(--brand-primary)" },
              { label: "Activas", value: conversations.length, icon: CheckCircle2, color: "var(--success)" },
              { label: "Escaladas", value: 0, icon: AlertTriangle, color: "var(--warning)" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card" style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
                <div style={{ width: 36, height: 36, borderRadius: "var(--r)", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text-1)", lineHeight: 1 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
