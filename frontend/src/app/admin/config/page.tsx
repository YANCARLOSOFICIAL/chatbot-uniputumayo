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
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // API Key modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<{ has_key: boolean; masked_key: string | null } | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  const loadProviders = async () => {
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

  const loadKeyStatus = async () => {
    try {
      const status = await apiClient.getApiKeyStatus();
      setKeyStatus(status);
    } catch {
      // Ignore - may not have permission
    }
  };

  useEffect(() => {
    loadProviders();
    loadKeyStatus();
  }, []);

  const handleSwitchProvider = async (providerName: string) => {
    setSwitching(providerName);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.updateLLMConfig({ default_provider: providerName });
      setSuccess(`Proveedor cambiado a ${providerName}`);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cambiando proveedor");
    } finally {
      setSwitching(null);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    setKeyError(null);
    setKeySuccess(null);
    try {
      const result = await apiClient.setApiKey("openai", apiKey.trim());
      if (result.is_available) {
        setKeySuccess("API Key guardada y verificada correctamente");
        setApiKey("");
        await loadProviders();
        await loadKeyStatus();
        setTimeout(() => setShowKeyModal(false), 1500);
      } else {
        setKeyError("API Key guardada pero el proveedor no está disponible. Verifica la key.");
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Error guardando API Key");
    } finally {
      setSavingKey(false);
    }
  };

  const handleUseProvider = (provider: ProviderInfo) => {
    if (provider.name === "openai" && !provider.is_available) {
      setShowKeyModal(true);
      return;
    }
    handleSwitchProvider(provider.name);
  };

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
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className={`bg-white rounded-xl border-2 p-6 transition-all ${
              provider.is_default
                ? "border-[var(--primary-500)] shadow-md"
                : "border-gray-200"
            }`}
          >
            {provider.is_default && (
              <div className="bg-gradient-to-r from-[var(--primary-600)] to-[var(--primary-500)] text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-3">
                Proveedor Activo
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 capitalize">
                {provider.name}
              </h2>
              <span
                className={`w-3 h-3 rounded-full ${
                  provider.is_available ? "bg-green-500" : "bg-red-500"
                }`}
                title={provider.is_available ? "Disponible" : "No disponible"}
              />
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

              {provider.name === "openai" && keyStatus && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    API Key
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-700">
                      {keyStatus.has_key ? keyStatus.masked_key : "No configurada"}
                    </p>
                    <button
                      onClick={() => setShowKeyModal(true)}
                      className="text-xs text-[var(--primary-500)] hover:underline"
                    >
                      {keyStatus.has_key ? "Cambiar" : "Configurar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!provider.is_default && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-4 w-full"
                disabled={switching === provider.name}
                onClick={() => handleUseProvider(provider)}
              >
                {switching === provider.name ? (
                  <><Spinner size="sm" className="mr-2" /> Cambiando...</>
                ) : (
                  `Usar ${provider.name}`
                )}
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configurar API Key de OpenAI
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Ingresa tu API key de OpenAI. Puedes obtener una en{" "}
              <span className="text-[var(--primary-500)]">platform.openai.com</span>
            </p>

            {keyError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 text-sm text-red-700">
                {keyError}
              </div>
            )}
            {keySuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 text-sm text-green-700">
                {keySuccess}
              </div>
            )}

            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--primary-500)] focus:ring-1 focus:ring-[var(--primary-500)] focus:outline-none mb-4"
            />

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => {
                  setShowKeyModal(false);
                  setApiKey("");
                  setKeyError(null);
                  setKeySuccess(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="md"
                className="flex-1"
                disabled={!apiKey.trim() || savingKey}
                onClick={handleSaveApiKey}
              >
                {savingKey ? (
                  <><Spinner size="sm" className="mr-2" /> Verificando...</>
                ) : (
                  "Guardar y Verificar"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Instrucciones de Configuración
        </h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong className="text-gray-800">Ollama (Local):</strong>
            <ol className="list-decimal ml-5 mt-1 space-y-1">
              <li>
                Ejecutar <code className="bg-gray-100 px-1 rounded">docker compose up</code> en el directorio raíz
              </li>
              <li>
                Los modelos se descargan automáticamente al iniciar
              </li>
            </ol>
          </div>
          <div>
            <strong className="text-gray-800">OpenAI (Nube):</strong>
            <ol className="list-decimal ml-5 mt-1 space-y-1">
              <li>Obtener una API key en platform.openai.com</li>
              <li>
                Hacer clic en &quot;Configurar API Key&quot; en la tarjeta de OpenAI arriba
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
