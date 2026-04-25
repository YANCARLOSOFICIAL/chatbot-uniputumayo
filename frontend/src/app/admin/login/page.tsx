"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail, Lock, User, Eye, EyeOff, AlertCircle,
  ArrowRight, ArrowLeft
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";

const IUP_LOGO = "https://itp.edu.co/ITP2022/wp-content/uploads/2026/03/Logo-UNIPUTUMAYO-500px-x-500px-01.png";

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
      <label htmlFor={id} className="block text-[13px] font-medium text-[var(--text-2)] mb-1.5">{label}</label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
        <input
          id={id} type={inputType} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="input-base pl-9 pr-9"
        />
        {showToggle && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
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

  const switchTab = (t: Tab) => { setTab(t); setError(null); };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-5 py-10">
      <div className="w-full max-w-[380px]">

        {/* Logo + branding */}
        <div className="text-center mb-8 animate-fade-up">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <img
              src={IUP_LOGO}
              alt="UNIPUTUMAYO"
              className="h-10 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </Link>
          <h1 className="text-display text-xl text-[var(--text-1)] mb-1">
            {tab === "login" ? "Iniciar sesión en Nexus" : "Crear cuenta"}
          </h1>
          <p className="text-[13px] text-[var(--text-3)]">
            {tab === "login"
              ? "Bienvenido de nuevo"
              : "Únete a la comunidad universitaria"}
          </p>
        </div>

        {/* Tab switcher — underline style */}
        <div className="flex border-b border-[var(--border)] mb-6 animate-fade-up" style={{ animationDelay: ".05s" }}>
          {(["login", "register"] as Tab[]).map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              className={[
                "flex-1 pb-2.5 text-[13px] font-medium transition-all relative",
                tab === t
                  ? "text-[var(--text-1)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]",
              ].join(" ")}
            >
              {t === "login" ? "Iniciar sesión" : "Registrarse"}
              {tab === t && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--brand)] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--error-dim)] border border-[var(--error)]/20 text-[13px] text-[var(--error)] mb-5 animate-shake">
            <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Login form */}
        <div className="animate-fade-up" style={{ animationDelay: ".1s" }}>
          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <InputField id={`${uid}_email`} label="Correo electrónico" type="email"
                value={email} onChange={setEmail} placeholder="correo@ejemplo.com"
                required icon={Mail} />
              <InputField id={`${uid}_pass`} label="Contraseña" type="password"
                value={password} onChange={setPassword} placeholder="Tu contraseña"
                required icon={Lock} showToggle />

              <button type="submit" disabled={loading}
                className="btn btn-primary w-full py-2.5 text-sm mt-3">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Ingresando…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Iniciar sesión <ArrowRight size={14} />
                  </span>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
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

              <button type="submit" disabled={loading}
                className="btn btn-primary w-full py-2.5 text-sm mt-3">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Registrando…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Crear cuenta <ArrowRight size={14} />
                  </span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-[12px] text-[var(--text-3)]">
            {tab === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button onClick={() => switchTab(tab === "login" ? "register" : "login")}
              className="text-[var(--brand)] hover:text-[var(--brand-hover)] font-medium transition-colors">
              {tab === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
          <div className="flex items-center justify-center gap-4 text-[12px] text-[var(--text-3)]">
            <Link href="/" className="hover:text-[var(--text-1)] transition-colors flex items-center gap-1">
              <ArrowLeft size={11} /> Inicio
            </Link>
            <Link href="/chat" className="hover:text-[var(--text-1)] transition-colors">
              Ir al chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
