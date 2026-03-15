"use client";

import { useState, useEffect } from "react";
import { Users, AlertCircle, X, Shield, User } from "lucide-react";
import { apiClient, type AuthUser } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";

export default function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

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
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-1)]">Gestión de Usuarios</h1>
        <p className="text-sm text-[var(--text-3)] mt-1">Administra los usuarios y sus roles de acceso al sistema.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[var(--error-dim)] border border-[var(--error)] border-opacity-30 text-sm text-[var(--error)]">
          <AlertCircle size={15} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto hover:opacity-70"><X size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Total usuarios", value: users.length, icon: Users, color: "#3b82f6" },
          { label: "Administradores", value: users.filter((u) => u.role === "admin").length, icon: Shield, color: "#8b5cf6" },
          { label: "Usuarios estándar", value: users.filter((u) => u.role !== "admin").length, icon: User, color: "#10b981" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + "20", color }}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-3)]">{label}</p>
              <p className="text-xl font-bold text-[var(--text-1)]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-xs)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-1)] flex items-center gap-2">
            <Users size={15} className="text-[var(--brand)]" />
            Usuarios registrados
            <span className="text-xs font-normal text-[var(--text-4)]">({users.length})</span>
          </h2>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-16">
            <Users size={36} className="text-[var(--border)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-3)]">No hay usuarios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  {["Nombre", "Email", "Rol", "Fecha registro", "Acciones"].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-[var(--text-4)] uppercase tracking-wider ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand)] to-teal-600 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
                          {user.display_name?.[0] ?? "U"}
                        </div>
                        <span className="text-sm font-medium text-[var(--text-1)]">{user.display_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--text-3)]">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className={[
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                        user.role === "admin"
                          ? "bg-violet-500/10 text-violet-500"
                          : "bg-[var(--surface-3)] text-[var(--text-2)]",
                      ].join(" ")}>
                        {user.role === "admin" ? <Shield size={10} /> : <User size={10} />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[var(--text-3)]">
                      {new Date(user.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {updating === user.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-xs border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] rounded-lg px-2 py-1.5 focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] focus:outline-none transition-all"
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
  );
}
