"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, TrendingUp, TrendingDown, MessageSquare, Users, Activity, Clock, Minus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { toast } from "@/components/ui/Toast";

type Analytics = Awaited<ReturnType<typeof apiClient.getAnalytics>>;

function weekDelta(current: number, previous: number): { label: string; positive: boolean | null } {
  if (previous === 0 && current === 0) return { label: "Sin datos", positive: null };
  if (previous === 0) return { label: "Nueva actividad", positive: true };
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    label: pct >= 0 ? `+${pct}%` : `${pct}%`,
    positive: pct >= 0,
  };
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiClient.getAnalytics();
      setData(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando métricas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const convDelta = data ? weekDelta(data.this_week_conversations, data.last_week_conversations) : null;
  const maxBar = data ? Math.max(...data.conversations_per_day.map(d => d.count), 1) : 1;
  const weekTotal = data ? data.conversations_per_day.reduce((a, b) => a + b.count, 0) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Métricas"
        subtitle={loading ? "Cargando…" : "Datos en tiempo real de la base de datos"}
        action={
          <button onClick={load} disabled={loading} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            {loading ? <Spinner size="sm" /> : <BarChart3 size={13} />}
            Actualizar
          </button>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {loading && !data ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <Spinner size="lg" />
          </div>
        ) : !data ? null : (
          <>
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
              {[
                {
                  label: "Conversaciones",
                  value: data.total_conversations.toLocaleString("es-CO"),
                  delta: convDelta,
                  deltaNote: "vs. semana anterior",
                  icon: MessageSquare,
                  color: "var(--brand-primary)",
                },
                {
                  label: "Usuarios únicos",
                  value: data.unique_users.toLocaleString("es-CO"),
                  delta: null,
                  deltaNote: `${data.total_messages.toLocaleString("es-CO")} mensajes totales`,
                  icon: Users,
                  color: "#8B5CF6",
                },
                {
                  label: "Tasa resolución",
                  value: `${data.resolution_rate}%`,
                  delta: null,
                  deltaNote: "conversaciones con respuesta",
                  icon: Activity,
                  color: "var(--success)",
                },
                {
                  label: "Tiempo prom.",
                  value: data.avg_response_time_s != null ? `${data.avg_response_time_s} s` : "—",
                  delta: null,
                  deltaNote: "por mensaje del asistente",
                  icon: Clock,
                  color: "var(--warning)",
                },
              ].map(({ label, value, delta, deltaNote, icon: Icon, color }) => (
                <div key={label} className="card" style={{ padding: 20 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "var(--r)",
                    background: color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
                  }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, marginBottom: 6 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text-1)", lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    {delta ? (
                      <>
                        {delta.positive === null
                          ? <Minus size={11} style={{ color: "var(--text-3)" }} />
                          : delta.positive
                          ? <TrendingUp size={11} style={{ color: "var(--success)" }} />
                          : <TrendingDown size={11} style={{ color: "var(--danger)" }} />
                        }
                        <span style={{
                          fontWeight: 600,
                          color: delta.positive === null ? "var(--text-3)" : delta.positive ? "var(--success)" : "var(--danger)",
                        }}>
                          {delta.label}
                        </span>
                        <span style={{ color: "var(--text-3)" }}>{deltaNote}</span>
                      </>
                    ) : (
                      <span style={{ color: "var(--text-3)" }}>{deltaNote}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Two-col */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>

              {/* Bar chart — conversaciones por día */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>
                      Conversaciones por día
                    </h3>
                    <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                      {weekTotal} esta semana
                    </div>
                  </div>
                  {convDelta && convDelta.positive !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                      color: convDelta.positive ? "var(--success)" : "var(--danger)" }}>
                      {convDelta.positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {convDelta.label}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
                  {data.conversations_per_day.map((d) => {
                    const h = Math.round((d.count / maxBar) * 100);
                    const isMax = d.count === maxBar && d.count > 0;
                    return (
                      <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                          {isMax ? d.count : ""}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: d.count === 0 ? 4 : `${Math.max(h, 4)}px`,
                            background: isMax ? "var(--brand-primary)" : d.count === 0 ? "var(--border)" : "var(--brand-primary-light)",
                            borderRadius: "4px 4px 0 0",
                            transition: "height .3s ease",
                          }}
                          title={`${d.label}: ${d.count}`}
                        />
                        <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{d.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top queries */}
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "var(--text-1)" }}>
                  Consultas frecuentes
                </h3>

                {data.top_queries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-3)", fontSize: 13 }}>
                    Sin consultas todavía.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {data.top_queries.map((q, i) => {
                      const pct = Math.round((q.count / data.top_queries[0].count) * 100);
                      return (
                        <div key={i}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                              {q.label}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
                              {q.count}
                            </span>
                          </div>
                          <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 99 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "var(--brand-primary)", borderRadius: 99, transition: "width .4s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
