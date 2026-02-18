const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

    // 401 on non-auth endpoints → session expired, redirect to login
    const isAuthEndpoint = endpoint.includes("/auth/login") || endpoint.includes("/auth/register");
    if (response.status === 401 && !isAuthEndpoint) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/admin/login";
        }
      }
    }

    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

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

  sendMessage: (
    conversationId: string,
    content: string,
    inputType: string = "text",
    llmProvider?: string
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
      }),
    }),

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
      `/api/v1/documents/?page=${page}&per_page=${perPage}`
    ),

  deleteDocument: (id: string) =>
    request<{ success: boolean }>(`/api/v1/documents/${id}`, {
      method: "DELETE",
    }),

  // ── Health ──
  checkHealth: () =>
    request<{ status: string; services: Record<string, { status: string }> }>(
      "/api/v1/health"
    ),

  // ── LLM Config ──
  getProviders: () =>
    request<{
      providers: Array<{ name: string; models: string[]; is_available: boolean; is_default: boolean }>;
    }>("/api/v1/llm/providers"),

  updateLLMConfig: (config: { default_provider?: string; temperature?: number; max_tokens?: number }) =>
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
};
