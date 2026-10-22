"use client";

import { useState, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, MailCheck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { FooterCredit } from "@/components/ui/SiteFooter";

export default function ForgotPasswordPage() {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.forgotPassword(email);
      setSent(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el enlace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-form-side">
        <div className="auth-form-area">
          <div className="auth-card">

            <div className="auth-mark">
              <Image src="/isotipo.webp" alt="Guaca" width={36} height={36} style={{ objectFit: "contain" }} />
              <div>
                <div className="auth-mark-name">Guaca</div>
                <div className="auth-mark-sub">UniPutumayo</div>
              </div>
            </div>

            <h2>Recupera tu contraseña</h2>
            <p className="auth-card-sub">
              Te enviaremos un enlace para restablecerla
            </p>

            {error && (
              <div className="auth-error">
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            {sent ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", padding: "8px 0 4px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-soft)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-ink)" }}>
                  <MailCheck size={20} />
                </div>
                <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>{sent}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} autoComplete="off">
                <div className="auth-field">
                  <label htmlFor={`${uid}_email`} className="field-label">Correo electrónico</label>
                  <input
                    id={`${uid}_email`} type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="input"
                  />
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
            )}

            <div className="auth-foot">
              <Link href="/admin/login">← Volver a iniciar sesión</Link>
            </div>
          </div>
        </div>

        <FooterCredit />
      </div>
    </div>
  );
}
