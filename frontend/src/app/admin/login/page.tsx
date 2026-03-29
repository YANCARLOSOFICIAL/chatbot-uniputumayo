"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail, Lock, User, Eye, EyeOff, AlertCircle,
  Sparkles, GraduationCap, ArrowRight, MessageSquare
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-2)]">{label}</label>
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
        <input
          id={id} type={inputType} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className="input-base pl-9 pr-9"
        />
        {showToggle && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors">
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
    <div className="min-h-screen flex bg-[var(--bg)]">

      {/* ── Left Panel (decorative) ── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#f97316] via-[#ef4444] to-[#7c3aed]" />
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[var(--brand)] blur-3xl opacity-25" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-[var(--accent)] blur-3xl opacity-20" />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Top logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-auto">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg">Nexus</span>
          </Link>

          {/* Center content */}
          <div className="py-8 space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-white leading-tight mb-3">
                Bienvenido a<br />UniPutumayo
              </h1>
              <p className="text-white/70 text-base leading-relaxed">
                Accede al asistente virtual más completo de la Institución Universitaria del Putumayo.
              </p>
            </div>

            {/* Feature list */}
            <div className="space-y-4">
              {[
                { icon: MessageSquare, text: "Chat inteligente con IA" },
                { icon: GraduationCap, text: "Información académica actualizada" },
                { icon: Sparkles,      text: "Respuestas precisas 24/7" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-white" />
                  </div>
                  <span className="text-white/80 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="text-white/40 text-xs">© {new Date().getFullYear()} IUP · Nexus IA</p>
        </div>
      </div>

      {/* ── Right Panel (form) ── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-bold text-[var(--text-1)] text-sm">Nexus</span>
          </Link>
          <div className="lg:ml-auto flex items-center gap-3">
            <ThemeToggle size="sm" />
            <Link href="/chat"
              className="flex items-center gap-1.5 text-sm text-[var(--text-3)] hover:text-[var(--brand)] transition-colors">
              Ir al chat <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 pb-8">
          <div className="w-full max-w-sm">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[var(--text-1)] mb-1">
                {tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </h2>
              <p className="text-sm text-[var(--text-3)]">
                {tab === "login"
                  ? "Bienvenido de nuevo al asistente IUP"
                  : "Únete a la comunidad universitaria"}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex p-1 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] mb-6">
              {(["login", "register"] as Tab[]).map((t) => (
                <button key={t} onClick={() => switchTab(t)}
                  className={[
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                    tab === t
                      ? "bg-[var(--surface)] text-[var(--text-1)] shadow-[var(--shadow-xs)] border border-[var(--border)]"
                      : "text-[var(--text-3)] hover:text-[var(--text-1)]",
                  ].join(" ")}
                >
                  {t === "login" ? "Iniciar sesión" : "Registrarse"}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[var(--error-dim)] border border-[var(--error)] border-opacity-30 text-sm text-[var(--error)] mb-5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {/* Login form */}
            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <InputField id={`${uid}_email`} label="Correo electrónico" type="email"
                  value={email} onChange={setEmail} placeholder="correo@ejemplo.com"
                  required icon={Mail} />
                <InputField id={`${uid}_pass`} label="Contraseña" type="password"
                  value={password} onChange={setPassword} placeholder="Tu contraseña"
                  required icon={Lock} showToggle />

                <button type="submit" disabled={loading}
                  className="btn btn-primary w-full py-3 text-base mt-2">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Ingresando…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Iniciar sesión <ArrowRight size={16} />
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
                  className="btn btn-primary w-full py-3 text-base mt-2">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Registrando…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Crear cuenta <ArrowRight size={16} />
                    </span>
                  )}
                </button>
              </form>
            )}

            {/* Footer */}
            <p className="text-center text-xs text-[var(--text-4)] mt-6">
              {tab === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
              <button onClick={() => switchTab(tab === "login" ? "register" : "login")}
                className="text-[var(--brand)] hover:text-[var(--brand-hover)] font-medium transition-colors">
                {tab === "login" ? "Regístrate" : "Inicia sesión"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
