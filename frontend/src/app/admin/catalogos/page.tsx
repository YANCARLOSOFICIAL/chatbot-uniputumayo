"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/Toast";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface Item {
  id: string;
  name: string;
}

function CatalogPanel({
  title, items, loading, onCreate, onRename, onDelete,
}: {
  title: string;
  items: Item[];
  loading: boolean;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreate(newName.trim());
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item: Item) => { setEditingId(item.id); setEditValue(item.name); };

  const commitEdit = async () => {
    if (!editingId) return;
    const v = editValue.trim();
    const id = editingId;
    setEditingId(null);
    if (v) await onRename(id, v);
  };

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) { setConfirmDeleteId(null); onDelete(id); }
    else { setConfirmDeleteId(id); setTimeout(() => setConfirmDeleteId(null), 3000); }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{title}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>{items.length}</span>
      </div>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 6, padding: 12, borderBottom: "1px solid var(--border)" }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nuevo..."
          className="input"
          style={{ flex: 1, boxSizing: "border-box" }}
        />
        <button type="submit" disabled={!newName.trim() || creating} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <Plus size={12} /> Agregar
        </button>
      </form>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>Cargando...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>Sin elementos aún</div>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderBottom: "1px solid var(--border)" }}>
              {editingId === item.id ? (
                <>
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                    className="input" style={{ flex: 1, boxSizing: "border-box" }}
                    autoFocus
                  />
                  <button onClick={commitEdit} title="Guardar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--success)", display: "flex", padding: 3 }}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingId(null)} title="Cancelar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 3 }}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </span>
                  <button onClick={() => startEdit(item)} title="Renombrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 3 }}>
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(item.id)}
                    title={confirmDeleteId === item.id ? "Confirmar?" : "Eliminar"}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 3, color: confirmDeleteId === item.id ? "var(--error)" : "var(--text-3)" }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function CatalogosPage() {
  const [faculties, setFaculties] = useState<Item[]>([]);
  const [programs, setPrograms] = useState<Item[]>([]);
  const [docTypes, setDocTypes] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, p, t] = await Promise.all([
        apiClient.getFaculties(),
        apiClient.getPrograms(),
        apiClient.getDocumentTypes(),
      ]);
      setFaculties(f);
      setPrograms(p);
      setDocTypes(t);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando catálogos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Catálogos"
        subtitle="Gestiona facultades, programas y tipos de documento usados al subir archivos"
      />

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ padding: "28px 32px 48px", gap: 20, flex: 1, alignItems: "start" }}>
        <CatalogPanel
          title="Facultades"
          items={faculties}
          loading={loading}
          onCreate={(name) => runAction(() => apiClient.createFaculty(name))}
          onRename={(id, name) => runAction(() => apiClient.renameFaculty(id, name))}
          onDelete={(id) => runAction(() => apiClient.deleteFaculty(id))}
        />
        <CatalogPanel
          title="Programas"
          items={programs}
          loading={loading}
          onCreate={(name) => runAction(() => apiClient.createProgram(name))}
          onRename={(id, name) => runAction(() => apiClient.renameProgram(id, name))}
          onDelete={(id) => runAction(() => apiClient.deleteProgram(id))}
        />
        <CatalogPanel
          title="Tipos de documento"
          items={docTypes}
          loading={loading}
          onCreate={(name) => runAction(() => apiClient.createDocumentType(name))}
          onRename={(id, name) => runAction(() => apiClient.renameDocumentType(id, name))}
          onDelete={(id) => runAction(() => apiClient.deleteDocumentType(id))}
        />
      </div>
    </div>
  );
}
