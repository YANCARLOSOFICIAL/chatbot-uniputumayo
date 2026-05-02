"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload, FileText, CheckCircle2, Clock, XCircle, AlertCircle,
  Trash2, Check, X, CloudUpload,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";

interface DocumentItem {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  ingestion_status: string;
  total_chunks: number;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  completed:  { label: "Indexado",   cls: "badge badge-suc", icon: CheckCircle2 },
  processing: { label: "Procesando", cls: "badge badge-pri", icon: Clock },
  failed:     { label: "Error",       cls: "badge badge-err", icon: XCircle },
  pending:    { label: "Pendiente",   cls: "badge",           icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const Icon = cfg.icon;
  return <span className={cfg.cls} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon size={10} /> {cfg.label}</span>;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [faculty, setFaculty] = useState("");
  const [program, setProgram] = useState("");
  const [docType, setDocType] = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDocuments();
      setDocuments(data as unknown as DocumentItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando documentos");
    } finally {
      setLoading(false);
    }
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
    setUploading(true); setError(null); setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      if (faculty) formData.append("faculty", faculty);
      if (program) formData.append("program", program);
      if (docType) formData.append("document_type", docType);
      const result = await apiClient.uploadDocument(formData);
      setSuccess(result.message);
      setFile(null); setTitle(""); setFaculty(""); setProgram(""); setDocType("");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo documento");
    } finally { setUploading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este documento?")) return;
    try {
      await apiClient.deleteDocument(id);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando documento");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Header */}
      <header style={{
        padding: "20px 32px", borderBottom: "1px solid var(--border)",
        background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>Base de conocimiento</h2>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>Sube y gestiona documentos académicos para el RAG.</div>
        </div>
        <button
          onClick={() => loadDocuments()}
          className="btn btn-secondary btn-sm"
        >
          Actualizar
        </button>
      </header>

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {/* Alerts */}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r)", background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13, marginBottom: 20 }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
            <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}><X size={13} /></button>
          </div>
        )}
        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r)", background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#16A34A", fontSize: 13, marginBottom: 20 }}>
            <Check size={14} style={{ flexShrink: 0 }} /> {success}
            <button onClick={() => setSuccess(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}><X size={13} /></button>
          </div>
        )}

        {/* Upload card */}
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 16px", color: "var(--text-1)", display: "flex", alignItems: "center", gap: 8 }}>
            <CloudUpload size={16} style={{ color: "var(--brand-primary)" }} /> Subir nuevo documento
          </h3>
          <form onSubmit={handleUpload}>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver || file ? "var(--brand-primary)" : "var(--border)"}`,
                borderRadius: "var(--r-lg)",
                padding: "32px 24px",
                textAlign: "center",
                background: dragOver || file ? "var(--brand-primary-lighter)" : "var(--surface-2)",
                transition: "all 150ms ease",
                marginBottom: 16,
              }}
            >
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <FileText size={24} style={{ color: "var(--brand-primary)" }} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button type="button" onClick={() => setFile(null)} style={{
                    marginLeft: 8, width: 24, height: 24, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: "var(--surface-3)", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}><X size={13} /></button>
                </div>
              ) : (
                <>
                  <Upload size={28} style={{ color: "var(--text-3)", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 4 }}>
                    Arrastra aquí o{" "}
                    <label style={{ color: "var(--brand-primary)", cursor: "pointer", fontWeight: 500 }}>
                      selecciona un archivo
                      <input type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={handleFileSelect} />
                    </label>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>PDF, DOCX, TXT — máx. 50 MB</div>
                </>
              )}
            </div>

            {/* Metadata grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Título", value: title, onChange: setTitle, placeholder: "Ej: Catálogo Académico 2026", required: true },
                { label: "Facultad", value: faculty, onChange: setFaculty, placeholder: "Ej: Ingeniería" },
                { label: "Programa", value: program, onChange: setProgram, placeholder: "Ej: Ingeniería de Sistemas" },
              ].map(({ label, value, onChange, placeholder, required }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>
                    {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
                  </label>
                  <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder} required={required}
                    className="input" style={{ width: "100%", boxSizing: "border-box" }} />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Tipo</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input" style={{ width: "100%", boxSizing: "border-box" }}>
                  <option value="">Seleccionar…</option>
                  <option value="pensum">Pensum</option>
                  <option value="perfil">Perfil Profesional</option>
                  <option value="mision">Misión y Visión</option>
                  <option value="reglamento">Reglamento</option>
                  <option value="admision">Requisitos de Admisión</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={!file || !title || uploading} className="btn btn-primary">
              {uploading
                ? <><Spinner size="sm" /> Procesando…</>
                : <><Upload size={14} /> Subir Documento</>
              }
            </button>
          </form>
        </div>

        {/* Documents table */}
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text-1)" }}>
            Documentos indexados <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 400, color: "var(--text-3)", marginLeft: 4 }}>({documents.length})</span>
          </h3>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spinner size="lg" /></div>
            ) : documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <FileText size={32} style={{ color: "var(--border)", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>No hay documentos. Sube el primero arriba.</div>
              </div>
            ) : (
              <table className="admin-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Archivo</th>
                    <th>Estado</th>
                    <th>Chunks</th>
                    <th>Fecha</th>
                    <th style={{ textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td style={{ fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{doc.file_name}</td>
                      <td><StatusBadge status={doc.ingestion_status} /></td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{doc.total_chunks}</td>
                      <td style={{ color: "var(--text-3)", fontSize: 12 }}>{new Date(doc.created_at).toLocaleDateString("es-CO")}</td>
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => handleDelete(doc.id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "var(--r)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLElement).style.background = "none"; }}>
                          <Trash2 size={11} /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
