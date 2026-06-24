"use client";

import { useState, useId, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";
import { FooterCredit } from "@/components/ui/SiteFooter";
type Tab = "login" | "register";

function DarkInputField({
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
      {label && (
        <label htmlFor={id} style={{
          display: "block", fontSize: 12, fontWeight: 600,
          color: "rgba(255,255,255,0.65)", marginBottom: 7,
          letterSpacing: "0.04em", textTransform: "uppercase",
        }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          id={id} type={inputType} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="dark-input"
          autoComplete={type === "password" ? "new-password" : "off"}
          style={{ paddingRight: showToggle ? 42 : undefined }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center",
              padding: 4,
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

  // Limpia los campos al montar para evitar que el navegador
  // rellene automáticamente con credenciales de sesiones previas
  useEffect(() => {
    setEmail(""); setPassword(""); setConfirmPassword(""); setDisplayName("");
  }, []);

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
      const res = await apiClient.register(email, password, displayName);
      setToken(res.access_token); setUser(res.user);
      router.push(res.user.role === "admin" ? "/admin" : "/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally { setLoading(false); }
  };

  const switchTab = (t: Tab) => {
    setTab(t); setError(null);
    setEmail(""); setPassword(""); setConfirmPassword(""); setDisplayName("");
  };

  const BULLETS = [
    "Catalogo oficial de programas 2026",
    "Respuestas verificadas con fuentes",
    "Voz y texto, disponible 24 horas",
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#071824", display: "flex" }}>

      {/* Left panel — brand showcase */}
      <div
        className="hidden md:flex"
        style={{
          width: "58%", flexShrink: 0, position: "relative",
          overflow: "hidden", flexDirection: "column", justifyContent: "center",
          padding: "60px 56px",
        }}
      >
        {/* Campus background */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url('/hero-fondo.png')",
          backgroundSize: "cover", backgroundPosition: "center",
        }} />
        {/* Overlay — lighter so campus shows through */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, rgba(7,24,36,0.72) 0%, rgba(11,52,71,0.62) 55%, rgba(27,110,148,0.30) 100%)",
        }} />
        {/* Accent blob */}
        <div style={{
          position: "absolute", bottom: "10%", right: "-5%",
          width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,181,46,0.08), transparent 70%)",
          filter: "blur(50px)", pointerEvents: "none",
        }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 440 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
            <Image src="/isotipo.webp" alt="Guaca" width={48} height={48} style={{ objectFit: "contain" }} />
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1 }}>Guaca</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>UniPutumayo</div>
            </div>
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px,3vw,48px)",
            fontWeight: 900, color: "#fff",
            lineHeight: 1.0, letterSpacing: "-0.04em",
            margin: "0 0 14px", textWrap: "balance",
          }}>
            La guia academica<br />
            del <span style={{ color: "var(--brand-primary)" }}>Putumayo.</span>
          </h2>

          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: "0 0 36px" }}>
            Respuestas verificadas del catalogo oficial. Sin filas, sin formularios.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {BULLETS.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(123,181,46,0.15)", border: "1px solid rgba(123,181,46,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Check size={10} color="var(--brand-accent)" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.65)" }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        background: "#0F1E2A", minHeight: "100dvh",
      }}>
        {/* Form area — centered, fills available space */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "48px 40px" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>

          {/* Logo mobile only */}
          <div className="md:hidden" style={{ textAlign: "center", marginBottom: 32 }}>
            <Image src="/isotipo.webp" alt="Guaca" width={40} height={40} style={{ objectFit: "contain", margin: "0 auto" }} />
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 24, fontWeight: 800, color: "#fff",
            letterSpacing: "-0.02em", margin: "0 0 6px",
          }}>
            Accede a Guaca
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.58)", margin: "0 0 28px" }}>
            Inicia sesion o crea tu cuenta para guardar tu historial
          </p>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 28 }}>
            <button className={`dark-tab${tab === "login" ? " active" : ""}`} onClick={() => switchTab("login")}>
              Iniciar sesion
            </button>
            <button className={`dark-tab${tab === "register" ? " active" : ""}`} onClick={() => switchTab("register")}>
              Registrarse
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 12px", borderRadius: 8, marginBottom: 20,
              background: "rgba(200,54,44,0.12)", border: "1px solid rgba(200,54,44,0.25)",
              color: "#fca5a5", fontSize: 13,
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <DarkInputField
                id={`${uid}_email`} label="Correo electronico" type="email"
                value={email} onChange={setEmail}
                placeholder="admin@itp.edu.co" required
              />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    Contrasena
                  </label>
                </div>
                <DarkInputField
                  id={`${uid}_pass`} type="password"
                  value={password} onChange={setPassword}
                  placeholder="Minimo 6 caracteres" required showToggle
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "13px", borderRadius: 10,
                  background: "var(--brand-accent)", color: "#fff", border: "none",
                  fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", marginTop: 8,
                  opacity: loading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background 0.15s",
                }}
              >
                {loading ? (
                  <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                    {[0, 0.12, 0.24].map((d) => (
                      <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
                    ))}
                  </span>
                ) : "Iniciar sesion"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <DarkInputField
                id={`${uid}_name`} label="Nombre completo" type="text"
                value={displayName} onChange={setDisplayName}
                placeholder="Tu nombre" required
              />
              <DarkInputField
                id={`${uid}_email2`} label="Correo electronico" type="email"
                value={email} onChange={setEmail}
                placeholder="correo@ejemplo.com" required
              />
              <DarkInputField
                id={`${uid}_pass2`} label="Contrasena" type="password"
                value={password} onChange={setPassword}
                placeholder="Minimo 6 caracteres" required showToggle
              />
              <DarkInputField
                id={`${uid}_conf`} label="Confirmar contrasena" type="password"
                value={confirmPassword} onChange={setConfirmPassword}
                placeholder="Repite tu contrasena" required showToggle
              />

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "13px", borderRadius: 10,
                  background: "var(--brand-accent)", color: "#fff", border: "none",
                  fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", marginTop: 6,
                  opacity: loading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background 0.15s",
                }}
              >
                {loading ? (
                  <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                    {[0, 0.12, 0.24].map((d) => (
                      <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
                    ))}
                  </span>
                ) : "Crear cuenta"}
              </button>
            </form>
          )}

          {/* Continue without account */}
          <div style={{ marginTop: 20, position: "relative" }}>
            <div style={{ position: "absolute", inset: "50% 0 auto", borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            <span style={{ position: "relative", background: "#0F1E2A", padding: "0 10px", fontSize: 11, color: "rgba(255,255,255,0.45)", display: "flex", justifyContent: "center" }}>
              o
            </span>
          </div>
          <button
            onClick={() => router.push("/chat")}
            style={{
              width: "100%", padding: "11px", borderRadius: 10, marginTop: 16,
              background: "transparent", color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.75)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
          >
            Continuar sin cuenta
          </button>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <Link href="/" style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", textDecoration: "none" }}>
              ← Volver al inicio
            </Link>
          </div>
        </div>
        </div>
        {/* Crédito compacto al pie del panel derecho */}
        <FooterCredit />
      </div>
    </div>
  );
}
