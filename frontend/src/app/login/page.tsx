"use client";

import { useState, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";

type Tab = "login" | "register";

function InputField({
  id, label, type = "text", value, onChange, placeholder, required, showToggle,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder: string; required?: boolean;
  showToggle?: boolean;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" && show ? "text" : type;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id} type={inputType} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="input"
          style={{ width: "100%", paddingRight: showToggle ? 42 : undefined, boxSizing: "border-box" }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-3)", display: "flex", alignItems: "center", padding: 4,
            }}
          >
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const uid = useId();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await apiClient.login(email, password);
      setToken(res.access_token); setUser(res.user);
      router.push(res.user.role === "admin" ? "/admin" : "/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesion");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError("Las contrasenas no coinciden");
    if (password.length < 6) return setError("La contrasena debe tener al menos 6 caracteres");
    setLoading(true); setError(null);
    try {
      const res = await apiClient.register(email, password, displayName || email.split("@")[0]);
      setToken(res.access_token); setUser(res.user);
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally { setLoading(false); }
  };

  const switchTab = (t: Tab) => {
    setTab(t); setError(null);
    setEmail(""); setPassword(""); setConfirmPassword(""); setDisplayName("");
  };

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>

      {/* Back link */}
      <Link href="/" style={{
        position: "fixed", top: 20, left: 20,
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 13, color: "var(--text-3)", textDecoration: "none",
        transition: "color 0.15s",
      }} className="hover:text-[var(--text-1)]">
        <ArrowLeft size={14} />
        Inicio
      </Link>

      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <Image src="/isotipo.webp" alt="Nexus" width={40} height={40} style={{ objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>
              Nexus
            </span>
          </Link>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 8, margin: "8px 0 0" }}>
            UniPutumayo · Asistente academico
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "28px 28px 24px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", margin: "0 0 4px" }}>
            {tab === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 24px" }}>
            {tab === "login" ? "Accede a tu historial de conversaciones." : "Guarda tu historial y personaliza tu experiencia."}
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  padding: "8px 16px", background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  color: tab === t ? "var(--brand-primary)" : "var(--text-3)",
                  borderBottom: tab === t ? "2px solid var(--brand-primary)" : "2px solid transparent",
                  marginBottom: -1, transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {t === "login" ? "Iniciar sesion" : "Registrarse"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: 8, marginBottom: 20,
              background: "var(--error-dim)", border: "1px solid rgba(200,54,44,0.2)",
              color: "var(--error)", fontSize: 13,
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <InputField
                id={`${uid}_email`} label="Correo electronico" type="email"
                value={email} onChange={setEmail}
                placeholder="tu@correo.com" required
              />
              <InputField
                id={`${uid}_pass`} label="Contrasena" type="password"
                value={password} onChange={setPassword}
                placeholder="Tu contrasena" required showToggle
              />
              <button type="submit" disabled={loading} className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? (
                  <span style={{ display: "inline-flex", gap: 3 }}>
                    {[0, 0.12, 0.24].map((d) => (
                      <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
                    ))}
                  </span>
                ) : "Iniciar sesion"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField
                id={`${uid}_name`} label="Nombre completo" type="text"
                value={displayName} onChange={setDisplayName}
                placeholder="Tu nombre" required
              />
              <InputField
                id={`${uid}_email2`} label="Correo electronico" type="email"
                value={email} onChange={setEmail}
                placeholder="tu@correo.com" required
              />
              <InputField
                id={`${uid}_pass2`} label="Contrasena" type="password"
                value={password} onChange={setPassword}
                placeholder="Minimo 6 caracteres" required showToggle
              />
              <InputField
                id={`${uid}_conf`} label="Confirmar contrasena" type="password"
                value={confirmPassword} onChange={setConfirmPassword}
                placeholder="Repite tu contrasena" required showToggle
              />
              <button type="submit" disabled={loading} className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}>
                {loading ? (
                  <span style={{ display: "inline-flex", gap: 3 }}>
                    {[0, 0.12, 0.24].map((d) => (
                      <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
                    ))}
                  </span>
                ) : "Crear cuenta"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button
              onClick={() => router.push("/chat")}
              style={{ fontSize: 12, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Continuar sin cuenta
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-3)", marginTop: 16 }}>
          Eres administrador?{" "}
          <Link href="/admin/login" style={{ color: "var(--brand-primary)", textDecoration: "none", fontWeight: 600 }}>
            Acceso admin
          </Link>
        </p>
      </div>
    </div>
  );
}
