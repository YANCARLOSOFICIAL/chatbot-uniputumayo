"use client";

import { useState, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";
import { Spinner } from "@/components/ui/Spinner";

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
          color: "rgba(255,255,255,0.5)", marginBottom: 7,
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
        {/* Heavy dark overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, rgba(7,24,36,0.97) 0%, rgba(11,52,71,0.94) 60%, rgba(27,110,148,0.5) 100%)",
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
            <Image src="/isotipo.webp" alt="Nexus" width={48} height={48} style={{ objectFit: "contain" }} />
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1 }}>Nexus</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>UniPutumayo</div>
            </div>
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(30px,3vw,44px)",
            fontWeight: 900, color: "#fff",
            lineHeight: 1.05, letterSpacing: "-0.03em",
            margin: "0 0 14px",
          }}>
            Panel de administracion<br />
            <span style={{ color: "#1B6E94" }}>UniPutumayo.</span>
          </h2>

          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: "0 0 36px" }}>
            Gestiona documentos, usuarios y el catalogo institucional de Nexus.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {BULLETS.map((b) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(123,181,46,0.15)", border: "1px solid rgba(123,181,46,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Check size={10} color="#7BB52E" strokeWidth={2.5} />
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
        justifyContent: "center", alignItems: "center",
        padding: "48px 40px", background: "#0F1E2A",
        minHeight: "100dvh",
      }}>
        <div style={{ width: "100%", maxWidth: 360 }}>

          {/* Logo mobile only */}
          <div className="md:hidden" style={{ textAlign: "center", marginBottom: 32 }}>
            <Image src="/isotipo.webp" alt="Nexus" width={40} height={40} style={{ objectFit: "contain", margin: "0 auto" }} />
          </div>

          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 24, fontWeight: 800, color: "#fff",
            letterSpacing: "-0.02em", margin: "0 0 6px",
          }}>
            Bienvenido de vuelta
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "0 0 28px" }}>
            Accede al panel de administracion de Nexus
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
              color: "#f87171", fontSize: 13,
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <DarkInputField
                id={`${uid}_email`} label="Correo electronico" type="email"
                value={email} onChange={setEmail}
                placeholder="admin@itp.edu.co" required
              />
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
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
                  background: "#7BB52E", color: "#fff", border: "none",
                  fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", marginTop: 8,
                  opacity: loading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background 0.15s",
                }}
              >
                {loading ? <><Spinner size="sm" /> Ingresando</> : "Iniciar sesion"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                  background: "#7BB52E", color: "#fff", border: "none",
                  fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer", marginTop: 6,
                  opacity: loading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background 0.15s",
                }}
              >
                {loading ? <><Spinner size="sm" /> Registrando</> : "Crear cuenta"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 32, textAlign: "center" }}>
            <Link href="/" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
              Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
