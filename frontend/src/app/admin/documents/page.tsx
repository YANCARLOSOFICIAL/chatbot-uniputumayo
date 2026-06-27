"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, CheckCircle2, Clock, XCircle, Trash2, X, ArrowUp, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/Toast";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";

interface DocumentItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
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

export default function DocumentsPage() {
  const [documents, setDocuments]       = useState<DocumentItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [file, setFile]                 = useState<File | null>(null);
  const [title, setTitle]               = useState("");
  const [faculty, setFaculty]           = useState("");
  const [program, setProgram]           = useState("");
  const [docType, setDocType]           = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDocuments();
      setDocuments(data as unknown as DocumentItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando documentos");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

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
      if (result.status === "completed") {
        toast.success(result.message || "Documento procesado correctamente");
        setFile(null); setTitle(""); setFaculty(""); setProgram(""); setDocType("");
        await loadDocuments();
      } else if (result.status === "duplicate") {
        toast.warning(result.message || "El documento ya existe en la base de conocimientos");
        setFile(null); setTitle(""); setFaculty(""); setProgram(""); setDocType("");
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
      await loadDocuments();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error eliminando documento";
      setError(msg); toast.error(msg);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Base de conocimiento"
        subtitle={loading ? "Cargando..." : `${documents.length} documento${documents.length !== 1 ? "s" : ""} indexados`}
        action={
          <button onClick={loadDocuments} disabled={loading} className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        {/* Two-col: upload card (sticky) + docs table */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24, alignItems: "start" }}>

          {/* Upload panel */}
          <div className="card" style={{ padding: 24, position: "sticky", top: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Upload size={14} style={{ color: "var(--brand-primary)" }} />
              </div>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>Subir documento</span>
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
                        <input id="doc-file-input" type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={handleFileSelect} />
                      </label>
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>PDF · DOCX · TXT</p>
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

              {/* Optional fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[
                  { label: "Facultad", value: faculty, set: setFaculty, ph: "Ingenieria" },
                  { label: "Programa", value: program, set: setProgram, ph: "Ing. Sistemas" },
                ].map(({ label, value, set, ph }) => (
                  <div key={label}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</label>
                    <input type="text" value={value} onChange={(e) => set(e.target.value)} placeholder={ph}
                      className="input" style={{ width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".07em" }}>Tipo</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input" style={{ width: "100%", boxSizing: "border-box" }}>
                  <option value="">General</option>
                  <option value="pensum">Pensum</option>
                  <option value="perfil">Perfil Profesional</option>
                  <option value="mision">Mision y Vision</option>
                  <option value="reglamento">Reglamento</option>
                  <option value="admision">Requisitos de Admision</option>
                </select>
              </div>

              <button type="submit" disabled={!file || !title || uploading} className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 7 }}>
                {uploading ? (
                  <><LoadingDots size={3} color="rgba(255,255,255,0.8)" delays={[0, 0.1, 0.2]} /> Procesando...</>
                ) : (
                  <><Upload size={13} /> Subir Documento</>
                )}
              </button>
            </form>
          </div>

          {/* Documents list */}
          <div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={13} style={{ color: "var(--brand-primary)" }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Documentos indexados</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{documents.length}</span>
              </div>

              {loading ? (
                <div style={{ padding: "56px 0", display: "flex", justifyContent: "center", gap: 5 }}>
                  <LoadingDots />
                </div>
              ) : documents.length === 0 ? (
                <EmptyState icon={FileText} title="Sin documentos" description="Sube el primer documento desde el panel izquierdo." />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)" }}>
                        {["Titulo", "Archivo", "Estado", "Chunks", "Fecha", ""].map((h, i) => (
                          <th key={i} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", textAlign: i === 5 ? "right" : "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
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
                              <span style={{ fontWeight: 500, fontSize: 13, color: "var(--text-1)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {doc.title}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                            {doc.file_name}
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <StatusPill status={doc.ingestion_status} />
                          </td>
                          <td style={{ padding: "13px 16px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-2)" }}>
                            {doc.total_chunks}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                            {new Date(doc.created_at).toLocaleDateString("es-CO")}
                          </td>
                          <td style={{ padding: "13px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => handleDeleteClick(doc.id)}
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
