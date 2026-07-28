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
    <div className="glass-navy-strong" style={{ width: "100%", maxWidth: 400, borderRadius: 24, padding: "40px 36px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Image src="/isotipo.webp" alt="Guaca" width={44} height={44} style={{ objectFit: "contain", margin: "0 auto 16px" }} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", margin: "0 0 6px" }}>
          Crea una nueva contraseña
        </h2>
      </div>

      {!token ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(200,54,44,0.12)", border: "1px solid rgba(200,54,44,0.25)", color: "#fca5a5", fontSize: 13 }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          Este enlace no es válido. Solicita uno nuevo desde la página de recuperación.
        </div>
      ) : done ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(123,181,46,0.15)", border: "1px solid rgba(123,181,46,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={20} color="var(--brand-accent)" />
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: 0 }}>
            Contraseña actualizada. Redirigiendo al inicio de sesión...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(200,54,44,0.12)", border: "1px solid rgba(200,54,44,0.25)", color: "#fca5a5", fontSize: 13 }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          <PasswordField id={`${uid}_pass`} label="Nueva contraseña" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
          <PasswordField id={`${uid}_conf`} label="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repite tu contraseña" />

          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "13px", borderRadius: 10,
              background: "var(--brand-accent)", color: "#fff", border: "none",
              fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Guardando..." : "Restablecer contraseña"}
          </button>
        </form>
      )}

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Link href="/admin/login" style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", textDecoration: "none" }}>
          ← Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 7, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id} type={show ? "text" : "password"} required value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="dark-input"
          autoComplete="new-password"
          style={{ paddingRight: 42 }}
        />
        <button
          type="button" onClick={() => setShow(!show)}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", padding: 4 }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#071824", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "url('/hero-fondo.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, rgba(7,24,36,0.88) 0%, rgba(11,52,71,0.72) 50%, rgba(11,52,71,0.5) 100%)" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "48px 24px", position: "relative", zIndex: 1 }}>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
        <FooterCredit />
      </div>
    </div>
  );
}
