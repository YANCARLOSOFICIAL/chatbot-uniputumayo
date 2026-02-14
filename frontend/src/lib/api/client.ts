const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const defaultHeaders: HeadersInit = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
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
    throw new Error(error.detail || `Error ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  // Chat
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
      sources: Array<{ chunk_id: string; document_title: string; content_preview: string; score: number }>;
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

  // Documents (Admin)
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

  // Health
  checkHealth: () =>
    request<{ status: string; services: Record<string, { status: string }> }>(
      "/api/v1/health"
    ),

  // LLM Config
  getProviders: () =>
    request<{
      providers: Array<{ name: string; models: string[]; is_available: boolean; is_default: boolean }>;
    }>("/api/v1/llm/providers"),
};
