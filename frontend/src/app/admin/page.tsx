"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { getUser } from "@/lib/auth";

interface HealthData {
  status: string;
  services: Record<string, { status: string; latency_ms?: number }>;
}

export default function AdminPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [user, setUser] = useState<{ display_name?: string } | null>(null);

  useEffect(() => {
    apiClient.checkHealth().then(setHealth).catch(() => setHealth(null));
    setUser(getUser());
  }, []);

  return (
    <div>
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-800)] rounded-2xl p-6 mb-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold mb-1">
          Panel de Administración
        </h1>
        <p className="text-green-100 text-sm">
          Bienvenido{user?.display_name ? `, ${user.display_name}` : ""}. Gestiona el chatbot desde aquí.
        </p>
      </div>

      {/* Health Status */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Estado del Sistema</h2>
        {health ? (
          <div className="flex flex-wrap gap-3">
            {Object.entries(health.services).map(([name, svc]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className={`w-2.5 h-2.5 rounded-full ${svc.status === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm font-medium text-gray-700 capitalize">{name}</span>
                {svc.latency_ms != null && (
                  <span className="text-xs text-gray-400">{svc.latency_ms}ms</span>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
              <div className={`w-2.5 h-2.5 rounded-full ${health.status === "healthy" ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-sm font-medium text-gray-700">General: {health.status}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No se pudo conectar con el servidor</p>
        )}
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/admin/documents"
          className="group bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-[var(--primary-400)] transition-all"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Gestión de Documentos</h2>
          <p className="text-sm text-gray-500">
            Subir y administrar documentos académicos para la base de conocimientos.
          </p>
        </Link>

        <Link
          href="/admin/config"
          className="group bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-[var(--primary-400)] transition-all"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Configuración LLM</h2>
          <p className="text-sm text-gray-500">
            Configurar el proveedor de IA (Ollama / OpenAI), modelos y API keys.
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="group bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-[var(--primary-400)] transition-all"
        >
          <div className="w-12 h-12 bg-[var(--primary-100)] rounded-xl flex items-center justify-center mb-4 group-hover:opacity-80 transition-all">
            <svg className="w-6 h-6 text-[var(--primary-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Gestión de Usuarios</h2>
          <p className="text-sm text-gray-500">
            Ver usuarios registrados y gestionar roles de acceso.
          </p>
        </Link>
      </div>
    </div>
  );
}
