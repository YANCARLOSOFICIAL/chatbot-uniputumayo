"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload, FileText, CheckCircle2, Clock, XCircle, AlertCircle,
  Trash2, Check, X, CloudUpload
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  completed:  { label: "Completado",  color: "var(--success)",  bg: "var(--brand-dim)",   icon: CheckCircle2 },
  processing: { label: "Procesando",  color: "var(--warning)",  bg: "var(--accent-dim)",  icon: Clock },
  failed:     { label: "Error",        color: "var(--error)",    bg: "var(--error-dim)",   icon: XCircle },
  pending:    { label: "Pendiente",    color: "var(--text-3)",   bg: "var(--surface-3)",   icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg }}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function InputField({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-2)] mb-1.5">
        {label} {required && <span className="text-[var(--error)]">*</span>}
      </label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="input-base" />
    </div>
  );
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-1)]">Gestión de Documentos</h1>
        <p className="text-sm text-[var(--text-3)] mt-1">Sube documentos académicos para la base de conocimientos del chatbot.</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[var(--error-dim)] border border-[var(--error)] border-opacity-30 text-sm text-[var(--error)]">
          <AlertCircle size={15} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:opacity-70"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[var(--brand-dim)] border border-[var(--brand)] border-opacity-30 text-sm text-[var(--brand-text)]">
          <Check size={15} className="shrink-0" /> {success}
          <button onClick={() => setSuccess(null)} className="ml-auto hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-xs)] p-6">
        <h2 className="text-sm font-semibold text-[var(--text-1)] mb-5 flex items-center gap-2">
          <CloudUpload size={15} className="text-[var(--brand)]" /> Subir nuevo documento
        </h2>
        <form onSubmit={handleUpload} className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={[
              "border-2 border-dashed rounded-xl p-8 text-center transition-all",
              dragOver ? "border-[var(--brand)] bg-[var(--brand-dim)]"
                : file  ? "border-[var(--brand)] bg-[var(--brand-dim)]"
                : "border-[var(--border)] hover:border-[var(--border-2)] bg-[var(--surface-2)]",
            ].join(" ")}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={28} className="text-[var(--brand)]" />
                <div className="text-left">
                  <p className="text-sm font-medium text-[var(--text-1)]">{file.name}</p>
                  <p className="text-xs text-[var(--text-3)]">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onClick={() => setFile(null)}
                  className="ml-2 w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--error-dim)] hover:text-[var(--error)] transition-all">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={32} className="text-[var(--text-4)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-3)] mb-1">
                  Arrastra tu archivo aquí o{" "}
                  <label className="text-[var(--brand)] cursor-pointer hover:text-[var(--brand-hover)] font-medium transition-colors">
                    selecciona uno
                    <input type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={handleFileSelect} />
                  </label>
                </p>
                <p className="text-xs text-[var(--text-4)]">PDF, DOCX, TXT — máx. 50 MB</p>
              </>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Título" value={title} onChange={setTitle}
              placeholder="Ej: Pensum Ingeniería de Sistemas" required />
            <InputField label="Facultad" value={faculty} onChange={setFaculty}
              placeholder="Ej: Ingeniería" />
            <InputField label="Programa" value={program} onChange={setProgram}
              placeholder="Ej: Ingeniería de Sistemas" />
            <div>
              <label className="block text-sm font-medium text-[var(--text-2)] mb-1.5">Tipo de Documento</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="input-base">
                <option value="">Seleccionar...</option>
                <option value="pensum">Pensum</option>
                <option value="perfil">Perfil Profesional</option>
                <option value="mision">Misión y Visión</option>
                <option value="reglamento">Reglamento</option>
                <option value="admision">Requisitos de Admisión</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={!file || !title || uploading}
            className="btn btn-primary px-6 py-2.5 flex items-center gap-2">
            {uploading
              ? <><Spinner size="sm" /> Procesando...</>
              : <><Upload size={15} /> Subir Documento</>
            }
          </button>
        </form>
      </div>

      {/* Documents table */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-xs)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-1)] flex items-center gap-2">
            <FileText size={15} className="text-[var(--brand)]" />
            Documentos
            <span className="text-xs font-normal text-[var(--text-4)]">({documents.length})</span>
          </h2>
          <button onClick={() => loadDocuments()}
            className="text-xs text-[var(--text-3)] hover:text-[var(--brand)] transition-colors">
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={36} className="text-[var(--border)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-3)]">No hay documentos. Sube el primero arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  {["Título", "Archivo", "Estado", "Chunks", "Fecha", ""].map((h) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-[var(--text-4)] uppercase tracking-wider ${h === "" ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-[var(--text-1)] max-w-[200px] truncate">{doc.title}</td>
                    <td className="px-5 py-4 text-sm text-[var(--text-3)] max-w-[160px] truncate">{doc.file_name}</td>
                    <td className="px-5 py-4"><StatusBadge status={doc.ingestion_status} /></td>
                    <td className="px-5 py-4 text-sm text-[var(--text-3)]">{doc.total_chunks}</td>
                    <td className="px-5 py-4 text-sm text-[var(--text-3)]">
                      {new Date(doc.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => handleDelete(doc.id)}
                        className="inline-flex items-center gap-1 text-xs text-[var(--text-4)] hover:text-[var(--error)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--error-dim)]">
                        <Trash2 size={13} /> Eliminar
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
  );
}
