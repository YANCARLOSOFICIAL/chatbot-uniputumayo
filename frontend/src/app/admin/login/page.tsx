"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { setToken, setUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

type Tab = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.login(email, password);
      setToken(res.access_token);
      setUser(res.user);
      if (res.user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/chat");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.register(email, password, displayName);
      setToken(res.access_token);
      setUser(res.user);
      if (res.user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/chat");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-800)] text-white flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-3">Nexus Uniputumayo</h1>
          <p className="text-lg text-green-100 mb-2">
            Institución Universitaria del Putumayo
          </p>
          <p className="text-sm text-green-200/80">
            Asistente virtual inteligente para información académica, programas, admisiones y más.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Nexus Uniputumayo</h1>
            <p className="text-sm text-gray-500">Universidad del Putumayo</p>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-200 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setTab("login"); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                tab === "login"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setTab("register"); setError(null); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                tab === "register"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Registrarse
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-500)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-500)] focus:outline-none"
                />
              </div>
              <Button type="submit" disabled={loading} size="lg" className="w-full">
                {loading ? <><Spinner size="sm" className="mr-2" /> Ingresando...</> : "Iniciar Sesión"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-500)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-500)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-500)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-500)] focus:outline-none"
                />
              </div>
              <Button type="submit" disabled={loading} size="lg" className="w-full">
                {loading ? <><Spinner size="sm" className="mr-2" /> Registrando...</> : "Registrarse"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
