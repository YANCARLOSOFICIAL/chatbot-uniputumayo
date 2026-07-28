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
    <div style={{ minHeight: "100dvh", background: "#071824", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "url('/hero-fondo.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, rgba(7,24,36,0.88) 0%, rgba(11,52,71,0.72) 50%, rgba(11,52,71,0.5) 100%)" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "48px 24px", position: "relative", zIndex: 1 }}>
        <div className="glass-navy-strong" style={{ width: "100%", maxWidth: 400, borderRadius: 24, padding: "40px 36px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <Image src="/isotipo.webp" alt="Guaca" width={44} height={44} style={{ objectFit: "contain", margin: "0 auto 16px" }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", margin: "0 0 6px" }}>
              Recupera tu contraseña
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", margin: 0 }}>
              Te enviaremos un enlace para restablecerla
            </p>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, marginBottom: 20, background: "rgba(200,54,44,0.12)", border: "1px solid rgba(200,54,44,0.25)", color: "#fca5a5", fontSize: 13 }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {sent ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", padding: "8px 0 4px" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(123,181,46,0.15)", border: "1px solid rgba(123,181,46,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MailCheck size={20} color="var(--brand-accent)" />
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.5 }}>{sent}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label htmlFor={`${uid}_email`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 7, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Correo electrónico
                </label>
                <input
                  id={`${uid}_email`} type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="dark-input"
                />
              </div>

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
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link href="/admin/login" style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", textDecoration: "none" }}>
              ← Volver a iniciar sesión
            </Link>
          </div>
        </div>
        <FooterCredit />
      </div>
    </div>
  );
}
