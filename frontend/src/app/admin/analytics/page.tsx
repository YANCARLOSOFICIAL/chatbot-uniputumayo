"use client";

import { BarChart3, TrendingUp, MessageSquare, Users, Activity, Clock } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";

const WEEK_BARS = [42, 67, 55, 89, 103, 78, 61];
const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MAX_BAR = Math.max(...WEEK_BARS);

const TOP_QUERIES = [
  { label: "Requisitos de admisión 2026-1", count: 148 },
  { label: "Costos de matrícula", count: 112 },
  { label: "Programas en Mocoa", count: 97 },
  { label: "Pensum Ingeniería de Sistemas", count: 83 },
  { label: "Ingeniería Ambiental Sibundoy", count: 71 },
];

export default function AnalyticsPage() {
  const total = WEEK_BARS.reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Métricas"
        subtitle="Última semana · datos de muestra"
        action={<span className="badge badge-warn" style={{ alignSelf: "center" }}>Vista previa</span>}
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Conversaciones",  value: "495",   delta: "+18%",  icon: MessageSquare, color: "var(--brand-primary)" },
            { label: "Usuarios únicos",  value: "312",   delta: "+9%",   icon: Users,         color: "#8B5CF6" },
            { label: "Tasa resolución",  value: "91.6%", delta: "+0.8%", icon: Activity,      color: "var(--success)" },
            { label: "Tiempo prom.",     value: "1.4 s", delta: "−0.2s", icon: Clock,         color: "var(--warning)" },
          ].map(({ label, value, delta, icon: Icon, color }) => (
            <div key={label} className="card" style={{ padding: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--r)", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600, marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text-1)", lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: delta.startsWith("+") ? "var(--success)" : "var(--danger)" }}>
                {delta} vs. semana pasada
              </div>
            </div>
          ))}
        </div>

        {/* Two-col */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>

          {/* Bar chart */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>Conversaciones por día</h3>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{total} esta semana</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                <TrendingUp size={13} /> +18%
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
              {WEEK_BARS.map((v, i) => {
                const h = Math.round((v / MAX_BAR) * 100);
                const isMax = v === MAX_BAR;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{isMax ? v : ""}</div>
                    <div style={{
                      width: "100%", height: `${h}px`,
                      background: isMax ? "var(--brand-primary)" : "var(--brand-primary-light)",
                      borderRadius: "4px 4px 0 0",
                      transition: "height .3s ease",
                      position: "relative",
                    }} title={`${DAYS[i]}: ${v}`} />
                    <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{DAYS[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top queries */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "var(--text-1)" }}>Consultas frecuentes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {TOP_QUERIES.map((q, i) => {
                const pct = Math.round((q.count / TOP_QUERIES[0].count) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{q.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{q.count}</span>
                    </div>
                    <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--brand-primary)", borderRadius: 99, transition: "width .4s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notice */}
        <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--brand-primary-lighter)", border: "1px solid var(--brand-primary-light)", borderRadius: "var(--r)", fontSize: 13, color: "var(--text-2)" }}>
          <BarChart3 size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle", color: "var(--brand-primary)" }} />
          Los datos mostrados son de demostración. La integración con métricas en tiempo real estará disponible próximamente.
        </div>
      </div>
    </div>
  );
}
