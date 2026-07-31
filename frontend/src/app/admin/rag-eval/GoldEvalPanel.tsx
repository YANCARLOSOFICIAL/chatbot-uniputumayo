"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Upload, Download, Clock, FileSpreadsheet } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { GoldEvalRunSummary, GoldEvalRunDetail } from "@/lib/api/client";
import { toast } from "@/components/ui/Toast";

function fmtMs(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function GoldEvalPanel() {
  const [runs, setRuns] = useState<GoldEvalRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<GoldEvalRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const data = await apiClient.getGoldEvalRuns();
      setRuns(data);
      return data;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando comparaciones");
      return [];
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const loadRunDetail = useCallback(async (runId: string) => {
    try {
      const detail = await apiClient.getGoldEvalRun(runId);
      setSelectedRun(detail);
      return detail;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando el detalle");
      return null;
    }
  }, []);

  useEffect(() => {
    loadRuns().then((data) => {
      if (data.length > 0) loadRunDetail(data[0].id);
    });
  }, [loadRuns, loadRunDetail]);

  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!selectedRun || selectedRun.status !== "running") return;

    pollRef.current = setInterval(async () => {
      const updated = await loadRunDetail(selectedRun.id);
      if (updated && updated.status !== "running") {
        loadRuns();
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 15000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedRun, loadRunDetail, loadRuns]);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setStarting(true);
    try {
      const run = await apiClient.startGoldEval(file);
      toast.success("Comparación iniciada — corre retrieval + generación real en Ollama y OpenAI para cada pregunta, puede tardar bastante.");
      await loadRuns();
      await loadRunDetail(run.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error iniciando la comparación");
    } finally {
      setStarting(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedRun) return;
    setDownloading(true);
    try {
      const text = await apiClient.downloadGoldEvalReport(selectedRun.id);
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `goldstandard-eval-${selectedRun.id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error descargando el reporte");
    } finally {
      setDownloading(false);
    }
  };

  const retrieval = selectedRun?.results?.retrieval;
  const generations = selectedRun?.results?.generations ?? [];

  return (
    <div className="rag-eval-layout" style={{ padding: "28px 32px 48px", flex: 1 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 520 }}>
            Sube el banco de preguntas <code>GoldStandard_Evaluacion_Chatbot.xlsx</code> (hoja &quot;Consultas&quot;) para comparar Ollama vs OpenAI: Precision@k, Recall@k, MRR y tasa de alucinación por proveedor.
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFilePicked}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={starting || selectedRun?.status === "running"}
              className="btn btn-primary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Upload size={12} className={starting ? "animate-pulse" : ""} />
              {selectedRun?.status === "running" ? "Corriendo…" : "Subir GoldStandard.xlsx"}
            </button>
            {selectedRun?.status === "completed" && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Download size={12} />
                Descargar reporte
              </button>
            )}
          </div>
        </div>

        {!selectedRun ? (
          <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>
            <FileSpreadsheet size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
            <div style={{ fontSize: 14 }}>
              {loadingRuns ? "Cargando…" : "Sin comparaciones todavía. Sube el archivo para la primera."}
            </div>
          </div>
        ) : (
          <>
            {selectedRun.status === "running" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", fontSize: 12.5, color: "var(--text-2)", marginBottom: 18 }}>
                <Clock size={13} style={{ color: "var(--brand-primary)" }} className="animate-pulse" />
                Ejecutando {selectedRun.total_queries || ""} consultas × retrieval + generación real en 2 proveedores. Puede tardar varios minutos (más aún en Ollama sin GPU). Esta vista se actualiza sola cada 15s.
              </div>
            )}

            {selectedRun.status === "failed" && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--error-dim)", border: "1px solid var(--danger)", fontSize: 12.5, color: "var(--danger)", marginBottom: 18 }}>
                La comparación falló: {selectedRun.error_message || "error desconocido"}
              </div>
            )}

            {retrieval && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 8px" }}>
                  Retrieval (independiente del proveedor de generación) — k={retrieval.k}, {retrieval.scored_cases} casos evaluados
                </div>
                <div className="admin-kpi-strip" style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", marginBottom: 22 }}>
                  {[
                    { label: `Precision@${retrieval.k}`, value: fmtPct(retrieval.mean_precision_at_k), color: "var(--brand-primary)" },
                    { label: `Recall@${retrieval.k}`, value: fmtPct(retrieval.mean_recall_at_k), color: "#8B5CF6" },
                    { label: "MRR", value: retrieval.mrr.toFixed(3), color: "var(--text-2)" },
                    { label: "Hit rate", value: fmtPct(retrieval.hit_rate), color: retrieval.hit_rate >= 0.8 ? "var(--success)" : retrieval.hit_rate < 0.5 ? "var(--danger)" : "var(--warning)" },
                  ].map((s) => (
                    <div key={s.label} className="admin-kpi-cell" style={{ padding: "20px 22px" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px,2vw,28px)", fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: "-0.03em" }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {generations.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-3)", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Proveedor</th>
                        <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--text-3)", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Modelo</th>
                        <th style={{ textAlign: "right", padding: "10px 16px", color: "var(--text-3)", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Alucinación</th>
                        <th style={{ textAlign: "right", padding: "10px 16px", color: "var(--text-3)", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rechazo seguro</th>
                        <th style={{ textAlign: "right", padding: "10px 16px", color: "var(--text-3)", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Latencia prom.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generations.map((g) => (
                        <tr key={g.provider} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-1)", textTransform: "capitalize" }}>{g.provider}</td>
                          <td style={{ padding: "12px 16px", color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{g.model}</td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <span className={`badge ${g.hallucination_rate === 0 ? "badge-suc" : g.hallucination_rate > 0.2 ? "badge-err" : "badge-warn"}`}>
                              {fmtPct(g.hallucination_rate)} ({g.judged_cases})
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            <span className={`badge ${g.safe_rejection_rate === 1 ? "badge-suc" : "badge-neut"}`}>
                              {fmtPct(g.safe_rejection_rate)} ({g.refusal_cases})
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>
                            {fmtMs(g.avg_generation_ms)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedRun.status === "running" && !retrieval && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Esperando el primer resultado…
              </div>
            )}
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
                    <span className="badge badge-suc" style={{ fontSize: 9 }}>listo</span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                  {run.status === "completed" ? `${run.total_queries} consultas · k=${run.k}` : run.status}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
