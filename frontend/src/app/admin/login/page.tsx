"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";

type Tab = "login" | "register";

function InputField({
  id, label, type = "text", value, onChange, placeholder, required, icon: Icon, showToggle,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder: string; required?: boolean;
  icon: React.ElementType; showToggle?: boolean;
}) {
  const [show, setShow] = useState(false);
  const inputType = type === "password" && show ? "text" : type;

  return (
    <div>
      {label && <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <Icon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
        <input
          id={id} type={inputType} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="input"
          style={{ paddingLeft: 36, paddingRight: showToggle ? 36 : undefined }}
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
    <div style={{ minHeight: "100vh", display: "flex", position: "relative", overflow: "hidden" }}>
      {/* Left panel — hero */}
      <div className="campus-panel hidden md:flex" style={{ flex: 1, padding: "64px 48px", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <img src="/logo-azul.png" alt="UniPutumayo" style={{ height: 48, filter: "brightness(0) invert(1)", objectFit: "contain", marginBottom: 40 }} />
          <div className="eyebrow-band" style={{ color: "var(--accent)", marginBottom: 12 }}>NEXUS UNIPUTUMAYO</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(32px, 3.5vw, 44px)", fontWeight: 800,
            color: "#fff", lineHeight: 1.1, marginTop: 0, marginBottom: 16, letterSpacing: "-0.02em"
          }}>
            Tu guía académica,<br />en cualquier momento.
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", maxWidth: 420, lineHeight: 1.6, margin: 0 }}>
            Conversa con Nexus, una guacamaya que conoce a fondo cada programa, sede y trámite de UniPutumayo.
          </p>
          <div style={{ marginTop: 40, display: "flex", gap: 16 }}>
            <img src="/logo-vigilada.png" alt="Vigilada Mineducación" style={{ height: 48, objectFit: "contain" }} />
          </div>
        </div>
      </div>

      {/* Right panel — login card */}
      <div className="w-full md:max-w-[480px] bg-[var(--surface)] flex items-center justify-center p-6 sm:p-9 relative z-10 shadow-[-8px_0_40px_rgba(11,52,71,0.12)]">
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Mobile logo */}
          <div className="md:hidden" style={{ textAlign: "center", marginBottom: 24 }}>
            <img src="/logo-azul.png" alt="UniPutumayo" style={{ height: 44, objectFit: "contain" }} />
          </div>

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "var(--text-1)" }}>
            Inicia sesión en Nexus
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>
            Acceso para estudiantes, aspirantes y administradores
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
            {(["login", "register"] as Tab[]).map((t) => (
              <button key={t} onClick={() => switchTab(t)} style={{
                flex: 1, paddingBottom: 10, fontSize: 13, fontWeight: 500, cursor: "pointer",
                background: "none", border: "none", color: tab === t ? "var(--text-1)" : "var(--text-3)",
                borderBottom: tab === t ? "2px solid var(--brand-primary)" : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                {t === "login" ? "Iniciar sesión" : "Registrarse"}
              </button>
            ))}
          </div>

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
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField id={`${uid}_email`} label="Correo o documento" type="email"
                value={email} onChange={setEmail} placeholder="estudiante@itp.edu.co"
                required icon={Mail} />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Contraseña</label>
                  <a href="#" style={{ fontSize: 12, color: "var(--brand-primary)" }}>¿La olvidaste?</a>
                </div>
                <InputField id={`${uid}_pass`} label="" type="password"
                  value={password} onChange={setPassword} placeholder="••••••••"
                  required icon={Lock} showToggle />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-2)" }}>
                <input type="checkbox" style={{ accentColor: "var(--brand-primary)" }} /> Mantener mi sesión iniciada
              </label>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "12px 18px", marginTop: 4, justifyContent: "center" }}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg style={{ width: 14, height: 14, animation: "spin 0.8s linear infinite" }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Ingresando…
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    Iniciar sesión <ArrowRight size={14} />
                  </span>
                )}
              </button>

              <div style={{ textAlign: "center", margin: "4px 0", fontSize: 12, color: "var(--text-3)", position: "relative" }}>
                <span style={{ background: "#fff", padding: "0 12px", position: "relative", zIndex: 1 }}>o continúa con</span>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "var(--border)" }} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button type="button" className="btn btn-secondary flex-1 justify-center">SIGEDIN</button>
                <button type="button" className="btn btn-secondary flex-1 justify-center">Microsoft 365</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InputField id={`${uid}_name`} label="Nombre completo" type="text"
                value={displayName} onChange={setDisplayName} placeholder="Tu nombre completo"
                required icon={User} />
              <InputField id={`${uid}_email2`} label="Correo electrónico" type="email"
                value={email} onChange={setEmail} placeholder="correo@ejemplo.com"
                required icon={Mail} />
              <InputField id={`${uid}_pass2`} label="Contraseña" type="password"
                value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres"
                required icon={Lock} showToggle />
              <InputField id={`${uid}_conf`} label="Confirmar contraseña" type="password"
                value={confirmPassword} onChange={setConfirmPassword} placeholder="Repite tu contraseña"
                required icon={Lock} showToggle />
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "12px 18px", justifyContent: "center" }}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg style={{ width: 14, height: 14, animation: "spin 0.8s linear infinite" }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Registrando…
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    Crear cuenta <ArrowRight size={14} />
                  </span>
                )}
              </button>
            </form>
          )}

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-2)", marginTop: 20 }}>
            {tab === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button onClick={() => switchTab(tab === "login" ? "register" : "login")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand-primary)", fontWeight: 600, fontSize: 13 }}>
              {tab === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Link href="/" style={{ fontSize: 12, textDecoration: "none" }}
              className="text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors inline-flex items-center gap-1.5 px-3 py-2 rounded-md">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
