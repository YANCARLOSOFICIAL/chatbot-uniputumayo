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
    <div className="auth-field">
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <div className="auth-input-wrap">
        <input
          id={id} type={inputType} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="input"
          autoComplete={type === "password" ? "new-password" : "off"}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={show}
            className="auth-input-toggle"
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

  const switchTab = (t: Tab) => {
    setTab(t); setError(null);
    setEmail(""); setPassword(""); setConfirmPassword(""); setDisplayName("");
  };

  const BULLETS = [
    "Catálogo oficial de programas 2026",
    "Respuestas verificadas con fuentes",
    "Voz y texto, disponible 24 horas",
  ];

  return (
    <div className="auth-page">

      {/* Panel de marca — solo desktop */}
      <div className="auth-brand-panel">
        <Image
          src="/estudiantes.jpg"
          alt=""
          fill
          sizes="54vw"
          priority
          style={{ objectFit: "cover" }}
        />

        <div className="auth-brand-content">
          <div className="auth-mark" style={{ marginBottom: 44 }}>
            <Image src="/isotipo.webp" alt="Guaca" width={40} height={40} style={{ objectFit: "contain" }} />
            <div>
              <div className="auth-mark-name" style={{ color: "#F5F3EE" }}>Guaca</div>
              <div className="auth-mark-sub" style={{ color: "rgba(245,243,238,0.5)" }}>UniPutumayo</div>
            </div>
          </div>

          <span className="eyebrow on-dark">Asistente institucional</span>
          <h1 className="display-lg">
            La guía académica<br />del <em>Putumayo</em>.
          </h1>
          <p className="lede">
            Respuestas verificadas del catálogo oficial. Sin filas, sin formularios.
          </p>

          <ul className="auth-bullets">
            {BULLETS.map((b) => (
              <li key={b}>
                <Check size={13} strokeWidth={2.5} />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ position: "relative", zIndex: 1, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,243,238,0.4)" }}>
          Sistema RAG · Institución Universitaria del Putumayo · 2026
        </div>
      </div>

      {/* Formulario */}
      <div className="auth-form-side">
        <div className="auth-form-area">
          <div className="auth-card">

            <div className="auth-mark auth-mark-mobile">
              <Image src="/isotipo.webp" alt="Guaca" width={34} height={34} style={{ objectFit: "contain" }} />
              <div>
                <div className="auth-mark-name">Guaca</div>
                <div className="auth-mark-sub">UniPutumayo</div>
              </div>
            </div>

            <h2>Accede a Guaca</h2>
            <p className="auth-card-sub">
              Inicia sesión o crea tu cuenta para guardar tu historial
            </p>

            <div className="auth-tabs">
              <button
                className={`auth-tab${tab === "login" ? " active" : ""}`}
                onClick={() => switchTab("login")}
                type="button"
              >
                Iniciar sesión
              </button>
              <button
                className={`auth-tab${tab === "register" ? " active" : ""}`}
                onClick={() => switchTab("register")}
                type="button"
              >
                Registrarse
              </button>
            </div>

            {error && (
              <div className="auth-error">
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            {tab === "login" ? (
              <form onSubmit={handleLogin} autoComplete="off">
                <InputField
                  id={`${uid}_email`} label="Correo electrónico" type="email"
                  value={email} onChange={setEmail}
                  placeholder="admin@itp.edu.co" required
                />
                <PasswordField
                  id={`${uid}_pass`}
                  label="Contraseña"
                  value={password}
                  onChange={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  forgotHref="/forgot-password"
                />

                <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
                  {loading ? (
                    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                      {[0, 0.12, 0.24].map((d) => (
                        <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
                      ))}
                    </span>
                  ) : "Iniciar sesión"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} autoComplete="off">
                <InputField
                  id={`${uid}_name`} label="Nombre completo" type="text"
                  value={displayName} onChange={setDisplayName}
                  placeholder="Tu nombre" required
                />
                <InputField
                  id={`${uid}_email2`} label="Correo electrónico" type="email"
                  value={email} onChange={setEmail}
                  placeholder="correo@ejemplo.com" required
                />
                <InputField
                  id={`${uid}_pass2`} label="Contraseña" type="password"
                  value={password} onChange={setPassword}
                  placeholder="Mínimo 6 caracteres" required showToggle
                />
                <InputField
                  id={`${uid}_conf`} label="Confirmar contraseña" type="password"
                  value={confirmPassword} onChange={setConfirmPassword}
                  placeholder="Repite tu contraseña" required showToggle
                />

                <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
                  {loading ? (
                    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                      {[0, 0.12, 0.24].map((d) => (
                        <span key={d} style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
                      ))}
                    </span>
                  ) : "Crear cuenta"}
                </button>
              </form>
            )}

            <div className="auth-divider">o</div>

            <button
              onClick={() => router.push("/chat")}
              className="btn btn-secondary"
              style={{ width: "100%" }}
            >
              Continuar sin cuenta
            </button>

            <div className="auth-foot">
              <Link href="/">← Volver al inicio</Link>
            </div>
          </div>
        </div>

        <FooterCredit />
      </div>
    </div>
  );
}

/** Campo de contraseña con toggle de visibilidad y enlace opcional. */
function PasswordField({
  id, label, value, onChange, placeholder, forgotHref,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder: string; forgotHref?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field" style={{ marginBottom: 18 }}>
      <div className="auth-field-row">
        <label htmlFor={id} className="field-label" style={{ marginBottom: 0 }}>{label}</label>
        {forgotHref && (
          <Link href={forgotHref} className="auth-link-sm">¿Olvidaste tu contraseña?</Link>
        )}
      </div>
      <div className="auth-input-wrap" style={{ marginTop: 6 }}>
        <input
          id={id} type={show ? "text" : "password"} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required
          className="input"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
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
