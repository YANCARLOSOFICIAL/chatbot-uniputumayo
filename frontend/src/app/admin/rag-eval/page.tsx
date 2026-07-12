"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FlaskConical, Play, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Database } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { RagEvalRunSummary, RagEvalRunDetail } from "@/lib/api/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { toast } from "@/components/ui/Toast";

function fmtMs(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function RagEvalPage() {
  const [runs, setRuns] = useState<RagEvalRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RagEvalRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [starting, setStarting] = useState(false);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const data = await apiClient.getRagEvalRuns();
      setRuns(data);
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando evaluaciones");
      return [];
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const loadRunDetail = useCallback(async (runId: string) => {
    try {
      const detail = await apiClient.getRagEvalRun(runId);
      setSelectedRun(detail);
      return detail;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando el detalle");
      return null;
    }
  }, []);

  // Initial load: run history + auto-select the most recent run
  useEffect(() => {
    loadRuns().then((data) => {
      if (data.length > 0) loadRunDetail(data[0].id);
    });
  }, [loadRuns, loadRunDetail]);

  // Poll while the selected run is still executing
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!selectedRun || selectedRun.status !== "running") return;

    pollRef.current = setInterval(async () => {
      const updated = await loadRunDetail(selectedRun.id);
      if (updated && updated.status !== "running") {
        loadRuns();
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 8000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedRun, loadRunDetail, loadRuns]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const run = await apiClient.startRagEval();
      toast.success("Evaluación iniciada — cada caso hace generación real del LLM, puede tardar varios minutos.");
      await loadRuns();
      await loadRunDetail(run.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error iniciando la evaluación");
    } finally {
      setStarting(false);
    }
  };

  const passRate = selectedRun?.total ? Math.round(((selectedRun.passed ?? 0) / selectedRun.total) * 100) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Evaluación RAG"
        subtitle="Precisión y recall medidos contra un set fijo de preguntas — no anecdótico."
        action={
          <button
            onClick={handleStart}
            disabled={starting || selectedRun?.status === "running"}
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Play size={12} className={starting || selectedRun?.status === "running" ? "animate-pulse" : ""} />
            {selectedRun?.status === "running" ? "Corriendo…" : "Ejecutar evaluación"}
          </button>
        }
      />

      <div className="rag-eval-layout" style={{ padding: "28px 32px 48px", flex: 1 }}>

        {/* Main column */}
        <div>
          {!selectedRun ? (
            <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
              <FlaskConical size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
              <div style={{ fontSize: 14 }}>
                {loadingRuns ? "Cargando…" : "Sin evaluaciones todavía. Ejecuta la primera."}
              </div>
            </div>
          ) : (
            <>
              {/* KPI strip */}
              <div className="admin-kpi-strip" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: 22 }}>
                {[
                  {
                    label: "Casos aprobados",
                    value: selectedRun.status === "running" ? "…" : `${selectedRun.passed ?? 0}/${selectedRun.total ?? 0}`,
                    color: passRate !== null && passRate === 100 ? "var(--success)" : passRate !== null && passRate < 50 ? "var(--danger)" : "var(--warning)",
                  },
                  {
                    label: "Tasa de aprobación",
                    value: passRate !== null ? `${passRate}%` : "—",
                    color: "var(--brand-primary)",
                  },
                  {
                    label: "Latencia retrieval prom.",
                    value: fmtMs(selectedRun.avg_retrieval_ms),
                    color: "#8B5CF6",
                  },
                  {
                    label: "Latencia generación prom.",
                    value: fmtMs(selectedRun.avg_generation_ms),
                    color: "var(--text-2)",
                  },
                ].map((s) => (
                  <div key={s.label} className="admin-kpi-cell" style={{ padding: "20px 22px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,2.2vw,30px)", fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: "-0.03em" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {selectedRun.status === "running" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", fontSize: 12.5, color: "var(--text-2)", marginBottom: 18 }}>
                  <Clock size={13} style={{ color: "var(--brand-primary)" }} className="animate-pulse" />
                  Ejecutando — cada caso corre retrieval + generación real del LLM. Esta vista se actualiza sola cada 8s.
                </div>
              )}

              {selectedRun.status === "failed" && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--error-dim)", border: "1px solid var(--danger)", fontSize: 12.5, color: "var(--danger)", marginBottom: 18 }}>
                  La evaluación falló: {selectedRun.error_message || "error desconocido"}
                </div>
              )}

              {/* Case results table */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {(selectedRun.results ?? []).map((r, i) => {
                  const isOpen = expandedCase === r.id;
                  return (
                    <div key={r.id} style={{ borderBottom: i < (selectedRun.results?.length ?? 0) - 1 ? "1px solid var(--border)" : "none" }}>
                      {/* Desktop: single row */}
                      <button
                        onClick={() => setExpandedCase(isOpen ? null : r.id)}
                        className="hidden md:flex"
                        style={{
                          width: "100%", alignItems: "center", gap: 12,
                          padding: "14px 18px", background: "none", border: "none", cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {r.passed
                          ? <CheckCircle2 size={16} style={{ color: "var(--success)", flexShrink: 0 }} />
                          : <XCircle size={16} style={{ color: "var(--danger)", flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.query}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                            {r.id}
                          </div>
                        </div>
                        <span className={`badge ${r.retrieval_quality === "good" ? "badge-suc" : "badge-neut"}`}>
                          {r.retrieval_quality} · {r.retrieval_top_score.toFixed(2)}
                        </span>
                        <span className="badge badge-neut" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Database size={9} /> {r.sources_cited}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", width: 54, textAlign: "right" }}>
                          {fmtMs(r.generation_ms)}
                        </span>
                        {isOpen ? <ChevronUp size={14} style={{ color: "var(--text-3)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-3)" }} />}
                      </button>

                      {/* Mobile: two-line card — query up top, badges wrap below */}
                      <button
                        onClick={() => setExpandedCase(isOpen ? null : r.id)}
                        className="md:hidden"
                        style={{
                          width: "100%", display: "flex", flexDirection: "column", gap: 8,
                          padding: "12px 16px", background: "none", border: "none", cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {r.passed
                            ? <CheckCircle2 size={15} style={{ color: "var(--success)", flexShrink: 0 }} />
                            : <XCircle size={15} style={{ color: "var(--danger)", flexShrink: 0 }} />
                          }
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.query}
                          </div>
                          {isOpen ? <ChevronUp size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, paddingLeft: 25 }}>
                          <span className={`badge ${r.retrieval_quality === "good" ? "badge-suc" : "badge-neut"}`}>
                            {r.retrieval_quality} · {r.retrieval_top_score.toFixed(2)}
                          </span>
                          <span className="badge badge-neut" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Database size={9} /> {r.sources_cited}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                            {fmtMs(r.generation_ms)}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div style={{ padding: "0 18px 16px 46px" }}>
                          {r.notes.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              {r.notes.map((n, ni) => (
                                <div key={ni} style={{ fontSize: 12, color: "var(--warning)", display: "flex", gap: 6, marginBottom: 3 }}>
                                  <span>⚠</span> {n}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55, background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px" }}>
                            {r.answer || <em style={{ color: "var(--text-3)" }}>(sin respuesta)</em>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {selectedRun.status === "running" && (selectedRun.results ?? []).length === 0 && (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                    Esperando el primer resultado…
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* History sidebar */}
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, margin: "0 0 12px", color: "var(--text-1)", letterSpacing: "-0.01em", textTransform: "uppercase" }}>
            Historial
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {runs.map((run) => {
              const isSelected = selectedRun?.id === run.id;
              const rate = run.total ? Math.round(((run.passed ?? 0) / run.total) * 100) : null;
              return (
                <button
                  key={run.id}
                  onClick={() => loadRunDetail(run.id)}
                  className="card"
                  style={{
                    padding: "10px 12px", textAlign: "left", cursor: "pointer",
                    border: isSelected ? "1.5px solid var(--brand-primary)" : "1px solid var(--border)",
                    background: isSelected ? "var(--brand-dim)" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-1)" }}>{fmtDate(run.created_at)}</span>
                    {run.status === "running" ? (
                      <span className="badge badge-warn" style={{ fontSize: 9 }}>corriendo</span>
                    ) : run.status === "failed" ? (
                      <span className="badge badge-err" style={{ fontSize: 9 }}>error</span>
                    ) : (
                      <span className={`badge ${rate === 100 ? "badge-suc" : "badge-neut"}`} style={{ fontSize: 9 }}>
                        {rate}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                    {run.status === "completed" ? `${run.passed}/${run.total} casos` : run.status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
