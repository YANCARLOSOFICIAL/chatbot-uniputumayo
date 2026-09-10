"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, Key, Server, Cloud,
  Zap, X, AlertCircle, Check, RefreshCw, Trash2, Mail
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface ProviderInfo {
  name: string;
  models: string[];
  is_available: boolean;
  is_default: boolean;
  default_model: string;
  protected_models?: string[];
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

  const [clearingCache, setClearingCache] = useState(false);

  // OpenAI model-list management
  const [newModel, setNewModel]             = useState("");
  const [addingModel, setAddingModel]       = useState(false);
  const [modelActionError, setModelActionError] = useState<string | null>(null);
  const [discovered, setDiscovered]         = useState<string[] | null>(null);
  const [discovering, setDiscovering]       = useState(false);

  // Ollama model download / removal
  const [ollamaPullModel, setOllamaPullModel] = useState("");
  const [pullStatus, setPullStatus] = useState<
    { active: boolean; model: string | null; status: string; percent: number; error: string | null } | null
  >(null);
  const [ollamaRemoveTarget, setOllamaRemoveTarget] = useState<string | null>(null);
  const [removingOllama, setRemovingOllama] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailApiKey, setEmailApiKey]       = useState("");
  const [emailFromEmail, setEmailFromEmail] = useState("");
  const [emailKeyStatus, setEmailKeyStatus] = useState<{ has_key: boolean; masked_key: string | null; from_email: string } | null>(null);
  const [savingEmailKey, setSavingEmailKey] = useState(false);
  const [emailKeyError, setEmailKeyError]   = useState<string | null>(null);
  const [emailKeySuccess, setEmailKeySuccess] = useState<string | null>(null);

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

  const loadEmailKeyStatus = useCallback(async () => {
    try {
      const status = await apiClient.getEmailKeyStatus();
      setEmailKeyStatus(status);
      setEmailFromEmail(status.from_email ?? "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadProviders(); loadKeyStatus(); loadEmailKeyStatus();
    // Pick up an Ollama pull already in progress (e.g. after a page reload).
    apiClient.getOllamaPullStatus().then((s) => { if (s.status !== "idle") setPullStatus(s); }).catch(() => {});
  }, [loadProviders, loadKeyStatus, loadEmailKeyStatus]);

  // Poll pull progress while a download is active.
  useEffect(() => {
    if (!pullStatus?.active) return;
    const id = setInterval(async () => {
      try {
        const s = await apiClient.getOllamaPullStatus();
        setPullStatus(s);
        if (!s.active) {
          clearInterval(id);
          if (s.status === "success") { setOllamaPullModel(""); loadProviders(); }
        }
      } catch { /* transient — keep polling */ }
    }, 2000);
    return () => clearInterval(id);
  }, [pullStatus?.active, loadProviders]);

  const handleAddModel = async (modelArg?: string) => {
    const model = (modelArg ?? newModel).trim();
    if (!model) return;
    setAddingModel(true); setModelActionError(null); setError(null); setSuccess(null);
    try {
      const res = await apiClient.addOpenAIModel(model);
      if (res.success) {
        setSuccess(`Modelo agregado: ${model}`);
        setNewModel("");
        setDiscovered((d) => d?.filter((m) => m !== model) ?? null);
        await loadProviders();
      } else {
        setModelActionError(res.detail ?? "No se pudo agregar el modelo");
      }
    } catch (err) {
      setModelActionError(err instanceof Error ? err.message : "Error agregando el modelo");
    } finally { setAddingModel(false); }
  };

  const handleRemoveModel = async (model: string) => {
    setModelActionError(null); setError(null); setSuccess(null);
    try {
      const res = await apiClient.removeOpenAIModel(model);
      if (res.success) { setSuccess(`Modelo quitado: ${model}`); await loadProviders(); }
      else setModelActionError(res.detail ?? "No se pudo quitar el modelo");
    } catch (err) {
      setModelActionError(err instanceof Error ? err.message : "Error quitando el modelo");
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true); setModelActionError(null);
    try {
      const res = await apiClient.discoverOpenAIModels();
      if (res.success) setDiscovered(res.models);
      else setModelActionError(res.detail ?? "No se pudo consultar OpenAI");
    } catch (err) {
      setModelActionError(err instanceof Error ? err.message : "Error consultando OpenAI");
    } finally { setDiscovering(false); }
  };

  const handlePull = async () => {
    const model = ollamaPullModel.trim();
    if (!model) return;
    setError(null); setSuccess(null);
    try {
      await apiClient.pullOllamaModel(model);
      setPullStatus({ active: true, model, status: "starting", percent: 0, error: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando la descarga");
    }
  };

  const handleRemoveOllamaModel = async () => {
    if (!ollamaRemoveTarget) return;
    setRemovingOllama(true); setError(null); setSuccess(null);
    try {
      const res = await apiClient.deleteOllamaModel(ollamaRemoveTarget);
      if (res.success) {
        setSuccess(`Modelo eliminado del servidor: ${ollamaRemoveTarget}`);
        setOllamaRemoveTarget(null);
        await loadProviders();
      } else {
        setError(res.detail ?? "No se pudo eliminar el modelo");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando el modelo");
    } finally { setRemovingOllama(false); }
  };

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

  const handleClearAnswerCache = async () => {
    setClearingCache(true); setError(null); setSuccess(null);
    try {
      await apiClient.invalidateAnswerCache();
      setSuccess("Caché de respuestas limpiado — las próximas preguntas se responderán de nuevo, sin usar respuestas guardadas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error limpiando el caché de respuestas");
    } finally { setClearingCache(false); }
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

  const handleSaveEmailKey = async () => {
    if (!emailApiKey.trim() || !emailFromEmail.trim()) return;
    setSavingEmailKey(true); setEmailKeyError(null); setEmailKeySuccess(null);
    try {
      const result = await apiClient.setEmailKey(emailApiKey.trim(), emailFromEmail.trim());
      if (result.is_valid) {
        setEmailKeySuccess("API Key guardada y verificada correctamente");
        setEmailApiKey("");
        await loadEmailKeyStatus();
        setTimeout(() => setShowEmailModal(false), 1500);
      } else {
        setEmailKeyError("API Key guardada pero no pudo verificarse. Revisa que sea valida.");
      }
    } catch (err) {
      setEmailKeyError(err instanceof Error ? err.message : "Error guardando API Key");
    } finally { setSavingEmailKey(false); }
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
                          ? provider.name === "ollama" ? "Ningun modelo instalado" : "Sin modelos en la lista"
                          : "Seleccionar modelo"
                        }
                      </div>

                      {provider.models.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {provider.models.map((model) => {
                            const isActiveModel = isActive && provider.default_model === model;
                            const canSelect = provider.is_available && !switching;
                            const isProtected = (provider.protected_models ?? []).includes(model);
                            const canRemove =
                              !isActiveModel && !switching && !addingModel && !isProtected &&
                              (provider.name === "openai" || provider.name === "ollama");
                            return (
                              <span key={model} style={{ display: "inline-flex", alignItems: "stretch" }}>
                                <button disabled={!canSelect || isActiveModel}
                                  onClick={() => handleSelectModel(provider.name, model)}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    padding: "5px 12px",
                                    borderRadius: canRemove ? "8px 0 0 8px" : 8,
                                    fontFamily: "var(--font-mono)", fontSize: 12, border: "1px solid",
                                    borderRight: canRemove ? "none" : undefined,
                                    cursor: isActiveModel ? "default" : canSelect ? "pointer" : "not-allowed",
                                    transition: "all 0.15s",
                                    background: isActiveModel ? "var(--brand-primary)" : "var(--surface-2)",
                                    borderColor: isActiveModel ? "var(--brand-primary)" : "var(--border)",
                                    color: isActiveModel ? "#fff" : canSelect ? "var(--text-2)" : "var(--text-3)",
                                    opacity: !canSelect && !isActiveModel ? 0.45 : 1,
                                  }}
                                >
                                  {isActiveModel && <Check size={11} strokeWidth={2.5} />}
                                  {switching && !isActiveModel && (
                                    <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                                  )}
                                  {model}
                                </button>
                                {canRemove && (
                                  <button
                                    onClick={() => provider.name === "openai" ? handleRemoveModel(model) : setOllamaRemoveTarget(model)}
                                    title={provider.name === "openai" ? "Quitar de la lista" : "Eliminar del servidor"}
                                    style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      padding: "0 7px", borderRadius: "0 8px 8px 0",
                                      border: "1px solid var(--border)", background: "var(--surface-2)",
                                      color: "var(--text-3)", cursor: "pointer", transition: "all 0.15s",
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--error)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--error)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      ) : provider.name === "ollama" ? (
                        <p style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", margin: 0 }}>
                          Descarga un modelo abajo, o reinicia los contenedores Docker para bajar los predeterminados.
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", margin: 0 }}>
                          Agrega un modelo abajo. El modelo activo sigue funcionando aunque la lista esté vacía.
                        </p>
                      )}

                      {/* OpenAI: agregar / descubrir modelos */}
                      {provider.name === "openai" && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <input
                              value={newModel}
                              onChange={(e) => setNewModel(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleAddModel(); }}
                              placeholder="p. ej. gpt-6"
                              className="input"
                              style={{ fontFamily: "var(--font-mono)", fontSize: 12, maxWidth: 220, padding: "6px 10px" }}
                            />
                            <button className="btn btn-secondary btn-sm"
                              disabled={!newModel.trim() || addingModel || !provider.is_available}
                              onClick={() => handleAddModel()}>
                              {addingModel ? "Validando…" : "Agregar modelo"}
                            </button>
                            <button className="btn btn-secondary btn-sm"
                              disabled={discovering || !provider.is_available}
                              onClick={handleDiscover}>
                              {discovering ? "Buscando…" : "Descubrir de mi cuenta"}
                            </button>
                          </div>

                          {modelActionError && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "var(--error)" }}>
                              <AlertCircle size={12} style={{ flexShrink: 0 }} /> {modelActionError}
                            </div>
                          )}

                          {discovered && (
                            <div style={{ marginTop: 10 }}>
                              {discovered.length === 0 ? (
                                <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>No se encontraron modelos nuevos.</p>
                              ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {discovered.map((m) => (
                                    <button key={m} disabled={addingModel} onClick={() => handleAddModel(m)}
                                      style={{
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                        padding: "4px 10px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12,
                                        border: "1px dashed var(--border)", background: "transparent", color: "var(--text-2)",
                                        cursor: addingModel ? "not-allowed" : "pointer",
                                      }}>
                                      + {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10, lineHeight: 1.5 }}>
                            &quot;Validar&quot; hace una llamada real de prueba — confirma que el modelo responde, no que todo funcione.
                            El modelo activo también corre el verification loop y el juez de la evaluación.
                            Tras cambiar de modelo, considera limpiar el caché de respuestas (abajo).
                          </p>
                        </div>
                      )}

                      {/* Ollama: descargar modelo */}
                      {provider.name === "ollama" && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <input
                              value={ollamaPullModel}
                              onChange={(e) => setOllamaPullModel(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handlePull(); }}
                              placeholder="p. ej. qwen2.5:7b"
                              className="input"
                              disabled={pullStatus?.active}
                              style={{ fontFamily: "var(--font-mono)", fontSize: 12, maxWidth: 220, padding: "6px 10px" }}
                            />
                            <button className="btn btn-secondary btn-sm"
                              disabled={!ollamaPullModel.trim() || pullStatus?.active || !provider.is_available}
                              onClick={handlePull}>
                              {pullStatus?.active ? "Descargando…" : "Descargar modelo"}
                            </button>
                          </div>

                          {pullStatus && pullStatus.status !== "idle" && (
                            <div style={{ marginTop: 10 }}>
                              {pullStatus.active && (
                                <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden", marginBottom: 6 }}>
                                  <div style={{ height: "100%", width: `${pullStatus.percent}%`, background: "var(--brand-primary)", transition: "width 0.4s" }} />
                                </div>
                              )}
                              <p style={{
                                fontSize: 12, margin: 0,
                                color: pullStatus.status === "error" ? "var(--error)" : pullStatus.status === "success" ? "var(--success)" : "var(--text-2)",
                              }}>
                                {pullStatus.status === "error"
                                  ? `Error: ${pullStatus.error}`
                                  : pullStatus.status === "success"
                                    ? `${pullStatus.model} descargado. Clic en Actualizar para verlo.`
                                    : `${pullStatus.model}: ${pullStatus.status}${pullStatus.percent ? ` · ${pullStatus.percent}%` : ""}`}
                              </p>
                            </div>
                          )}

                          {ollamaRemoveTarget && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                              marginTop: 10, padding: "10px 12px", borderRadius: 9,
                              background: "var(--error-dim)", border: "1px solid rgba(200,54,44,0.2)",
                            }}>
                              <span style={{ fontSize: 12, color: "var(--text-1)" }}>
                                ¿Eliminar <code style={{ fontFamily: "var(--font-mono)" }}>{ollamaRemoveTarget}</code> del servidor?
                                Libera espacio en disco; puedes volver a descargarlo.
                              </span>
                              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                                <button className="btn btn-secondary btn-sm" disabled={removingOllama}
                                  onClick={() => setOllamaRemoveTarget(null)}>Cancelar</button>
                                <button disabled={removingOllama} onClick={handleRemoveOllamaModel}
                                  style={{
                                    padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                    border: "none", background: "var(--error)", color: "#fff",
                                    cursor: removingOllama ? "not-allowed" : "pointer",
                                  }}>
                                  {removingOllama ? "Eliminando…" : "Eliminar"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
              <div className="config-2col" style={{ fontSize: 13, color: "var(--text-2)" }}>
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

            {/* Recuperación de contraseña (Resend) */}
            <div className="card" style={{ padding: 22, marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                <Mail size={14} style={{ color: "var(--brand-primary)" }} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Recuperación de contraseña (Resend)</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 14, lineHeight: 1.6 }}>
                Envía el correo con el enlace para restablecer contraseña cuando un usuario lo solicita en el login.
              </p>
              <div style={{ padding: "10px 14px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <Key size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)", flex: 1 }}>
                  {emailKeyStatus?.has_key ? `${emailKeyStatus.masked_key} · ${emailKeyStatus.from_email}` : "API Key no configurada"}
                </span>
                <button onClick={() => setShowEmailModal(true)} style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-primary)", background: "none", border: "none", cursor: "pointer" }}>
                  {emailKeyStatus?.has_key ? "Cambiar" : "Configurar"}
                </button>
              </div>
            </div>

            {/* Caché de respuestas */}
            <div className="card" style={{ padding: 22, marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Trash2 size={14} style={{ color: "var(--brand-primary)" }} />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>Caché de respuestas</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    Respuestas ya generadas se reutilizan para preguntas similares. Límpialo si cambiaste cómo se generan las respuestas y quieres que se vuelvan a calcular.
                  </div>
                </div>
              </div>
              <button onClick={handleClearAnswerCache} disabled={clearingCache}
                className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <Trash2 size={12} className={clearingCache ? "animate-spin" : ""} />
                {clearingCache ? "Limpiando..." : "Limpiar caché"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setShowKeyModal(false); setApiKey(""); setKeyError(null); setKeySuccess(null); } }}
          role="dialog" aria-modal="true" aria-label="Configurar API Key"
        >
          <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24 }} onClick={(e) => e.stopPropagation()}>
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

      {/* Resend API Key Modal */}
      {showEmailModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => { setShowEmailModal(false); setEmailApiKey(""); setEmailKeyError(null); setEmailKeySuccess(null); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setShowEmailModal(false); setEmailApiKey(""); setEmailKeyError(null); setEmailKeySuccess(null); } }}
          role="dialog" aria-modal="true" aria-label="Configurar Resend"
        >
          <div className="card" style={{ maxWidth: 420, width: "100%", padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--text-1)" }}>API Key de Resend</div>
              <button onClick={() => { setShowEmailModal(false); setEmailApiKey(""); setEmailKeyError(null); setEmailKeySuccess(null); }}
                style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16, lineHeight: 1.6 }}>
              Obtén tu API key en{" "}
              <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>resend.com/api-keys</span>.
              El remitente debe pertenecer a un dominio verificado en tu cuenta de Resend.
            </p>

            {emailKeyError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--error-dim)", color: "var(--error)", fontSize: 13, border: "1px solid rgba(200,54,44,0.2)", marginBottom: 12 }}>
                <AlertCircle size={12} /> {emailKeyError}
              </div>
            )}
            {emailKeySuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "var(--brand-dim)", color: "var(--brand-primary)", fontSize: 13, border: "1px solid var(--brand-light)", marginBottom: 12 }}>
                <Check size={12} /> {emailKeySuccess}
              </div>
            )}

            <div style={{ position: "relative", marginBottom: 12 }}>
              <Key size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
              <input type="password" value={emailApiKey} onChange={(e) => setEmailApiKey(e.target.value)}
                placeholder="re_..."
                className="input"
                style={{ width: "100%", paddingLeft: 36, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ position: "relative", marginBottom: 16 }}>
              <Mail size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
              <input type="text" value={emailFromEmail} onChange={(e) => setEmailFromEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveEmailKey()}
                placeholder="Guaca <noreply@tudominio.com>"
                className="input"
                style={{ width: "100%", paddingLeft: 36, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowEmailModal(false); setEmailApiKey(""); setEmailKeyError(null); setEmailKeySuccess(null); }}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text-2)" }}>
                Cancelar
              </button>
              <button disabled={!emailApiKey.trim() || !emailFromEmail.trim() || savingEmailKey} onClick={handleSaveEmailKey}
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", background: !emailApiKey.trim() || !emailFromEmail.trim() || savingEmailKey ? "var(--surface-2)" : "var(--brand-primary)", cursor: !emailApiKey.trim() || !emailFromEmail.trim() || savingEmailKey ? "not-allowed" : "pointer", color: !emailApiKey.trim() || !emailFromEmail.trim() || savingEmailKey ? "var(--text-3)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.15s" }}>
                {savingEmailKey ? (
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
