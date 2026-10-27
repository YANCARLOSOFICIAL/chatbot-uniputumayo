"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Upload, Eye, EyeOff, Search, X, HelpCircle, AlertTriangle, CheckCircle2, FlaskConical, ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/Toast";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Select } from "@/components/ui/Select";
import type { FaqAdmin, FaqInput, FaqMatchTest } from "@/types/chat";

/* ── "Probar coincidencia": dry run of what the chat would do ── */
function MatchTester() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<FaqMatchTest | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setBusy(true);
    try { setResult(await apiClient.testFaqMatch(q.trim())); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Error probando la pregunta"); }
    finally { setBusy(false); }
  };

  const decisionLabel = result
    ? result.decision === "hit" ? "Respondería con la FAQ (sin usar el modelo)"
    : result.decision === "suggestion" ? "Flujo normal + sugerencia «¿Te refieres a…?»"
    : "Flujo normal (RAG), sin FAQ"
    : "";
  const decisionColor = result?.decision === "hit" ? "var(--success)" : result?.decision === "suggestion" ? "var(--warning)" : "var(--text-3)";

  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <FlaskConical size={13} style={{ color: "var(--brand-primary)" }} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Probar coincidencia</span>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>— escriba una pregunta como la haría un estudiante y vea qué haría el chat (no cuenta como respuesta)</span>
      </div>
      <form onSubmit={run} style={{ display: "flex", gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="cuánto vale inscribirme?" style={{ flex: 1, boxSizing: "border-box" }} />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || q.trim().length < 3}>{busy ? "Probando..." : "Probar"}</button>
      </form>
      {result && (
        <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {!result.embedding_ok ? (
            <div style={{ color: "var(--danger)" }}>No se pudo calcular el embedding (Ollama no disponible): el chat tampoco consultaría la FAQ.</div>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: decisionColor }}>
                {decisionLabel}
                {result.matched_question && <span style={{ fontWeight: 400, color: "var(--text-2)" }}> · «{result.matched_question}» ({result.similarity})</span>}
              </div>
              {result.candidates.length === 0 ? (
                <div style={{ color: "var(--text-3)" }}>No hay preguntas frecuentes indexadas.</div>
              ) : (
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr style={{ color: "var(--text-3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <th style={{ textAlign: "left", padding: "4px 6px" }}>Candidata</th>
                      <th style={{ textAlign: "right", padding: "4px 6px" }}>Similitud</th>
                      <th style={{ textAlign: "center", padding: "4px 6px" }}>Guardas</th>
                      <th style={{ textAlign: "center", padding: "4px 6px" }}>Léxica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((c) => (
                      <tr key={c.id} style={{ borderTop: "1px solid var(--border)", background: c.id === result.matched_id ? "var(--brand-dim)" : "transparent" }}>
                        <td style={{ padding: "5px 6px", color: "var(--text-1)" }}>{c.question}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", color: c.similarity >= result.thresholds.hit ? "var(--success)" : c.similarity >= result.thresholds.judge ? "var(--warning)" : "var(--text-3)" }}>{c.similarity.toFixed(3)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "center" }}>{c.guards_pass ? "✓" : "✗"}</td>
                        <td style={{ padding: "5px 6px", textAlign: "center" }}>{c.lexical_subset ? "✓" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ color: "var(--text-3)" }}>
                Umbrales: responde ≥ {result.thresholds.hit} · confirma entre {result.thresholds.judge} y {result.thresholds.hit} (léxica o juez) · sugiere ≥ {result.thresholds.suggest}
                {result.judge_used && <> · juez consultado: {result.judge_error ? `error (${result.judge_error})` : result.judge_choice ? `eligió la candidata ${result.judge_choice}` : "ninguna"}</>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;

const EMPTY: FaqInput = {
  question: "", answer: "", category: "", source_document: "", valid_period: "",
  program: "", faculty: "", is_enabled: true, sort_order: 0,
};

function toInput(e: FaqAdmin): FaqInput {
  return {
    question: e.question, answer: e.answer, category: e.category ?? "",
    source_document: e.source_document ?? "", valid_period: e.valid_period ?? "",
    program: e.program ?? "", faculty: e.faculty ?? "", is_enabled: e.is_enabled, sort_order: e.sort_order,
  };
}

function clean(v: FaqInput): FaqInput {
  const opt = (s?: string | null) => (s && s.trim() ? s.trim() : null);
  return {
    question: v.question.trim(), answer: v.answer.trim(),
    category: opt(v.category), source_document: opt(v.source_document), valid_period: opt(v.valid_period),
    program: opt(v.program), faculty: opt(v.faculty),
    is_enabled: v.is_enabled ?? true, sort_order: Number(v.sort_order ?? 0) || 0,
  };
}

const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 4 };
const labelStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "var(--text-3)" };

function FaqForm({ initial, onSave, onCancel, saving }: {
  initial: FaqInput; onSave: (v: FaqInput) => Promise<void>; onCancel: () => void; saving: boolean;
}) {
  // The parent remounts this form via `key` when the edited entry changes,
  // so the initial value never needs syncing after mount.
  const [v, setV] = useState<FaqInput>(initial);
  const set = (k: keyof FaqInput, val: string | number | boolean) => setV((p) => ({ ...p, [k]: val }));
  const valid = v.question.trim().length >= 5 && v.answer.trim().length >= 5;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) onSave(clean(v)); }}
      className="card"
      style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle}>Pregunta *</label>
        <input value={v.question} onChange={(e) => set("question", e.target.value)} className="input" maxLength={500}
          placeholder="¿Cuánto cuesta la inscripción?" style={{ boxSizing: "border-box" }} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Respuesta oficial * <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(admite Markdown: **negrita**, listas, enlaces)</span></label>
        <textarea value={v.answer} onChange={(e) => set("answer", e.target.value)} className="input" rows={6} maxLength={8000}
          placeholder="El derecho de inscripción para 2026-II cuesta $88.000..." style={{ boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Categoría</label>
          <input value={v.category ?? ""} onChange={(e) => set("category", e.target.value)} className="input" placeholder="Costos" style={{ boxSizing: "border-box" }} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Documento fuente</label>
          <input value={v.source_document ?? ""} onChange={(e) => set("source_document", e.target.value)} className="input" placeholder="Tríptico oferta académica 2026-2" style={{ boxSizing: "border-box" }} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Vigencia</label>
          <input value={v.valid_period ?? ""} onChange={(e) => set("valid_period", e.target.value)} className="input" placeholder="2026-II" style={{ boxSizing: "border-box" }} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Orden</label>
          <input type="number" min={0} max={10000} value={v.sort_order ?? 0} onChange={(e) => set("sort_order", Number(e.target.value))} className="input" style={{ boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Programa (opcional, restringe la respuesta)</label>
          <input value={v.program ?? ""} onChange={(e) => set("program", e.target.value)} className="input" placeholder="ingenieria de sistemas" style={{ boxSizing: "border-box" }} />
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Si se indica, solo responde cuando el usuario nombra ese programa.</span>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Facultad (opcional)</label>
          <input value={v.faculty ?? ""} onChange={(e) => set("faculty", e.target.value)} className="input" style={{ boxSizing: "border-box" }} />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-1)", cursor: "pointer" }}>
        <input type="checkbox" checked={v.is_enabled ?? true} onChange={(e) => set("is_enabled", e.target.checked)} />
        Publicada (visible en la página de preguntas frecuentes y usada por el chat)
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm" disabled={saving}>Cancelar</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!valid || saving}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

export default function FaqAdminPage() {
  const [entries, setEntries] = useState<FaqAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [editing, setEditing] = useState<FaqAdmin | null>(null);
  const [query, setQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await apiClient.getFaqAdmin()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error cargando preguntas frecuentes"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.question.toLowerCase().includes(q) || (e.category ?? "").toLowerCase().includes(q)) : entries;
  }, [entries, query]);

  // Client-side pagination (the admin list is one small request). Search
  // resets to page 1; the page is clamped when entries are deleted.
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
    [filtered, safePage, perPage],
  );
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const rangeEnd = Math.min(safePage * perPage, filtered.length);

  const notIndexed = entries.filter((e) => !e.indexed).length;
  const totalHits = entries.reduce((a, e) => a + e.hit_count, 0);

  const handleSave = async (v: FaqInput) => {
    setSaving(true);
    try {
      if (mode === "edit" && editing) {
        const updated = await apiClient.updateFaq(editing.id, v);
        setEntries((p) => p.map((e) => (e.id === updated.id ? updated : e)));
        toast.success("Pregunta actualizada");
      } else {
        const created = await apiClient.createFaq(v);
        setEntries((p) => [...p, created]);
        toast.success(created.indexed ? "Pregunta creada" : "Creada, pero sin índice: use Reindexar cuando Ollama esté disponible");
      }
      setMode("idle"); setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando");
    } finally { setSaving(false); }
  };

  const handleToggle = async (entry: FaqAdmin) => {
    try {
      const updated = await apiClient.updateFaq(entry.id, { is_enabled: !entry.is_enabled });
      setEntries((p) => p.map((e) => (e.id === updated.id ? updated : e)));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); return;
    }
    setConfirmDeleteId(null);
    try {
      await apiClient.deleteFaq(id);
      setEntries((p) => p.filter((e) => e.id !== id));
      toast.success("Pregunta eliminada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error eliminando"); }
  };

  const handleReindex = async (id?: string) => {
    try {
      const r = await apiClient.reindexFaq(id);
      toast[r.failed ? "error" : "success"](`Indexadas: ${r.indexed} · fallidas: ${r.failed}`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error reindexando"); }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { entries?: FaqInput[]; skip_duplicates?: boolean } | FaqInput[];
      const list = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!list || !Array.isArray(list) || list.length === 0) throw new Error("El archivo no contiene una lista 'entries'");
      const skip = Array.isArray(parsed) ? true : parsed.skip_duplicates ?? true;
      const r = await apiClient.importFaq(list.map(clean), skip);
      toast.success(`Importadas: ${r.created} · omitidas (duplicadas): ${r.skipped}${r.not_indexed ? ` · sin índice: ${r.not_indexed}` : ""}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archivo inválido");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Preguntas frecuentes"
        subtitle="Respuestas oficiales que el chat sirve sin llamar al modelo cuando la pregunta del usuario coincide"
        action={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
            <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }} title="Importar un JSON con {entries: [...]}">
              <Upload size={12} /> Importar JSON
            </button>
            <button onClick={() => handleReindex()} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }} title="Recalcular los embeddings de todas las preguntas">
              <RefreshCw size={12} /> Reindexar todo
            </button>
            <button onClick={() => { setEditing(null); setMode("create"); }} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Plus size={12} /> Nueva pregunta
            </button>
          </div>
        }
      />

      <div className="admin-content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Summary strip */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Publicadas", value: entries.filter((e) => e.is_enabled).length, icon: Eye },
            { label: "Total", value: entries.length, icon: HelpCircle },
            { label: "Respuestas servidas", value: totalHits, icon: CheckCircle2 },
            { label: "Sin índice", value: notIndexed, icon: AlertTriangle, warn: notIndexed > 0 },
          ].map(({ label, value, icon: Icon, warn }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 11, color: warn ? "var(--danger)" : "var(--text-2)" }}>
              <Icon size={10} style={{ color: warn ? "var(--danger)" : "var(--brand-primary)" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: warn ? "var(--danger)" : "var(--text-1)" }}>{value}</span> {label}
            </div>
          ))}
        </div>

        <MatchTester />

        {mode !== "idle" && (
          <FaqForm
            key={mode === "edit" && editing ? editing.id : "new"}
            initial={mode === "edit" && editing ? toInput(editing) : EMPTY}
            onSave={handleSave}
            onCancel={() => { setMode("idle"); setEditing(null); }}
            saving={saving}
          />
        )}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={13} style={{ color: "var(--text-3)" }} />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar por pregunta o categoría..." className="input" style={{ flex: 1, boxSizing: "border-box" }} />
            {query && <button onClick={() => { setQuery(""); setPage(1); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex" }}><X size={13} /></button>}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>Cargando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
              {entries.length === 0 ? "Aún no hay preguntas frecuentes. Cree una o importe el archivo scripts/faq_seed.json del backend." : "Sin coincidencias"}
            </div>
          ) : (
            pageItems.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)", opacity: e.is_enabled ? 1 : 0.6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.35 }}>{e.question}</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.answer}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, fontSize: 10.5, color: "var(--text-3)" }}>
                    {e.category && <span>{e.category}</span>}
                    {e.source_document && <span>Fuente: {e.source_document}</span>}
                    {e.valid_period && <span>Vigencia: {e.valid_period}</span>}
                    {e.program && <span>Programa: {e.program}</span>}
                    <span style={{ fontFamily: "var(--font-mono)" }}>{e.hit_count} respuestas</span>
                    {!e.indexed && (
                      <span style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 3 }}>
                        <AlertTriangle size={10} /> sin índice (no responde en el chat)
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {!e.indexed && (
                    <button onClick={() => handleReindex(e.id)} title="Reindexar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--warning)", display: "flex", padding: 4 }}>
                      <RefreshCw size={13} />
                    </button>
                  )}
                  <button onClick={() => handleToggle(e)} title={e.is_enabled ? "Despublicar" : "Publicar"} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}>
                    {e.is_enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button onClick={() => { setEditing(e); setMode("edit"); window.scrollTo({ top: 0, behavior: "smooth" }); }} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(e.id)} title={confirmDeleteId === e.id ? "¿Confirmar?" : "Eliminar"} style={{ background: "none", border: "none", cursor: "pointer", color: confirmDeleteId === e.id ? "var(--danger)" : "var(--text-3)", display: "flex", padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  Mostrando <strong style={{ color: "var(--text-2)", fontWeight: 600 }}>{rangeStart}–{rangeEnd}</strong> de {filtered.length}
                </span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)" }}>
                  Por página
                  <Select
                    value={String(perPage)}
                    onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}
                    options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                    triggerStyle={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}
                  className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <ChevronLeft size={13} /> Anterior
                </button>
                <span style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{safePage} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                  className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Siguiente <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
