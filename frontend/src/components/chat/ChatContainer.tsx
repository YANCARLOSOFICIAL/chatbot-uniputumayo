"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { AlertCircle, X, PanelLeft } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { QuickReplies } from "./QuickReplies";
import { ConversationSidebar } from "./ConversationSidebar";

export function ChatContainer() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  const {
    conversations, activeConversationId, messages, sources,
    isLoading, avatarState, error,
    loadConversations, createConversation, selectConversation,
    sendMessage, deleteConversation, dispatch,
  } = useChat();

  const { transcript, isListening, startListening, stopListening, isSupported } =
    useSpeechRecognition();
  const { speak, isSpeaking } = useSpeechSynthesis();

  const handleSendRef = useRef<((content: string, inputType: "text" | "voice") => Promise<void>) | null>(null);

  useEffect(() => {
    loadConversations();
    setMounted(true);
    if (isAuthenticated()) setUser(getUser());
  }, [loadConversations]);

  const handleSend = useCallback(
    async (content: string, inputType: "text" | "voice" = "text") => {
      let convId = activeConversationId;
      if (!convId) {
        convId = await createConversation();
        if (!convId) return;
      }
      const response = await sendMessage(content, inputType, convId);
      if (response && inputType === "voice") speak(response);
    },
    [activeConversationId, createConversation, sendMessage, speak]
  );

  handleSendRef.current = handleSend;

  useEffect(() => {
    if (transcript && !isListening) handleSendRef.current?.(transcript, "voice");
  }, [transcript, isListening]);

  useEffect(() => {
    if (!isSpeaking && avatarState === "speaking")
      dispatch({ type: "SET_AVATAR_STATE", payload: "idle" });
  }, [isSpeaking, avatarState, dispatch]);

  const handleVoiceStart = useCallback(() => {
    dispatch({ type: "SET_AVATAR_STATE", payload: "listening" });
    startListening();
  }, [dispatch, startListening]);

  return (
    <div className="flex h-[100dvh] bg-[var(--bg)] overflow-hidden">

      {/* ── Mobile backdrop ── */}
      {mounted && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar ── */}
      {mounted && (
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={selectConversation}
          onNew={createConversation}
          onDelete={deleteConversation}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ── */}
        <header className="flex-shrink-0 h-12 px-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Abrir menú"
          >
            <PanelLeft size={16} strokeWidth={1.5} />
          </button>

          {/* Bot label */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-white">
                <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z"
                  fill="currentColor" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[var(--text-1)] truncate">Nexus</span>
            <span className="hidden sm:inline text-xs text-[var(--text-4)]">· UNIPUTUMAYO</span>
            {/* Online dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] flex-shrink-0" />
          </div>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle size="sm" />

            {mounted && user && (
              <>
                <button
                  onClick={() => { logout(); window.location.href = "/"; }}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-4)] hover:text-[var(--error)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--error-dim)]"
                  title="Cerrar sesión"
                >
                  Salir
                </button>
                <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center text-white text-[10px] font-bold uppercase flex-shrink-0">
                  {user.display_name?.[0] ?? "U"}
                </div>
              </>
            )}
          </div>
        </header>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[var(--error-dim)] border-b border-[var(--error)]/25 flex-shrink-0 animate-slide-down">
            <span className="flex items-center gap-2 text-xs text-[var(--error)] font-medium">
              <AlertCircle size={13} strokeWidth={2} /> {error}
            </span>
            <button
              onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)]/10"
            >
              <X size={11} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* ── Messages ── */}
        <MessageList
          messages={messages}
          sources={sources}
          isLoading={isLoading}
          onQuickReply={(msg) => handleSend(msg, "text")}
          avatarState={avatarState}
        />

        {/* ── Quick replies ── */}
        {messages.length > 0 && !isLoading && (
          <QuickReplies onSelect={(q) => handleSend(q, "text")} />
        )}

        {/* ── Input ── */}
        <ChatInput
          onSend={(msg) => handleSend(msg, "text")}
          onVoiceStart={handleVoiceStart}
          onVoiceStop={stopListening}
          isListening={isListening}
          isLoading={isLoading}
          isVoiceSupported={isSupported}
        />
      </div>
    </div>
  );
}
