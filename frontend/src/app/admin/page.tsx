"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

interface HealthData {
  status: string;
  services: Record<string, { status: string; latency_ms?: number }>;
}

export default function AdminPage() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    apiClient.checkHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Panel de Administración
      </h1>

      {/* Health Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Estado del Sistema</h2>
        {health ? (
          <div className="flex flex-wrap gap-4">
            {Object.entries(health.services).map(([name, svc]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <div className={`w-2.5 h-2.5 rounded-full ${svc.status === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm font-medium text-gray-700 capitalize">{name}</span>
                {svc.latency_ms != null && (
                  <span className="text-xs text-gray-400">{svc.latency_ms}ms</span>
                )}
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <div className={`w-2.5 h-2.5 rounded-full ${health.status === "healthy" ? "bg-green-500" : "bg-yellow-500"}`} />
              <span className="text-sm font-medium text-gray-700">General: {health.status}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No se pudo conectar con el servidor</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/admin/documents"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Gestión de Documentos
          </h2>
          <p className="text-sm text-gray-500">
            Subir, ver y administrar documentos académicos para la base de
            conocimientos del chatbot.
          </p>
        </Link>

        <Link
          href="/admin/config"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Configuración LLM
          </h2>
          <p className="text-sm text-gray-500">
            Configurar el proveedor de IA (Ollama / OpenAI), modelos y
            parámetros de generación.
          </p>
        </Link>
      </div>
    </div>
  );
}
