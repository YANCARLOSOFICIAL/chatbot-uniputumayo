"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Key,
  Cpu, Zap, X, AlertCircle, Check
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";

interface ProviderInfo {
  name: string;
  models: string[];
  is_available: boolean;
  is_default: boolean;
}

const PROVIDER_ICONS: Record<string, string> = {
  ollama: "🦙",
  openai: "✨",
};

const PROVIDER_DESC: Record<string, string> = {
  ollama: "Modelo local ejecutándose en tu servidor. Sin costo, sin latencia de red.",
  openai: "API de OpenAI en la nube. Requiere API key y conexión a internet.",
};

export default function ConfigPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : "Error cargando configuración");
    } finally {
      setLoading(false);
    }
  };

  const loadKeyStatus = async () => {
    try {
      const status = await apiClient.getApiKeyStatus();
      setKeyStatus(status);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadProviders(); loadKeyStatus(); }, []);

  const handleSwitchProvider = async (providerName: string) => {
    setSwitching(providerName); setError(null); setSuccess(null);
    try {
      await apiClient.updateLLMConfig({ default_provider: providerName });
      setSuccess(`Proveedor cambiado a ${providerName}`);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cambiando proveedor");
    } finally { setSwitching(null); }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true); setKeyError(null); setKeySuccess(null);
    try {
      const result = await apiClient.setApiKey("openai", apiKey.trim());
      if (result.is_available) {
        setKeySuccess("API Key guardada y verificada correctamente");
        setApiKey("");
        await loadProviders(); await loadKeyStatus();
        setTimeout(() => setShowKeyModal(false), 1500);
      } else {
        setKeyError("API Key guardada pero el proveedor no está disponible. Verifica la key.");
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Error guardando API Key");
    } finally { setSavingKey(false); }
  };

  const handleUseProvider = (provider: ProviderInfo) => {
    if (provider.name === "openai" && !provider.is_available) { setShowKeyModal(true); return; }
    handleSwitchProvider(provider.name);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-1)]">Configuración del Modelo IA</h1>
        <p className="text-sm text-[var(--text-3)] mt-1">Selecciona y configura el proveedor de inteligencia artificial.</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[var(--error-dim)] border border-[var(--error)] border-opacity-30 text-sm text-[var(--error)]">
          <AlertCircle size={15} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[var(--brand-dim)] border border-[var(--brand)] border-opacity-30 text-sm text-[var(--brand-text)]">
          <Check size={15} className="shrink-0" /> {success}
          <button onClick={() => setSuccess(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className={[
              "bg-[var(--surface)] rounded-2xl border-2 p-6 transition-all",
              provider.is_default
                ? "border-[var(--brand)] shadow-[var(--glow-brand)]"
                : "border-[var(--border)] hover:border-[var(--border-2)]",
            ].join(" ")}
          >
            {/* Active badge */}
            {provider.is_default && (
              <div className="inline-flex items-center gap-1.5 bg-[var(--brand)] text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
                <Zap size={11} /> Proveedor Activo
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{PROVIDER_ICONS[provider.name] ?? "🤖"}</div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-1)] capitalize">{provider.name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {provider.is_available
                      ? <><CheckCircle2 size={12} className="text-[var(--success)]" /><span className="text-xs text-[var(--success)]">Disponible</span></>
                      : <><XCircle size={12} className="text-[var(--error)]" /><span className="text-xs text-[var(--error)]">No disponible</span></>
                    }
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-[var(--text-3)] mb-4 leading-relaxed">
              {PROVIDER_DESC[provider.name] ?? ""}
            </p>

            {/* Models */}
            {provider.models.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-[var(--text-4)] uppercase tracking-wider mb-2">Modelos</p>
                <div className="flex flex-wrap gap-1.5">
                  {provider.models.map((model) => (
                    <span key={model} className="px-2 py-0.5 bg-[var(--surface-3)] text-[var(--text-2)] border border-[var(--border)] rounded-md text-xs font-mono">
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* API Key status (OpenAI) */}
            {provider.name === "openai" && keyStatus && (
              <div className="mb-4 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key size={13} className="text-[var(--text-4)]" />
                    <span className="text-xs text-[var(--text-3)]">
                      {keyStatus.has_key ? keyStatus.masked_key : "No configurada"}
                    </span>
                  </div>
                  <button onClick={() => setShowKeyModal(true)}
                    className="text-xs text-[var(--brand)] hover:text-[var(--brand-hover)] font-medium transition-colors">
                    {keyStatus.has_key ? "Cambiar" : "Configurar"}
                  </button>
                </div>
              </div>
            )}

            {/* Action button */}
            {!provider.is_default && (
              <button
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-2)] bg-[var(--surface-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={!!switching}
                onClick={() => handleUseProvider(provider)}
              >
                {switching === provider.name
                  ? <><Spinner size="sm" /> Cambiando...</>
                  : `Usar ${provider.name}`}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-xs)]">
        <h2 className="text-sm font-semibold text-[var(--text-1)] mb-4 flex items-center gap-2">
          <Cpu size={15} className="text-[var(--brand)]" /> Instrucciones de configuración
        </h2>
        <div className="space-y-4 text-sm text-[var(--text-3)]">
          <div>
            <p className="font-semibold text-[var(--text-2)] mb-1">🦙 Ollama (Local)</p>
            <ol className="list-decimal ml-5 space-y-0.5">
              <li>Ejecutar <code className="bg-[var(--surface-3)] border border-[var(--border)] px-1.5 py-0.5 rounded text-xs font-mono text-[var(--brand)]">docker compose up</code> en el directorio raíz</li>
              <li>Los modelos se descargan automáticamente al iniciar</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-[var(--text-2)] mb-1">✨ OpenAI (Nube)</p>
            <ol className="list-decimal ml-5 space-y-0.5">
              <li>Obtener una API key en platform.openai.com</li>
              <li>Hacer clic en &quot;Configurar API Key&quot; en la tarjeta de OpenAI</li>
            </ol>
          </div>
        </div>
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-xl)] border border-[var(--border)] max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-[var(--text-1)]">Configurar API Key de OpenAI</h3>
              <button onClick={() => { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] transition-all">
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-[var(--text-3)] mb-4">
              Ingresa tu API key de OpenAI. Puedes obtener una en{" "}
              <span className="text-[var(--brand)] font-medium">platform.openai.com</span>
            </p>

            {keyError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--error-dim)] border border-[var(--error)] border-opacity-30 text-sm text-[var(--error)] mb-3">
                <AlertCircle size={13} /> {keyError}
              </div>
            )}
            {keySuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--brand-dim)] border border-[var(--brand)] border-opacity-30 text-sm text-[var(--brand-text)] mb-3">
                <Check size={13} /> {keySuccess}
              </div>
            )}

            <div className="relative mb-5">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]" />
              <input
                type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="input-base pl-9"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-all">
                Cancelar
              </button>
              <button
                disabled={!apiKey.trim() || savingKey}
                onClick={handleSaveApiKey}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {savingKey ? <><Spinner size="sm" /> Verificando...</> : "Guardar y Verificar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
