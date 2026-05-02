"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { AlertCircle, X, PanelLeft, LogOut } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { QuickReplies } from "./QuickReplies";
import { ConversationSidebar } from "./ConversationSidebar";
import { GuacamayaAvatar, type GuacamayaState } from "./GuacamayaAvatar";

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

      {/* Mobile backdrop */}
      {mounted && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
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

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar — compact, clean */}
        <header className="flex-shrink-0 h-11 px-3 border-b border-[var(--border)] bg-[var(--bg)] flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Abrir menú"
          >
            <PanelLeft size={15} strokeWidth={1.5} />
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <GuacamayaAvatar
              state={(avatarState as GuacamayaState) ?? "idle"}
              size={24}
              className="flex-shrink-0"
            />
            <span className="text-[13px] font-semibold text-[var(--text-1)] truncate">Nexus</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] flex-shrink-0" />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {mounted && user && (
              <>
                <button
                  onClick={() => { logout(); window.location.href = "/"; }}
                  className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--text-3)] hover:text-[var(--error)] transition-colors px-1.5 py-1 rounded-md hover:bg-[var(--error-dim)]"
                  title="Cerrar sesión"
                >
                  <LogOut size={11} /> Salir
                </button>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold uppercase flex-shrink-0" style={{ background: "var(--brand-accent)" }}>
                  {user.display_name?.[0] ?? "U"}
                </div>
              </>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-[var(--error-dim)] border-b border-[var(--error)]/20 flex-shrink-0 animate-slide-down">
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--error)] font-medium">
              <AlertCircle size={12} strokeWidth={2} /> {error}
            </span>
            <button
              onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)]/10"
            >
              <X size={10} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Messages */}
        <MessageList
          messages={messages}
          sources={sources}
          isLoading={isLoading}
          onQuickReply={(msg) => handleSend(msg, "text")}
          avatarState={avatarState}
        />

        {/* Quick replies */}
        {messages.length > 0 && !isLoading && (
          <QuickReplies onSelect={(q) => handleSend(q, "text")} />
        )}

        {/* Input */}
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
