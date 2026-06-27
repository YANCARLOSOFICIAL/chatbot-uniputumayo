"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Shield, User, RefreshCw } from "lucide-react";
import { apiClient, type AuthUser } from "@/lib/api/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { toast } from "@/components/ui/Toast";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { StatsStrip } from "@/components/admin/StatsStrip";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { EmptyState } from "@/components/ui/EmptyState";

export default function UsersPage() {
  const [users, setUsers]       = useState<AuthUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando usuarios");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId); setError(null);
    try {
      await apiClient.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast.success("Rol actualizado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error actualizando rol";
      setError(msg); toast.error(msg);
    } finally { setUpdating(null); }
  };

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Usuarios"
        subtitle={loading ? "Cargando..." : `${users.length} usuario${users.length !== 1 ? "s" : ""} registrados`}
        action={
          <button onClick={loadUsers} disabled={loading} className="btn btn-secondary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

        <StatsStrip items={[
          { label: "Total",         value: loading ? "..." : users.length,                color: "var(--brand-primary)" },
          { label: "Admins",        value: loading ? "..." : adminCount,                  color: "#8B5CF6" },
          { label: "Estudiantes",   value: loading ? "..." : users.length - adminCount,   color: "var(--success)" },
        ]} />

        {/* Users table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "13px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={13} style={{ color: "var(--brand-primary)" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Usuarios registrados</span>
          </div>

          {loading ? (
            <div style={{ padding: "56px 0", display: "flex", justifyContent: "center", gap: 5 }}>
              <LoadingDots />
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title="Sin usuarios" description="Nadie se ha registrado aun." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Nombre", "Email", "Rol", "Registro", "Cambiar rol"].map((h, i) => (
                      <th key={h} style={{ padding: "10px 18px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", textAlign: i === 4 ? "right" : "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => (
                    <tr key={user.id}
                      style={{ borderBottom: i < users.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            background: user.role === "admin"
                              ? "linear-gradient(135deg, var(--brand-primary), var(--brand-accent))"
                              : "var(--brand-dim)",
                            border: user.role === "admin"
                              ? "none"
                              : "1px solid var(--brand-light)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                            color: user.role === "admin" ? "#fff" : "var(--brand-primary)",
                            letterSpacing: "0.01em",
                          }}>
                            {(user.display_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2)) ?? "U"}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
                            {user.display_name || "Sin nombre"}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>
                        {user.email}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 9999,
                          fontSize: 11, fontWeight: 600,
                          background: user.role === "admin" ? "rgba(139,92,246,0.1)" : "var(--surface-2)",
                          color: user.role === "admin" ? "#8B5CF6" : "var(--text-2)",
                          border: `1px solid ${user.role === "admin" ? "rgba(139,92,246,0.2)" : "var(--border)"}`,
                        }}>
                          {user.role === "admin" ? <Shield size={9} /> : <User size={9} />}
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: "14px 18px", fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                        {new Date(user.created_at).toLocaleDateString("es-CO")}
                      </td>
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        {updating === user.id ? (
                          <div style={{ display: "inline-flex", gap: 3, justifyContent: "flex-end" }}>
                            <LoadingDots size={3} delays={[0, 0.1, 0.2]} />
                          </div>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            style={{
                              fontSize: 11, fontFamily: "var(--font-body)", border: "1px solid var(--border)",
                              background: "var(--surface-2)", color: "var(--text-2)", borderRadius: 7,
                              padding: "4px 8px", cursor: "pointer", outline: "none",
                            }}
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
