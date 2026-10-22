"use client";

import { Suspense, useState, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { FooterCredit } from "@/components/ui/SiteFooter";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const uid = useId();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");

    setLoading(true);
    setError(null);
    try {
      await apiClient.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/admin/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-mark">
        <Image src="/isotipo.webp" alt="Guaca" width={36} height={36} style={{ objectFit: "contain" }} />
        <div>
          <div className="auth-mark-name">Guaca</div>
          <div className="auth-mark-sub">UniPutumayo</div>
        </div>
      </div>

      <h2>Crea una nueva contraseña</h2>
      <p className="auth-card-sub">Elige una clave de al menos 6 caracteres</p>

      {!token ? (
        <div className="auth-error">
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Este enlace no es válido. Solicita uno nuevo desde la página de recuperación.
        </div>
      ) : done ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-soft)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-ink)" }}>
            <Check size={20} />
          </div>
          <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>
            Contraseña actualizada. Redirigiendo al inicio de sesión…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} autoComplete="off">
          {error && (
            <div className="auth-error">
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          <PasswordField id={`${uid}_pass`} label="Nueva contraseña" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
          <PasswordField id={`${uid}_conf`} label="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repite tu contraseña" />

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
            {loading ? "Guardando..." : "Restablecer contraseña"}
          </button>
        </form>
      )}

      <div className="auth-foot">
        <Link href="/admin/login">← Volver a iniciar sesión</Link>
      </div>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="auth-input-wrap">
        <input
          id={id} type={show ? "text" : "password"} required value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input"
          autoComplete="new-password"
        />
        <button
          type="button" onClick={() => setShow(!show)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={show}
          className="auth-input-toggle"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-form-side">
        <div className="auth-form-area">
          <Suspense fallback={<div className="auth-card" style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>Cargando…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <FooterCredit />
      </div>
    </div>
  );
}
