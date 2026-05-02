"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";

type Tab = "login" | "register";

function InputField({
  id, label, type = "text", value, onChange, placeholder, required, showToggle,
}: {
  id: string; label?: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder: string; required?: boolean;
  showToggle?: boolean;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" && show ? "text" : type;

  return (
    <div>
      {label && <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <input
          id={id} type={inputType} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="input w-full"
          style={{ paddingRight: showToggle ? 36 : undefined }}
        />
        {showToggle && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[var(--text-3)] flex items-center justify-center w-9 h-9 hover:text-[var(--brand-primary)] transition-colors">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
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
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    setLoading(true); setError(null);
    try {
      const res = await apiClient.register(email, password, displayName);
      setToken(res.access_token); setUser(res.user);
      router.push(res.user.role === "admin" ? "/admin" : "/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally { setLoading(false); }
  };

  const switchTab = (t: Tab) => { setTab(t); setError(null); setEmail(""); setPassword(""); setConfirmPassword(""); setDisplayName(""); };

  return (
    <div className="campus-panel min-h-screen flex relative overflow-hidden">
      <div className="w-full max-w-[1100px] mx-auto flex flex-col md:flex-row items-center justify-center md:justify-between p-6 md:p-12 z-10 gap-10">
        
        {/* Left panel — hero text */}
        <div className="hidden md:flex flex-col flex-1 max-w-[460px]">
          <div className="eyebrow-band" style={{ color: "var(--accent)", marginBottom: 12 }}>NEXUS UNIPUTUMAYO</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(32px, 3.5vw, 46px)", fontWeight: 800,
            color: "#fff", lineHeight: 1.1, marginTop: 0, marginBottom: 16, letterSpacing: "-0.02em"
          }}>
            Tu guía académica,<br />en cualquier momento.
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, margin: 0 }}>
            Conversa con Nexus, una guacamaya que conoce a fondo cada programa, sede y trámite de UniPutumayo.
          </p>
        </div>

        {/* Right panel — login card */}
        <div className="w-full md:w-[440px] bg-white rounded-[1.25rem] p-8 shadow-2xl relative flex-shrink-0">
          
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <img src="/logo-azul.png" alt="UniPutumayo" style={{ height: 40, objectFit: "contain", margin: "0 auto" }} />
          </div>

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, margin: "0 0 6px", color: "#111827", textAlign: "center", letterSpacing: "-0.01em" }}>
            {tab === "login" ? "Inicia sesión en Nexus" : "Regístrate en Nexus"}
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 28, textAlign: "center" }}>
            Acceso para estudiantes, aspirantes y administradores
          </p>

          {/* Error */}
          {error && (
            <div className="animate-shake" style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: "var(--r)", marginBottom: 18,
              background: "#FBE7E5", border: "1px solid rgba(200,54,44,0.2)", color: "#C8362C", fontSize: 13
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <InputField id={`${uid}_email`} label="Correo o documento" type="email"
                value={email} onChange={setEmail} placeholder="estudiante@itp.edu.co"
                required />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label htmlFor={`${uid}_pass`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Contraseña</label>
                  <a href="#" style={{ fontSize: 12, color: "var(--brand-primary)" }}>¿La olvidaste?</a>
                </div>
                <InputField id={`${uid}_pass`} label="" type="password"
                  value={password} onChange={setPassword} placeholder="••••••••"
                  required showToggle />
              </div>
              
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)", marginTop: -2 }}>
                <input type="checkbox" style={{ accentColor: "var(--brand-primary)" }} /> Mantener mi sesión iniciada
              </label>

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "12px 18px", marginTop: 4, justifyContent: "center", borderRadius: "8px" }}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg style={{ width: 14, height: 14, animation: "spin 0.8s linear infinite" }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Ingresando…
                  </span>
                ) : (
                  <span>Iniciar sesión</span>
                )}
              </button>


            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <InputField id={`${uid}_name`} label="Nombre completo" type="text"
                value={displayName} onChange={setDisplayName} placeholder="Tu nombre completo"
                required />
              <InputField id={`${uid}_email2`} label="Correo electrónico" type="email"
                value={email} onChange={setEmail} placeholder="correo@ejemplo.com"
                required />
              <InputField id={`${uid}_pass2`} label="Contraseña" type="password"
                value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres"
                required showToggle />
              <InputField id={`${uid}_conf`} label="Confirmar contraseña" type="password"
                value={confirmPassword} onChange={setConfirmPassword} placeholder="Repite tu contraseña"
                required showToggle />
              
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "12px 18px", marginTop: 4, justifyContent: "center", borderRadius: "8px" }}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg style={{ width: 14, height: 14, animation: "spin 0.8s linear infinite" }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Registrando…
                  </span>
                ) : (
                  <span>Crear cuenta</span>
                )}
              </button>
            </form>
          )}

          <div style={{ textAlign: "center", fontSize: 13, color: "var(--text-2)", marginTop: 24 }}>
            {tab === "login" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button onClick={() => switchTab(tab === "login" ? "register" : "login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-primary)", fontWeight: 600, fontSize: 13, padding: 0 }}>
              {tab === "login" ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </div>
          
          <div style={{ textAlign: "center", marginTop: 24, position: "absolute", bottom: -40, left: 0, right: 0 }}>
            <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
              className="hover:text-white transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
