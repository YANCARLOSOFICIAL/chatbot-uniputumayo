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
  // How the assistant answer was produced ("faq" | "cache" | "rag" |
  // "refusal" | "clarification" | "greeting"); absent on user messages and
  // on answers stored before the FAQ feature.
  answer_source?: string | null;
  faq_entry_id?: string | null;
  created_at: string;
}

/* ── Preguntas frecuentes (FAQ) ── */
export interface FaqPublic {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  source_document: string | null;
  valid_period: string | null;
  sort_order: number;
}

export interface FaqAdmin extends FaqPublic {
  program: string | null;
  faculty: string | null;
  is_enabled: boolean;
  hit_count: number;
  indexed: boolean;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface FaqInput {
  question: string;
  answer: string;
  category?: string | null;
  source_document?: string | null;
  valid_period?: string | null;
  program?: string | null;
  faculty?: string | null;
  is_enabled?: boolean;
  sort_order?: number;
}

// Admin dry run of the chat's FAQ step (GET /api/v1/faq/admin/match).
export interface FaqMatchTest {
  query: string;
  embedding_ok: boolean;
  decision: "hit" | "suggestion" | "none";
  matched_id: string | null;
  matched_question: string | null;
  similarity: number | null;
  candidates: Array<{ id: string; question: string; similarity: number; guards_pass: boolean; lexical_subset: boolean }>;
  judge_used: boolean;
  judge_choice: number | null;
  judge_error: string | null;
  thresholds: { hit: number; judge: number; suggest: number };
}

// Related FAQ offered after an answer when the question was close to a
// curated one but not confidently the same.
export interface FaqSuggestion {
  id: string;
  question: string;
  similarity: number;
}

export interface SourceInfo {
  chunk_id: string;
  document_title: string;
  content_preview: string;
  score: number;
  program: string | null;
  faculty: string | null;
  citation_number: number;
}

export interface ChatResponse {
  user_message: Message;
  assistant_message: Message;
  sources: SourceInfo[];
  faq_suggestion?: FaqSuggestion | null;
}

export interface ProviderOption {
  name: string;
  models: string[];
  is_available: boolean;
  is_default: boolean;
  default_model: string;
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
