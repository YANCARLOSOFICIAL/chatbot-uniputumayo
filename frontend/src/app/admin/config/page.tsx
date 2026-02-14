"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface ProviderInfo {
  name: string;
  models: string[];
  is_available: boolean;
  is_default: boolean;
}

export default function ConfigPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getProviders();
        setProviders(data.providers);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error cargando configuración"
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Configuración del Modelo de IA
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className={`bg-white rounded-xl border-2 p-6 ${
              provider.is_default
                ? "border-green-500"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 capitalize">
                {provider.name}
              </h2>
              <div className="flex items-center gap-2">
                {provider.is_default && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    Activo
                  </span>
                )}
                <span
                  className={`w-3 h-3 rounded-full ${
                    provider.is_available ? "bg-green-500" : "bg-red-500"
                  }`}
                  title={provider.is_available ? "Disponible" : "No disponible"}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Estado
                </span>
                <p className="text-sm text-gray-700">
                  {provider.is_available ? "Conectado" : "Desconectado"}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">
                  Modelos disponibles
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {provider.models.map((model) => (
                    <span
                      key={model}
                      className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {!provider.is_default && provider.is_available && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-4 w-full"
                onClick={() => {
                  // TODO: Switch provider via API
                  alert(`Cambiar a ${provider.name}`);
                }}
              >
                Usar {provider.name}
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Instrucciones de Configuración
        </h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong className="text-gray-800">Ollama (Local):</strong>
            <ol className="list-decimal ml-5 mt-1 space-y-1">
              <li>
                Ejecutar <code className="bg-gray-100 px-1 rounded">docker compose up</code> en el directorio backend
              </li>
              <li>
                Descargar un modelo:{" "}
                <code className="bg-gray-100 px-1 rounded">
                  docker exec iup-chatbot-ollama ollama pull llama3.1:8b
                </code>
              </li>
              <li>
                Descargar modelo de embeddings:{" "}
                <code className="bg-gray-100 px-1 rounded">
                  docker exec iup-chatbot-ollama ollama pull nomic-embed-text
                </code>
              </li>
            </ol>
          </div>
          <div>
            <strong className="text-gray-800">OpenAI (Nube):</strong>
            <ol className="list-decimal ml-5 mt-1 space-y-1">
              <li>Obtener una API key en platform.openai.com</li>
              <li>
                Configurar en <code className="bg-gray-100 px-1 rounded">backend/.env</code>:{" "}
                <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY=sk-...</code>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
