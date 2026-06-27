"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, TrendingUp, TrendingDown, MessageSquare, Users, Activity, Clock, Minus, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { toast } from "@/components/ui/Toast";
import { LoadingDots } from "@/components/ui/LoadingDots";

type Analytics = Awaited<ReturnType<typeof apiClient.getAnalytics>>;

function weekDelta(current: number, previous: number): { label: string; positive: boolean | null } {
  if (previous === 0 && current === 0) return { label: "Sin datos", positive: null };
  if (previous === 0) return { label: "Nueva actividad", positive: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { label: pct >= 0 ? `+${pct}%` : `${pct}%`, positive: pct >= 0 };
}

export default function AnalyticsPage() {
  const [data, setData]       = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.getAnalytics();
      setData(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando metricas");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const convDelta = data ? weekDelta(data.this_week_conversations, data.last_week_conversations) : null;
  const maxBar    = data ? Math.max(...data.conversations_per_day.map((d) => d.count), 1) : 1;
  const weekTotal = data ? data.conversations_per_day.reduce((a, b) => a + b.count, 0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Metricas"
        subtitle={loading ? "Cargando..." : "Datos en tiempo real de la base de datos"}
        action={
          <button onClick={load} disabled={loading} className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <BarChart3 size={12} /> Actualizar
          </button>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {loading && !data ? (
          <div style={{ padding: "72px 0", display: "flex", justifyContent: "center", gap: 6 }}>
            <LoadingDots size={6} />
          </div>
        ) : !data ? null : (
          <>
            {/* KPI strip — editorial numbers NOT equal icon cards */}
            <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: 28 }}>
              {[
                {
                  label: "Conversaciones",
                  value: data.total_conversations.toLocaleString("es-CO"),
                  note: convDelta ? convDelta.label : null,
                  positive: convDelta ? convDelta.positive : null,
                  color: "var(--brand-primary)",
                },
                {
                  label: "Usuarios unicos",
                  value: data.unique_users.toLocaleString("es-CO"),
                  note: `${data.total_messages.toLocaleString("es-CO")} msgs`,
                  positive: null,
                  color: "#8B5CF6",
                },
                {
                  label: "Tasa resolucion",
                  value: `${data.resolution_rate}%`,
                  note: "con respuesta",
                  positive: null,
                  color: "var(--success)",
                },
                {
                  label: "Tiempo prom.",
                  value: data.avg_response_time_s != null ? `${data.avg_response_time_s}s` : "—",
                  note: "por mensaje",
                  positive: null,
                  color: "var(--warning)",
                },
              ].map((s, i, arr) => (
                <div key={s.label} style={{ flex: 1, padding: "22px 24px", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,2.5vw,36px)", fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: "-0.04em" }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 7, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {s.label}
                  </div>
                  {s.note && (
                    <div style={{ fontSize: 11, marginTop: 4, color: s.positive === null ? "var(--text-3)" : s.positive ? "var(--success)" : "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                      {s.positive !== null && (s.positive
                        ? <TrendingUp size={10} />
                        : s.positive === false ? <TrendingDown size={10} /> : <Minus size={10} />
                      )}
                      {s.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Two-col: bar chart + top queries */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 22 }}>

              {/* Bar chart */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, margin: "0 0 2px", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                      Conversaciones por dia
                    </h3>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--brand-primary)" }}>{weekTotal}</span> esta semana
                    </div>
                  </div>
                  {convDelta && convDelta.positive !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: convDelta.positive ? "var(--success)" : "var(--danger)", padding: "4px 10px", borderRadius: 8, background: convDelta.positive ? "var(--success-bg)" : "var(--error-dim)" }}>
                      {convDelta.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {convDelta.label}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 130 }}>
                  {data.conversations_per_day.map((d) => {
                    const h  = Math.round((d.count / maxBar) * 100);
                    const isMax = d.count === maxBar && d.count > 0;
                    return (
                      <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 9, color: isMax ? "var(--brand-primary)" : "transparent", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                          {d.count}
                        </div>
                        <div style={{
                          width: "100%", borderRadius: "5px 5px 0 0",
                          height: d.count === 0 ? 4 : `${Math.max(h, 4)}px`,
                          background: isMax ? "var(--brand-primary)" : d.count === 0 ? "var(--border)" : "var(--brand-primary-light,rgba(27,110,148,0.35))",
                          transition: "height .35s cubic-bezier(0.16,1,0.3,1)",
                        }} title={`${d.label}: ${d.count}`} />
                        <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{d.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top queries */}
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, margin: "0 0 18px", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                  Consultas frecuentes
                </h3>

                {data.top_queries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-3)", fontSize: 13 }}>
                    Sin consultas todavia.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {data.top_queries.map((q, i) => {
                      const pct = Math.round((q.count / data.top_queries[0].count) * 100);
                      return (
                        <div key={i}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                              {q.label}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", fontWeight: 700, flexShrink: 0 }}>
                              {q.count}
                            </span>
                          </div>
                          <div style={{ height: 3, background: "var(--surface-2)", borderRadius: 99 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "var(--brand-primary)", borderRadius: 99, transition: "width .4s cubic-bezier(0.16,1,0.3,1)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* KPI pills row at bottom */}
                <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                  {[
                    { label: "Mensajes", value: data.total_messages, icon: MessageSquare },
                    { label: "Usuarios", value: data.unique_users, icon: Users },
                    { label: "Promedio/conv", value: data.unique_users > 0 ? Math.round(data.total_messages / Math.max(data.unique_users,1)) : 0, icon: Activity },
                    { label: "Tiempo s.", value: data.avg_response_time_s ?? "—", icon: Clock },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 11, color: "var(--text-2)" }}>
                      <Icon size={10} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-1)" }}>{value}</span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
