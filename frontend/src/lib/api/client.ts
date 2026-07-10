const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const defaultHeaders: HeadersInit = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const token = getStoredToken();
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error del servidor" }));

    // 401 on non-auth endpoints → session expired, redirect to the right login page
    const isAuthEndpoint = endpoint.includes("/auth/login") || endpoint.includes("/auth/register");
    if (response.status === 401 && !isAuthEndpoint) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        if (!window.location.pathname.includes("/login")) {
          // Single consolidated login page lives at /admin/login (handles
          // both regular users and admins, redirecting post-login by role).
          window.location.href = "/admin/login";
        }
      }
    }

    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

import type { AuthUser } from "@/lib/auth";
export type { AuthUser };

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export const apiClient = {
  // ── Auth ──
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, display_name: string) =>
    request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }),

  getMe: () => request<AuthUser>("/api/v1/auth/me"),

  getUsers: () =>
    request<AuthUser[]>("/api/v1/auth/users"),

  updateUserRole: (userId: string, role: string) =>
    request<{ success: boolean }>(`/api/v1/auth/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  // ── Chat ──
  createConversation: (title?: string) =>
    request<{ id: string; title: string; created_at: string }>(
      "/api/v1/chat/conversations",
      {
        method: "POST",
        body: JSON.stringify({ title }),
      }
    ),

  getConversations: (limit = 20, offset = 0) =>
    request<Array<{ id: string; title: string; created_at: string; updated_at: string }>>(
      `/api/v1/chat/conversations?limit=${limit}&offset=${offset}`
    ),

  getConversation: (id: string) =>
    request<{ id: string; title: string; messages: Array<unknown> }>(
      `/api/v1/chat/conversations/${id}`
    ),

  deleteConversation: (id: string) =>
    request<{ success: boolean }>(`/api/v1/chat/conversations/${id}`, {
      method: "DELETE",
    }),

  renameConversation: (id: string, title: string) =>
    request<{ id: string; title: string; created_at: string; updated_at: string }>(
      `/api/v1/chat/conversations/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }
    ),

  sendMessage: (
    conversationId: string,
    content: string,
    inputType: string = "text",
    llmProvider?: string,
    llmModel?: string,
  ) =>
    request<{
      user_message: { id: string; role: string; content: string; created_at: string };
      assistant_message: { id: string; role: string; content: string; created_at: string; response_time_ms: number };
      sources: Array<{ chunk_id: string; document_title: string; content_preview: string; score: number; program: string | null; faculty: string | null }>;
    }>(`/api/v1/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content,
        input_type: inputType,
        llm_provider: llmProvider,
        llm_model: llmModel,
      }),
    }),

  sendMessageStream: async (
    conversationId: string,
    content: string,
    inputType: string = "text",
    onEvent: (event: Record<string, unknown>) => void,
    llmProvider?: string,
    llmModel?: string,
    externalSignal?: AbortSignal,
  ): Promise<void> => {
    const url = `${API_BASE}/api/v1/chat/conversations/${conversationId}/messages/stream`;
    const token = getStoredToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // The backend sends an SSE heartbeat comment every 15s while generating, so
    // any longer silence means the connection is actually dead — abort instead
    // of leaving the UI stuck on a spinner forever. Reset on every chunk (data
    // or heartbeat) received.
    const IDLE_TIMEOUT_MS = 35_000;
    const controller = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
    };
    externalSignal?.addEventListener("abort", () => controller.abort());
    resetIdleTimer();

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          content,
          input_type: inputType,
          llm_provider: llmProvider,
          llm_model: llmModel,
        }),
      });
    } catch (err) {
      clearTimeout(idleTimer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("La conexion con el servidor se interrumpio. Intenta de nuevo.");
      }
      throw err;
    }

    if (!response.ok) {
      clearTimeout(idleTimer);
      const error = await response.json().catch(() => ({ detail: "Error del servidor" }));
      throw new Error(error.detail || `Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      clearTimeout(idleTimer);
      throw new Error("Sin cuerpo de respuesta del stream");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        resetIdleTimer();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              let event: Record<string, unknown>;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                continue; // ignore malformed JSON lines
              }
              onEvent(event); // outside try/catch so event handler errors propagate
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("La conexion con el servidor se interrumpio. Intenta de nuevo.");
      }
      throw err;
    } finally {
      clearTimeout(idleTimer);
      reader.cancel().catch(() => {});
    }
  },

  getSuggestions: () =>
    request<Array<{ label: string; query: string; document_type: string | null }>>(
      "/api/v1/chat/suggestions"
    ),

  getMessages: (conversationId: string, limit = 50, offset = 0) =>
    request<
      Array<{ id: string; role: string; content: string; created_at: string }>
    >(
      `/api/v1/chat/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
    ),

  // ── Documents (Admin) ──
  uploadDocument: (formData: FormData) =>
    request<{ document_id: string; status: string; message: string }>(
      "/api/v1/documents/upload",
      {
        method: "POST",
        body: formData,
      }
    ),

  getDocuments: (page = 1, perPage = 20) =>
    request<Array<{ id: string; title: string; ingestion_status: string; total_chunks: number }>>(
      `/api/v1/documents?page=${page}&per_page=${perPage}`
    ),

  getDocument: (id: string) =>
    request<{ id: string; title: string; ingestion_status: string; total_chunks: number }>(
      `/api/v1/documents/${id}`
    ),

  deleteDocument: (id: string) =>
    request<{ success: boolean }>(`/api/v1/documents/${id}`, {
      method: "DELETE",
    }),

  reindexDocument: (id: string) =>
    request<{ document_id: string; status: string; message: string }>(
      `/api/v1/documents/${id}/reindex`,
      { method: "POST" }
    ),

  // ── Taxonomy (Admin) ──
  getFaculties: () =>
    request<Array<{ id: string; name: string; created_at: string }>>("/api/v1/taxonomy/faculties"),
  createFaculty: (name: string) =>
    request<{ id: string; name: string; created_at: string }>("/api/v1/taxonomy/faculties", {
      method: "POST", body: JSON.stringify({ name }),
    }),
  renameFaculty: (id: string, name: string) =>
    request<{ id: string; name: string; created_at: string }>(`/api/v1/taxonomy/faculties/${id}`, {
      method: "PUT", body: JSON.stringify({ name }),
    }),
  deleteFaculty: (id: string) =>
    request<{ success: boolean }>(`/api/v1/taxonomy/faculties/${id}`, { method: "DELETE" }),

  getPrograms: () =>
    request<Array<{ id: string; name: string; faculty_id: string | null; created_at: string }>>("/api/v1/taxonomy/programs"),
  createProgram: (name: string, faculty_id?: string | null) =>
    request<{ id: string; name: string; faculty_id: string | null; created_at: string }>("/api/v1/taxonomy/programs", {
      method: "POST", body: JSON.stringify({ name, faculty_id: faculty_id ?? null }),
    }),
  renameProgram: (id: string, name: string) =>
    request<{ id: string; name: string; faculty_id: string | null; created_at: string }>(`/api/v1/taxonomy/programs/${id}`, {
      method: "PUT", body: JSON.stringify({ name }),
    }),
  deleteProgram: (id: string) =>
    request<{ success: boolean }>(`/api/v1/taxonomy/programs/${id}`, { method: "DELETE" }),

  getDocumentTypes: () =>
    request<Array<{ id: string; name: string; created_at: string }>>("/api/v1/taxonomy/document-types"),
  createDocumentType: (name: string) =>
    request<{ id: string; name: string; created_at: string }>("/api/v1/taxonomy/document-types", {
      method: "POST", body: JSON.stringify({ name }),
    }),
  renameDocumentType: (id: string, name: string) =>
    request<{ id: string; name: string; created_at: string }>(`/api/v1/taxonomy/document-types/${id}`, {
      method: "PUT", body: JSON.stringify({ name }),
    }),
  deleteDocumentType: (id: string) =>
    request<{ success: boolean }>(`/api/v1/taxonomy/document-types/${id}`, { method: "DELETE" }),

  // ── Health ──
  checkHealth: () =>
    request<{ status: string; services: Record<string, { status: string }> }>(
      "/api/v1/health"
    ),

  // ── LLM Config ──
  getProviders: () =>
    request<{
      providers: Array<{
        name: string;
        models: string[];
        is_available: boolean;
        is_default: boolean;
        default_model: string;
      }>;
    }>("/api/v1/llm/providers"),

  updateLLMConfig: (config: { default_provider?: string; default_model?: string; temperature?: number; max_tokens?: number }) =>
    request<{ success: boolean; config: Record<string, unknown> }>("/api/v1/llm/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  // ── API Key ──
  setApiKey: (provider: string, api_key: string) =>
    request<{ success: boolean; is_available: boolean }>("/api/v1/llm/api-key", {
      method: "POST",
      body: JSON.stringify({ provider, api_key }),
    }),

  getApiKeyStatus: () =>
    request<{ has_key: boolean; masked_key: string | null }>("/api/v1/llm/api-key-status"),

  // ── Guest session cleanup ──
  // Uses sendBeacon so the request survives tab close (fire-and-forget).
  guestClose: (conversationId: string): boolean => {
    if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
    return navigator.sendBeacon(
      `${API_BASE}/api/v1/chat/conversations/${conversationId}/guest-close`
    );
  },

  // ── Analytics ──
  getAnalytics: () =>
    request<{
      total_conversations: number;
      total_messages: number;
      unique_users: number;
      avg_response_time_s: number | null;
      resolution_rate: number;
      this_week_conversations: number;
      last_week_conversations: number;
      conversations_per_day: Array<{ date: string; label: string; count: number }>;
      top_queries: Array<{ label: string; count: number }>;
    }>("/api/v1/analytics/overview"),

  // ── RAG Eval ──
  startRagEval: () => request<RagEvalRunSummary>("/api/v1/rag-eval/run", { method: "POST" }),
  getRagEvalRuns: (limit = 20) =>
    request<RagEvalRunSummary[]>(`/api/v1/rag-eval?limit=${limit}`),
  getRagEvalRun: (runId: string) =>
    request<RagEvalRunDetail>(`/api/v1/rag-eval/${runId}`),
};

export interface RagEvalRunSummary {
  id: string;
  status: "running" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  passed: number | null;
  total: number | null;
  avg_retrieval_ms: number | null;
  avg_generation_ms: number | null;
}

export interface RagEvalCaseResult {
  id: string;
  query: string;
  passed: boolean;
  retrieval_quality: string;
  retrieval_top_score: number;
  retrieval_ms: number;
  sources_cited: number;
  generation_ms: number;
  answer: string;
  notes: string[];
}

export interface RagEvalRunDetail extends RagEvalRunSummary {
  results: RagEvalCaseResult[] | null;
  error_message: string | null;
}
