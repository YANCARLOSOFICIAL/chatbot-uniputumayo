export interface Conversation {
  id: string;
  user_id: string | null;
  title: string | null;
  language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  input_type: "text" | "voice";
  tokens_used: number | null;
  llm_provider: string | null;
  llm_model: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface SourceInfo {
  chunk_id: string;
  document_title: string;
  content_preview: string;
  score: number;
  program: string | null;
  faculty: string | null;
}

export interface ChatResponse {
  user_message: Message;
  assistant_message: Message;
  sources: SourceInfo[];
}

export interface DocumentInfo {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  faculty: string | null;
  program: string | null;
  document_type: string | null;
  ingestion_status: string;
  total_chunks: number;
  created_at: string;
  updated_at: string;
}
