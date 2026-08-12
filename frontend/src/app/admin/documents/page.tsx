"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, FileText, AlertCircle, Trash2, X, ArrowUp, RefreshCw, Pencil, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/Toast";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Select } from "@/components/ui/Select";

interface DocumentItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  faculty: string | null;
  program: string | null;
  document_type: string | null;
  ingestion_status: string;
  total_chunks: number;
  created_at: string;
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  completed:  { label: "Indexado",   bg: "var(--success-bg)",      color: "var(--success)",       border: "rgba(47,143,78,0.2)"   },
  processing: { label: "Procesando", bg: "var(--brand-dim)",      color: "var(--brand-primary)", border: "var(--brand-light)"   },
  failed:     { label: "Error",       bg: "var(--error-dim)",      color: "var(--error)",         border: "rgba(200,54,44,0.2)"  },
  pending:    { label: "Pendiente",   bg: "var(--surface-2)",      color: "var(--text-3)",        border: "var(--border)"        },
};

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

// Taxonomy cell — a muted tag when the field is set, an unobtrusive dash
// when it isn't. Un-tagged fields are exactly the gap admins need to spot at
// a glance (see ChatService._detect_ambiguity: the disambiguation feature
// silently does nothing for documents missing this metadata), so this must
// stay visually distinct from "has a value" rather than just rendering "".
function TaxonomyTag({ value }: { value: string | null }) {
  if (!value) {
    return <span style={{ color: "var(--text-3)", fontSize: 12 }} title="Sin asignar">—</span>;
  }
  return (
    <span style={{
      display: "inline-block", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
      background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)",
    }} title={value}>
      {value}
    </span>
  );
}

function DocRowActions({ doc, reindexingId, confirmDeleteId, onReindex, onDelete, onEdit }: {
  doc: DocumentItem;
  reindexingId: string | null;
  confirmDeleteId: string | null;
  onReindex: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onEdit: (doc: DocumentItem) => void;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <button
        onClick={() => onEdit(doc)}
        title="Editar facultad, programa y tipo"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
          padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
          background: "transparent", color: "var(--text-3)", transition: "all 0.1s",
        }}
        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--brand-dim)"; b.style.color = "var(--brand-primary)"; }}
        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--text-3)"; }}
      >
        <Pencil size={11} />
        Editar
      </button>
      <button
        onClick={() => onReindex(doc.id, doc.title)}
        disabled={reindexingId === doc.id || doc.ingestion_status === "processing"}
        title="Reprocesar y regenerar embeddings"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
          padding: "3px 8px", borderRadius: 6, border: "none",
          cursor: reindexingId === doc.id || doc.ingestion_status === "processing" ? "not-allowed" : "pointer",
          background: "transparent", color: "var(--text-3)",
          opacity: reindexingId === doc.id || doc.ingestion_status === "processing" ? 0.5 : 1,
          transition: "all 0.1s",
        }}
        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--brand-dim)"; b.style.color = "var(--brand-primary)"; }}
        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--text-3)"; }}
      >
        <RefreshCw size={11} className={reindexingId === doc.id ? "animate-spin" : ""} />
        Reindexar
      </button>
      <button
        onClick={() => onDelete(doc.id)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
          padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
          background: confirmDeleteId === doc.id ? "var(--error-dim)" : "transparent",
          color: confirmDeleteId === doc.id ? "var(--error)" : "var(--text-3)",
          transition: "all 0.1s",
        }}
        onMouseEnter={(e) => { if (confirmDeleteId !== doc.id) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--error-dim)"; b.style.color = "var(--error)"; } }}
        onMouseLeave={(e) => { if (confirmDeleteId !== doc.id) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--text-3)"; } }}
      >
        <Trash2 size={11} />
        {confirmDeleteId === doc.id ? "Confirmar?" : "Eliminar"}
      </button>
    </div>
  );
}

interface TaxonomyItem {
  id: string;
  name: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

export default function DocumentsPage() {
  const [documents, setDocuments]       = useState<DocumentItem[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [page, setPage]                 = useState(1);
  const [perPage, setPerPage]           = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading]           = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [editingDoc, setEditingDoc]     = useState<DocumentItem | null>(null);
  const [editFaculty, setEditFaculty]   = useState("");
  const [editProgram, setEditProgram]   = useState("");
  const [editDocType, setEditDocType]   = useState("");
  const [savingEdit, setSavingEdit]     = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [file, setFile]                 = useState<File | null>(null);
  const [title, setTitle]               = useState("");
  const [faculty, setFaculty]           = useState("");
  const [program, setProgram]           = useState("");
  const [docType, setDocType]           = useState("");
  const [faculties, setFaculties]       = useState<TaxonomyItem[]>([]);
  const [programs, setPrograms]         = useState<TaxonomyItem[]>([]);
  const [docTypes, setDocTypes]         = useState<TaxonomyItem[]>([]);

  useEffect(() => {
    // allSettled (not all) — un catálogo caído no debe vaciar los otros dos
    // que sí cargaron bien.
    Promise.allSettled([
      apiClient.getFaculties(),
      apiClient.getPrograms(),
      apiClient.getDocumentTypes(),
    ]).then(([f, p, t]) => {
      if (f.status === "fulfilled") setFaculties(f.value); else toast.error("No se pudieron cargar las facultades");
      if (p.status === "fulfilled") setPrograms(p.value); else toast.error("No se pudieron cargar los programas");
      if (t.status === "fulfilled") setDocTypes(t.value); else toast.error("No se pudieron cargar los tipos de documento");
    });
  }, []);

  // Tracks last-seen status per document id so polling can toast on processing → completed/failed transitions
  const lastStatusRef = useRef<Map<string, string>>(new Map());

  const loadDocuments = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data, total } = await apiClient.getDocumentsPage(page, perPage) as unknown as
        { data: DocumentItem[]; total: number };

      for (const doc of data) {
        const prev = lastStatusRef.current.get(doc.id);
        if (prev === "processing" && doc.ingestion_status === "completed") {
          toast.success(`"${doc.title}" procesado correctamente (${doc.total_chunks} chunks)`);
        } else if (prev === "processing" && doc.ingestion_status === "failed") {
          toast.error(`Error procesando "${doc.title}". Revisa el documento o intenta reindexar.`);
        }
        lastStatusRef.current.set(doc.id, doc.ingestion_status);
      }

      setDocuments(data);
      setTotalDocuments(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando documentos");
    } finally { if (!silent) setLoading(false); }
  }, [page, perPage]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Poll (without the loading spinner) while any document is still processing in the
  // background — upload/reindex now return immediately with status "processing"
  // (see documents.py / document_service.py) instead of blocking the HTTP request.
  const hasProcessing = documents.some((d) => d.ingestion_status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(() => { loadDocuments(true); }, 4000);
    return () => clearInterval(interval);
  }, [hasProcessing, loadDocuments]);

  const resetUploadForm = () => {
    setFile(null); setTitle(""); setFaculty(""); setProgram(""); setDocType("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); if (!title) setTitle(dropped.name.replace(/\.[^/.]+$/, "")); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^/.]+$/, "")); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setUploading(true); setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      if (faculty) formData.append("faculty", faculty);
      if (program) formData.append("program", program);
      if (docType) formData.append("document_type", docType);
      const result = await apiClient.uploadDocument(formData);
      if (result.status === "processing") {
        // Upload accepted; extraction/embeddings run in the background (see
        // hasProcessing polling above) so the request doesn't block on slow
        // Ollama calls and time out at the proxy/edge.
        toast.info(result.message || "Documento recibido. Procesando en segundo plano...");
        resetUploadForm(); setUploadModalOpen(false);
        setPage(1); await loadDocuments();
      } else if (result.status === "completed") {
        toast.success(result.message || "Documento procesado correctamente");
        resetUploadForm(); setUploadModalOpen(false);
        setPage(1); await loadDocuments();
      } else if (result.status === "duplicate") {
        toast.warning(result.message || "El documento ya existe en la base de conocimientos");
        resetUploadForm();
      } else {
        // status === "failed"
        throw new Error(result.message || "Error procesando el documento");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error subiendo documento";
      setError(msg); toast.error(msg);
    } finally { setUploading(false); }
  };

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) handleDeleteConfirm(id);
    else { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); }
  };

  const handleDeleteConfirm = async (id: string) => {
    setConfirmDeleteId(null);
    try {
      await apiClient.deleteDocument(id);
      toast.success("Documento eliminado");
      // Deleting the last row of a page beyond the first would otherwise
      // leave the view stuck on a now-empty page — step back instead
      // (triggers a reload via loadDocuments' `page` dependency).
      if (documents.length === 1 && page > 1) setPage((p) => p - 1);
      else await loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error eliminando documento";
      setError(msg); toast.error(msg);
    }
  };

  const handleReindex = async (id: string, title: string) => {
    setReindexingId(id);
    try {
      const result = await apiClient.reindexDocument(id);
      toast.info(result.message || `Reindexando "${title}"...`);
      // Status flips to "processing" server-side — the existing 4s poll picks
      // up the completed/failed transition and toasts it.
      await loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al reindexar el documento";
      toast.error(msg);
    } finally {
      setReindexingId(null);
    }
  };

  const handleEditOpen = (doc: DocumentItem) => {
    setEditingDoc(doc);
    setEditFaculty(doc.faculty ?? "");
    setEditProgram(doc.program ?? "");
    setEditDocType(doc.document_type ?? "");
  };

  const handleEditClose = () => setEditingDoc(null);

  const handleEditSave = async () => {
    if (!editingDoc) return;
    setSavingEdit(true);
    try {
      await apiClient.updateDocumentMetadata(editingDoc.id, {
        faculty: editFaculty || null,
        program: editProgram || null,
        document_type: editDocType || null,
      });
      toast.success(`"${editingDoc.title}" actualizado`);
      setEditingDoc(null);
      await loadDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error actualizando el documento");
    } finally {
      setSavingEdit(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalDocuments / perPage));
  const rangeStart = totalDocuments === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, totalDocuments);

  const handlePerPageChange = (value: number) => {
    setPerPage(value);
    setPage(1);
  };

  const taxonomyFields = (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>Facultad</label>
        <Select
          value={faculty}
          onValueChange={setFaculty}
          options={[{ value: "", label: "Sin especificar" }, ...faculties.map((f) => ({ value: f.name, label: f.name }))]}
          triggerStyle={{ width: "100%", boxSizing: "border-box" }}
          searchable
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>Programa</label>
        <Select
          value={program}
          onValueChange={setProgram}
          options={[{ value: "", label: "Sin especificar" }, ...programs.map((p) => ({ value: p.name, label: p.name }))]}
          triggerStyle={{ width: "100%", boxSizing: "border-box" }}
          searchable
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Base de conocimiento"
        subtitle={loading ? "Cargando..." : `${totalDocuments} documento${totalDocuments !== 1 ? "s" : ""} indexados`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => loadDocuments()} disabled={loading} className="btn btn-secondary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
            </button>
            <button onClick={() => setUploadModalOpen(true)} className="btn btn-primary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={12} /> Subir documento
            </button>
          </div>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r)", background: "var(--error-dim)", border: "1px solid rgba(200,54,44,0.2)", color: "var(--error)", fontSize: 13, marginBottom: 20 }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
            <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}><X size={13} /></button>
          </div>
        )}

        {/* Full-width documents table — the upload form used to live in a
            permanent sticky sidebar here, which starved the table of room
            and clipped the Acciones column on anything but a very wide
            screen. It now opens on demand (see the "Subir documento" button
            above), same modal pattern as Editar. */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={13} style={{ color: "var(--brand-primary)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Documentos indexados</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{totalDocuments}</span>
          </div>

          {loading ? (
            <div style={{ padding: "56px 0", display: "flex", justifyContent: "center", gap: 5 }}>
              {[0, 0.12, 0.24].map((d) => (
                <span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-primary)", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 0" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <FileText size={22} style={{ color: "var(--text-3)" }} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>Sin documentos</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Sube el primer documento para empezar a construir la base de conocimiento.</div>
              <button onClick={() => setUploadModalOpen(true)} className="btn btn-primary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={12} /> Subir documento
              </button>
            </div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden md:block" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["Título", "Facultad", "Programa", "Tipo", "Estado", "Chunks", "Fecha", ""].map((h, i) => (
                        <th key={i} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", textAlign: i === 5 ? "right" : i === 7 ? "right" : "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc, i) => (
                      <tr key={doc.id}
                        style={{ borderBottom: i < documents.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <FileText size={12} style={{ color: "var(--brand-primary)" }} />
                            </div>
                            <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text-1)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={doc.title}>
                              {doc.title}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 16px" }}><TaxonomyTag value={doc.faculty} /></td>
                        <td style={{ padding: "13px 16px" }}><TaxonomyTag value={doc.program} /></td>
                        <td style={{ padding: "13px 16px" }}><TaxonomyTag value={doc.document_type} /></td>
                        <td style={{ padding: "13px 16px" }}>
                          <StatusPill status={doc.ingestion_status} />
                        </td>
                        <td style={{ padding: "13px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-2)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {doc.total_chunks}
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                          {new Date(doc.created_at).toLocaleDateString("es-CO")}
                        </td>
                        <td style={{ padding: "13px 16px", textAlign: "right" }}>
                          <DocRowActions doc={doc} reindexingId={reindexingId} confirmDeleteId={confirmDeleteId} onReindex={handleReindex} onDelete={handleDeleteClick} onEdit={handleEditOpen} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: card list — no horizontal scroll, one glance per doc */}
              <div className="md:hidden">
                {documents.map((doc) => (
                  <div key={doc.id} className="admin-row-card">
                    <div className="admin-row-card-top">
                      <div className="admin-row-card-title">
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FileText size={12} style={{ color: "var(--brand-primary)" }} />
                        </div>
                        <span>{doc.title}</span>
                      </div>
                      <StatusPill status={doc.ingestion_status} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "2px 0 8px" }}>
                      <TaxonomyTag value={doc.faculty} />
                      <TaxonomyTag value={doc.program} />
                      <TaxonomyTag value={doc.document_type} />
                    </div>
                    <div className="admin-row-card-meta">
                      <span>{doc.total_chunks} chunks</span>
                      <span>{new Date(doc.created_at).toLocaleDateString("es-CO")}</span>
                    </div>
                    <div className="admin-row-card-actions">
                      <DocRowActions doc={doc} reindexingId={reindexingId} confirmDeleteId={confirmDeleteId} onReindex={handleReindex} onDelete={handleDeleteClick} onEdit={handleEditOpen} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination footer — always shown alongside the list (not just
                  when a second page exists) so the "por página" selector stays
                  reachable; Anterior/Siguiente simply disable themselves when
                  there's only one page. */}
              {totalDocuments > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                      Mostrando <strong style={{ color: "var(--text-2)", fontWeight: 600 }}>{rangeStart}–{rangeEnd}</strong> de {totalDocuments}
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)" }}>
                      Por página
                      <Select
                        value={String(perPage)}
                        onValueChange={(v) => handlePerPageChange(Number(v))}
                        options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                        triggerStyle={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                      className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ChevronLeft size={13} /> Anterior
                    </button>
                    <span style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{page} / {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                      className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      Siguiente <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload modal */}
      {uploadModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, overflowY: "auto" }}
          onClick={() => !uploading && setUploadModalOpen(false)}
          onKeyDown={(e) => { if (e.key === "Escape" && !uploading) setUploadModalOpen(false); }}
          role="dialog" aria-modal="true" aria-label="Subir documento"
        >
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: 24, margin: "24px 0" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Upload size={14} style={{ color: "var(--brand-primary)" }} />
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--text-1)" }}>Subir documento</span>
              </div>
              <button onClick={() => !uploading && setUploadModalOpen(false)} disabled={uploading}
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleUpload}>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !file && document.getElementById("doc-file-input")?.click()}
                style={{
                  border: `1px dashed ${dragOver || file ? "var(--brand-primary)" : "var(--border-2)"}`,
                  borderRadius: "var(--r-lg)", padding: file ? "16px 14px" : "28px 16px",
                  textAlign: "center",
                  background: dragOver || file ? "var(--brand-dim)" : "var(--surface-2)",
                  transition: "all 0.2s cubic-bezier(0.32,0.72,0,1)",
                  marginBottom: 16, cursor: file ? "default" : "pointer",
                }}
              >
                {file ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText size={15} style={{ color: "var(--brand-primary)" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{ width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--surface-3)", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                      <ArrowUp size={17} style={{ color: "var(--text-3)" }} strokeWidth={1.5} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)", margin: "0 0 4px" }}>
                      Arrastra o{" "}
                      <label style={{ color: "var(--brand-primary)", cursor: "pointer", fontWeight: 600 }}>
                        selecciona
                        <input id="doc-file-input" type="file" accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.csv,.pptx" style={{ display: "none" }} onChange={handleFileSelect} />
                      </label>
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>PDF · DOC(X) · TXT · MD · XLS(X) · CSV · PPTX</p>
                  </>
                )}
              </div>

              {/* Title */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>
                  Titulo <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Catalogo Academico 2026" required
                  className="input" style={{ width: "100%", boxSizing: "border-box" }} />
              </div>

              {/* Optional fields — poblados desde /admin/catalogos */}
              {taxonomyFields}

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>Tipo</label>
                <Select
                  value={docType}
                  onValueChange={setDocType}
                  options={[{ value: "", label: "General" }, ...docTypes.map((t) => ({ value: t.name, label: t.name }))]}
                  triggerStyle={{ width: "100%", boxSizing: "border-box" }}
                  searchable
                />
              </div>

              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "-8px 0 14px" }}>
                ¿Falta una opción? Gestiónalas en <a href="/admin/catalogos" style={{ color: "var(--brand-primary)" }}>Catálogos</a>.
              </p>

              <button type="submit" disabled={!file || !title || uploading} className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 7 }}>
                {uploading ? (
                  <>{[0, 0.1, 0.2].map((d) => <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.8)", display: "inline-block", animation: `pulse-soft 1s ${d}s ease-in-out infinite` }} />)} Procesando...</>
                ) : (
                  <><Upload size={13} /> Subir Documento</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit metadata modal */}
      {editingDoc && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={handleEditClose}
          onKeyDown={(e) => { if (e.key === "Escape") handleEditClose(); }}
          role="dialog" aria-modal="true" aria-label="Editar documento"
        >
          <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--text-1)" }}>Editar documento</div>
              <button onClick={handleEditClose}
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
                <X size={14} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 18, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {editingDoc.title}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>Facultad</label>
                <Select
                  value={editFaculty}
                  onValueChange={setEditFaculty}
                  options={[{ value: "", label: "Sin especificar" }, ...faculties.map((f) => ({ value: f.name, label: f.name }))]}
                  triggerStyle={{ width: "100%", boxSizing: "border-box" }}
                  searchable
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>Programa</label>
                <Select
                  value={editProgram}
                  onValueChange={setEditProgram}
                  options={[{ value: "", label: "Sin especificar" }, ...programs.map((p) => ({ value: p.name, label: p.name }))]}
                  triggerStyle={{ width: "100%", boxSizing: "border-box" }}
                  searchable
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>Tipo</label>
              <Select
                value={editDocType}
                onValueChange={setEditDocType}
                options={[{ value: "", label: "General" }, ...docTypes.map((t) => ({ value: t.name, label: t.name }))]}
                triggerStyle={{ width: "100%", boxSizing: "border-box" }}
                searchable
              />
            </div>

            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "-8px 0 14px" }}>
              ¿Falta una opción? Gestiónalas en <a href="/admin/catalogos" style={{ color: "var(--brand-primary)" }}>Catálogos</a>.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleEditClose}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text-2)" }}>
                Cancelar
              </button>
              <button disabled={savingEdit} onClick={handleEditSave}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", background: savingEdit ? "var(--surface-2)" : "var(--brand-primary)", cursor: savingEdit ? "not-allowed" : "pointer", color: savingEdit ? "var(--text-3)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.15s" }}>
                {savingEdit ? (
                  <>{[0, 0.1, 0.2].map((d) => <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: `pulse-soft 1s ${d}s ease-in-out infinite` }} />)} Guardando...</>
                ) : (
                  <><Check size={13} /> Guardar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
