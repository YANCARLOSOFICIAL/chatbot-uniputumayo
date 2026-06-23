"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, AlertCircle, X, Shield, User } from "lucide-react";
import { apiClient, type AuthUser } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId); setError(null);
    try {
      await apiClient.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando rol");
    } finally { setUpdating(null); }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}><Spinner size="lg" /></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Usuarios"
        subtitle="Administra los usuarios y sus roles de acceso."
        action={<button onClick={loadUsers} className="btn btn-secondary btn-sm">Actualizar</button>}
      />
    <div className="space-y-5" style={{ padding: "28px 32px 48px", flex: 1 }}>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--error-dim)] border border-[var(--error)]/20 text-[13px] text-[var(--error)]">
          <AlertCircle size={14} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:opacity-70"><X size={13} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total usuarios", value: users.length, icon: Users, color: "#0091ff" },
          { label: "Administradores", value: users.filter((u) => u.role === "admin").length, icon: Shield, color: "#8b5cf6" },
          { label: "Usuarios estándar", value: users.filter((u) => u.role !== "admin").length, icon: User, color: "#30a46c" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3.5 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + "14", color }}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-[11px] text-[var(--text-3)]">{label}</p>
              <p className="text-lg font-bold text-[var(--text-1)]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="text-[13px] font-semibold text-[var(--text-1)] flex items-center gap-1.5">
            <Users size={13} className="text-[var(--brand-primary)]" />
            Usuarios registrados
            <span className="text-[11px] font-normal text-[var(--text-3)]">({users.length})</span>
          </h2>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-14">
            <Users size={32} className="text-[var(--border)] mx-auto mb-2" />
            <p className="text-[13px] text-[var(--text-2)]">No hay usuarios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  {["Nombre", "Email", "Rol", "Fecha registro", "Acciones"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-[11px] font-medium text-[var(--text-3)] tracking-wide ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold uppercase shrink-0" style={{ background: "var(--brand-accent)" }}>
                          {user.display_name?.[0] ?? "U"}
                        </div>
                        <span className="text-sm font-medium text-[var(--text-1)]">{user.display_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={[
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
                        user.role === "admin"
                          ? "bg-violet-500/10 text-violet-500"
                          : "bg-[var(--surface-3)] text-[var(--text-2)]",
                      ].join(" ")}>
                        {user.role === "admin" ? <Shield size={9} /> : <User size={9} />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-2)]">
                      {new Date(user.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {updating === user.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-[11px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] rounded-md px-2 py-1 focus:border-[var(--brand-primary)] focus:outline-none transition-colors"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
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
  );
}
