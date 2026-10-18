"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Upload, Eye, EyeOff, Search, X, HelpCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/Toast";
import { AdminHeader } from "@/components/admin/AdminHeader";
import type { FaqAdmin, FaqInput } from "@/types/chat";

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

      <div style={{ padding: "24px 32px 48px", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por pregunta o categoría..." className="input" style={{ flex: 1, boxSizing: "border-box" }} />
            {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex" }}><X size={13} /></button>}
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>Cargando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
              {entries.length === 0 ? "Aún no hay preguntas frecuentes. Cree una o importe el archivo scripts/faq_seed.json del backend." : "Sin coincidencias"}
            </div>
          ) : (
            filtered.map((e) => (
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
        </div>
      </div>
    </div>
  );
}
