"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, Key, Server, Cloud,
  Zap, X, AlertCircle, Check, RefreshCw
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Spinner } from "@/components/ui/Spinner";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface ProviderInfo {
  name: string;
  models: string[];
  is_available: boolean;
  is_default: boolean;
  default_model: string;
}

const PROVIDER_ICONS: Record<string, React.ElementType> = {
  ollama: Server,
  openai: Cloud,
};

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Ollama (Local)",
  openai: "OpenAI (Nube)",
};

const PROVIDER_DESC: Record<string, string> = {
  ollama: "Modelos ejecutándose en tu servidor. Sin costo, sin latencia de red.",
  openai: "API de OpenAI en la nube. Requiere API key y conexión a internet.",
};

export default function ConfigPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<{ has_key: boolean; masked_key: string | null } | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  // Proveedor y modelo activos globalmente
  const activeProvider = providers.find((p) => p.is_default);

  const loadProviders = useCallback(async () => {
    try {
      const data = await apiClient.getProviders();
      setProviders(data.providers as ProviderInfo[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando configuración");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadKeyStatus = useCallback(async () => {
    try {
      const status = await apiClient.getApiKeyStatus();
      setKeyStatus(status);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadProviders(); loadKeyStatus(); }, [loadProviders, loadKeyStatus]);

  // Cambia proveedor Y modelo en una sola llamada
  const handleSelectModel = async (providerName: string, model: string) => {
    setSwitching(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.updateLLMConfig({ default_provider: providerName, default_model: model });
      setSuccess(`Modelo activo: ${providerName} / ${model}`);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando modelo");
    } finally {
      setSwitching(false); }
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
        setKeyError("API Key guardada pero no pudo verificarse. Revisa que sea válida.");
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Error guardando API Key");
    } finally { setSavingKey(false); }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Configuración IA"
        subtitle="El modelo seleccionado orquesta el chat, RAG y extracción de documentos."
        action={
          <button
            onClick={() => { setLoading(true); loadProviders(); }}
            disabled={loading}
            title="Actualizar lista de modelos"
            className="flex items-center gap-1.5 text-[12px] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border)]"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        }
      />

    <div className="space-y-5" style={{ padding: "28px 32px 48px", flex: 1 }}>

      {/* Modelo activo (banner) */}
      {activeProvider && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--brand-dim)] border border-[var(--brand-primary)]/20">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center text-white flex-shrink-0">
            <Zap size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-text)] opacity-70">
              Modelo activo
            </p>
            <p className="text-[14px] font-semibold text-[var(--brand-text)]">
              {PROVIDER_LABELS[activeProvider.name] ?? activeProvider.name}
              <span className="mx-1.5 opacity-40">/</span>
              <span className="font-mono">{activeProvider.default_model}</span>
            </p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--error-dim)] border border-[var(--error)]/20 text-[13px] text-[var(--error)]">
          <AlertCircle size={14} className="shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--brand-dim)] border border-[var(--brand-primary)]/20 text-[13px] text-[var(--brand-text)]">
          <Check size={14} className="shrink-0" /> {success}
          <button onClick={() => setSuccess(null)} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* Tarjetas de proveedores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => {
          const ProvIcon = PROVIDER_ICONS[provider.name] ?? Server;
          const isActiveProvider = provider.is_default;

          return (
            <div
              key={provider.name}
              className={[
                "bg-[var(--surface)] rounded-xl border-2 p-5 transition-all",
                isActiveProvider
                  ? "border-[var(--brand-primary)] shadow-[var(--glow-brand)]"
                  : "border-[var(--border)] hover:border-[var(--border-2)]",
              ].join(" ")}
            >
              {/* Cabecera */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={[
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    isActiveProvider
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-[var(--surface-3)] text-[var(--text-2)]",
                  ].join(" ")}>
                    <ProvIcon size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-1)]">
                      {PROVIDER_LABELS[provider.name] ?? provider.name}
                    </h2>
                    <div className="flex items-center gap-1 mt-0.5">
                      {provider.is_available
                        ? <><CheckCircle2 size={11} className="text-[var(--success)]" /><span className="text-[11px] text-[var(--success)]">Disponible</span></>
                        : <><XCircle size={11} className="text-[var(--error)]" /><span className="text-[11px] text-[var(--error)]">No disponible</span></>
                      }
                      {isActiveProvider && (
                        <span className="ml-1 inline-flex items-center gap-0.5 bg-[var(--brand-primary)] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                          <Zap size={8} /> Activo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[12px] text-[var(--text-2)] mb-3 leading-relaxed">
                {PROVIDER_DESC[provider.name] ?? ""}
              </p>

              {/* API Key (solo OpenAI) */}
              {provider.name === "openai" && (
                <div className="mb-3 p-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Key size={12} className="text-[var(--text-3)]" />
                      <span className="text-[11px] text-[var(--text-2)]">
                        {keyStatus?.has_key ? keyStatus.masked_key : "API Key no configurada"}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowKeyModal(true)}
                      className="text-[11px] text-[var(--brand-primary)] hover:text-[var(--brand-hover)] font-medium transition-colors"
                    >
                      {keyStatus?.has_key ? "Cambiar" : "Configurar"}
                    </button>
                  </div>
                </div>
              )}

              {/* Selector de modelos */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-2">
                  {provider.models.length === 0
                    ? provider.name === "ollama"
                      ? "Ningún modelo instalado — reinicia el servidor para descargar"
                      : "Sin modelos disponibles"
                    : "Seleccionar modelo"
                  }
                </p>

                {provider.models.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {provider.models.map((model) => {
                      const isActiveModel = isActiveProvider && provider.default_model === model;
                      const canSelect = provider.is_available && !switching;

                      return (
                        <button
                          key={model}
                          disabled={!canSelect || isActiveModel}
                          onClick={() => handleSelectModel(provider.name, model)}
                          title={
                            !provider.is_available
                              ? provider.name === "openai"
                                ? "Configura la API Key primero"
                                : "Ollama no disponible"
                              : isActiveModel
                              ? "Modelo activo"
                              : `Activar ${model}`
                          }
                          className={[
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-mono border transition-all",
                            isActiveModel
                              ? "bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] cursor-default shadow-sm"
                              : canSelect
                              ? "bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] cursor-pointer"
                              : "bg-[var(--surface-2)] text-[var(--text-3)] border-[var(--border)] opacity-50 cursor-not-allowed",
                          ].join(" ")}
                        >
                          {isActiveModel && <Check size={11} strokeWidth={2.5} />}
                          {switching && !isActiveModel
                            ? <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin inline-block" />
                            : null
                          }
                          {model}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  provider.name === "ollama" && (
                    <p className="text-[12px] text-[var(--text-3)] italic">
                      Reinicia los contenedores Docker para descargar{" "}
                      <code className="font-mono not-italic">{"{ollama_default_model}"}</code>{" "}
                      y{" "}
                      <code className="font-mono not-italic">{"{ollama_vision_model}"}</code>{" "}
                      automáticamente.
                    </p>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instrucciones */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5">
        <h2 className="text-[13px] font-semibold text-[var(--text-1)] mb-3 flex items-center gap-1.5">
          <Server size={13} className="text-[var(--brand-primary)]" /> Instrucciones
        </h2>
        <div className="space-y-3 text-[13px] text-[var(--text-2)]">
          <div>
            <p className="font-medium text-[var(--text-1)] mb-1">Ollama (Local)</p>
            <ol className="list-decimal ml-5 space-y-0.5">
              <li>Ejecutar <code className="bg-[var(--surface-3)] border border-[var(--border)] px-1 py-0.5 rounded text-[11px] font-mono text-[var(--brand-primary)]">docker compose up</code> en el directorio raíz</li>
              <li>Los modelos <code className="font-mono text-[11px]">qwen3:8b</code> y <code className="font-mono text-[11px]">gemma4:e4b</code> se descargan automáticamente al iniciar</li>
              <li>Haz clic en <strong>Actualizar</strong> arriba después de que terminen de descargar</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-[var(--text-1)] mb-1">OpenAI (Nube)</p>
            <ol className="list-decimal ml-5 space-y-0.5">
              <li>Obtener una API key en <span className="font-medium text-[var(--brand-primary)]">platform.openai.com</span></li>
              <li>Clic en &quot;Configurar&quot; en la sección de API Key de la tarjeta OpenAI</li>
              <li>Una vez configurada, selecciona el modelo deseado</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Modal API Key */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[var(--surface)] rounded-xl shadow-[var(--shadow-xl)] border border-[var(--border)] max-w-md w-full p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-1)]">API Key de OpenAI</h3>
              <button
                onClick={() => { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[13px] text-[var(--text-2)] mb-4">
              Ingresa tu API key. Puedes obtener una en{" "}
              <span className="text-[var(--brand-primary)] font-medium">platform.openai.com</span>
            </p>

            {keyError && (
              <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-[var(--error-dim)] border border-[var(--error)]/20 text-[13px] text-[var(--error)] mb-3">
                <AlertCircle size={12} /> {keyError}
              </div>
            )}
            {keySuccess && (
              <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-[var(--brand-dim)] border border-[var(--brand-primary)]/20 text-[13px] text-[var(--brand-text)] mb-3">
                <Check size={12} /> {keySuccess}
              </div>
            )}

            <div className="relative mb-4">
              <Key size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                placeholder="sk-..."
                className="input-base pl-9"
              />
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); }}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!apiKey.trim() || savingKey}
                onClick={handleSaveApiKey}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {savingKey ? <><Spinner size="sm" /> Verificando...</> : "Guardar y Verificar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
