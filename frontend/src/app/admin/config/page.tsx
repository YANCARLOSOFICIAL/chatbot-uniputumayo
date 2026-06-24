"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, Key, Server, Cloud,
  Zap, X, AlertCircle, Check, RefreshCw
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
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
  ollama: "Modelos ejecutandose en tu servidor. Sin costo, sin latencia de red.",
  openai: "API de OpenAI en la nube. Requiere API key y conexion a internet.",
};

export default function ConfigPage() {
  const [providers, setProviders]       = useState<ProviderInfo[]>([]);
  const [loading, setLoading]           = useState(true);
  const [switching, setSwitching]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKey, setApiKey]             = useState("");
  const [keyStatus, setKeyStatus]       = useState<{ has_key: boolean; masked_key: string | null } | null>(null);
  const [savingKey, setSavingKey]       = useState(false);
  const [keyError, setKeyError]         = useState<string | null>(null);
  const [keySuccess, setKeySuccess]     = useState<string | null>(null);

  const activeProvider = providers.find((p) => p.is_default);

  const loadProviders = useCallback(async () => {
    try {
      const data = await apiClient.getProviders();
      setProviders(data.providers as ProviderInfo[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando configuracion");
    } finally { setLoading(false); }
  }, []);

  const loadKeyStatus = useCallback(async () => {
    try {
      const status = await apiClient.getApiKeyStatus();
      setKeyStatus(status);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadProviders(); loadKeyStatus(); }, [loadProviders, loadKeyStatus]);

  const handleSelectModel = async (providerName: string, model: string) => {
    setSwitching(true); setError(null); setSuccess(null);
    try {
      await apiClient.updateLLMConfig({ default_provider: providerName, default_model: model });
      setSuccess(`Modelo activo: ${providerName} / ${model}`);
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando modelo");
    } finally { setSwitching(false); }
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
        setKeyError("API Key guardada pero no pudo verificarse. Revisa que sea valida.");
      }
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Error guardando API Key");
    } finally { setSavingKey(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <AdminHeader
        title="Configuracion IA"
        subtitle="El modelo seleccionado orquesta el chat, RAG y extraccion de documentos."
        action={
          <button onClick={() => { setLoading(true); loadProviders(); }} disabled={loading}
            className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        }
      />

      <div style={{ padding: "28px 32px 48px", flex: 1 }}>

        {loading ? (
          <div style={{ padding: "64px 0", display: "flex", justifyContent: "center", gap: 6 }}>
            {[0, 0.12, 0.24].map((d) => (
              <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)", display: "inline-block", animation: `pulse-soft 1.2s ${d}s ease-in-out infinite` }} />
            ))}
          </div>
        ) : (
          <>
            {/* Modelo activo banner */}
            {activeProvider && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Zap size={16} style={{ color: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--brand-primary)", marginBottom: 3 }}>
                    Modelo activo
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>
                    {PROVIDER_LABELS[activeProvider.name] ?? activeProvider.name}
                    <span style={{ margin: "0 8px", color: "var(--text-3)" }}>/</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{activeProvider.default_model}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r)", background: "var(--error-dim)", border: "1px solid rgba(200,54,44,0.2)", color: "var(--error)", fontSize: 13, marginBottom: 16 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
                <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}><X size={13} /></button>
              </div>
            )}
            {success && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--r)", background: "var(--brand-dim)", border: "1px solid var(--brand-light)", color: "var(--text-1)", fontSize: 13, marginBottom: 16 }}>
                <Check size={14} style={{ flexShrink: 0, color: "var(--brand-primary)" }} /> {success}
                <button onClick={() => setSuccess(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}><X size={13} /></button>
              </div>
            )}

            {/* Provider cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
              {providers.map((provider) => {
                const ProvIcon = PROVIDER_ICONS[provider.name] ?? Server;
                const isActive = provider.is_default;

                return (
                  <div key={provider.name} style={{
                    background: "var(--surface)", borderRadius: 14,
                    border: isActive ? "1.5px solid var(--brand-primary)" : "1px solid var(--border)",
                    padding: "22px 24px",
                    boxShadow: isActive ? "0 0 0 3px var(--brand-dim)" : "none",
                    transition: "box-shadow 0.2s",
                  }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                          background: isActive ? "var(--brand-primary)" : "var(--surface-2)",
                          border: isActive ? "none" : "1px solid var(--border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <ProvIcon size={19} style={{ color: isActive ? "#fff" : "var(--text-2)" }} />
                        </div>
                        <div>
                          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", marginBottom: 4 }}>
                            {PROVIDER_LABELS[provider.name] ?? provider.name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {provider.is_available ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--success)" }}>
                                <CheckCircle2 size={11} /> Disponible
                              </span>
                            ) : (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--error)" }}>
                                <XCircle size={11} /> No disponible
                              </span>
                            )}
                            {isActive && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 9999, background: "var(--brand-primary)", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                                <Zap size={8} /> Activo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14, lineHeight: 1.6 }}>
                      {PROVIDER_DESC[provider.name] ?? ""}
                    </p>

                    {/* API Key (OpenAI only) */}
                    {provider.name === "openai" && (
                      <div style={{ padding: "10px 14px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <Key size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)", flex: 1 }}>
                          {keyStatus?.has_key ? keyStatus.masked_key : "API Key no configurada"}
                        </span>
                        <button onClick={() => setShowKeyModal(true)} style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-primary)", background: "none", border: "none", cursor: "pointer" }}>
                          {keyStatus?.has_key ? "Cambiar" : "Configurar"}
                        </button>
                      </div>
                    )}

                    {/* Model chips */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-3)", marginBottom: 10 }}>
                        {provider.models.length === 0
                          ? provider.name === "ollama" ? "Ningun modelo instalado" : "Sin modelos disponibles"
                          : "Seleccionar modelo"
                        }
                      </div>

                      {provider.models.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {provider.models.map((model) => {
                            const isActiveModel = isActive && provider.default_model === model;
                            const canSelect = provider.is_available && !switching;
                            return (
                              <button key={model} disabled={!canSelect || isActiveModel}
                                onClick={() => handleSelectModel(provider.name, model)}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "5px 12px", borderRadius: 8,
                                  fontFamily: "var(--font-mono)", fontSize: 12, border: "1px solid",
                                  cursor: isActiveModel ? "default" : canSelect ? "pointer" : "not-allowed",
                                  transition: "all 0.15s",
                                  background: isActiveModel ? "var(--brand-primary)" : "var(--surface-2)",
                                  borderColor: isActiveModel ? "var(--brand-primary)" : "var(--border)",
                                  color: isActiveModel ? "#fff" : canSelect ? "var(--text-2)" : "var(--text-3)",
                                  opacity: !canSelect && !isActiveModel ? 0.45 : 1,
                                }}
                                onMouseEnter={(e) => { if (canSelect && !isActiveModel) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand-primary)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--brand-primary)"; } }}
                                onMouseLeave={(e) => { if (canSelect && !isActiveModel) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; } }}
                              >
                                {isActiveModel && <Check size={11} strokeWidth={2.5} />}
                                {switching && !isActiveModel && (
                                  <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                                )}
                                {model}
                              </button>
                            );
                          })}
                        </div>
                      ) : provider.name === "ollama" ? (
                        <p style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", margin: 0 }}>
                          Reinicia los contenedores Docker para descargar los modelos automaticamente.
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instrucciones */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                <Server size={14} style={{ color: "var(--brand-primary)" }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Instrucciones de configuracion</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, fontSize: 13, color: "var(--text-2)" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>Ollama (Local)</div>
                  <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    <li>Ejecutar <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--surface-2)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 4 }}>docker compose up</code> en el directorio raiz</li>
                    <li>Los modelos <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>qwen3:8b</code> y <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>gemma4:e4b</code> se descargan al iniciar</li>
                    <li>Haz clic en Actualizar despues de la descarga</li>
                  </ol>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>OpenAI (Nube)</div>
                  <ol style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    <li>Obtener API key en <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>platform.openai.com</span></li>
                    <li>Clic en &quot;Configurar&quot; en la tarjeta OpenAI</li>
                    <li>Selecciona el modelo deseado</li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--text-1)" }}>API Key de OpenAI</div>
              <button onClick={() => { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); }}
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.6 }}>
              Ingresa tu API key. Obtenla en{" "}
              <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>platform.openai.com</span>
            </p>

            {keyError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--error-dim)", color: "var(--error)", fontSize: 13, border: "1px solid rgba(200,54,44,0.2)", marginBottom: 12 }}>
                <AlertCircle size={12} /> {keyError}
              </div>
            )}
            {keySuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--brand-dim)", color: "var(--brand-primary)", fontSize: 13, border: "1px solid var(--brand-light)", marginBottom: 12 }}>
                <Check size={12} /> {keySuccess}
              </div>
            )}

            <div style={{ position: "relative", marginBottom: 16 }}>
              <Key size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                placeholder="sk-..."
                className="input"
                style={{ width: "100%", paddingLeft: 36, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text-2)" }}>
                Cancelar
              </button>
              <button disabled={!apiKey.trim() || savingKey} onClick={handleSaveApiKey}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", background: !apiKey.trim() || savingKey ? "var(--surface-2)" : "var(--brand-primary)", cursor: !apiKey.trim() || savingKey ? "not-allowed" : "pointer", color: !apiKey.trim() || savingKey ? "var(--text-3)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.15s" }}>
                {savingKey ? (
                  <>{[0, 0.1, 0.2].map((d) => <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: `pulse-soft 1s ${d}s ease-in-out infinite` }} />)} Verificando...</>
                ) : "Guardar y Verificar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
