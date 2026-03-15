"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, X, Home, Settings, Sparkles, PanelLeft } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { isAuthenticated, getUser, type AuthUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { QuickReplies } from "./QuickReplies";
import { ConversationSidebar } from "./ConversationSidebar";

export function ChatContainer() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

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

      {/* ── Sidebar ── */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={selectConversation}
        onNew={createConversation}
        onDelete={deleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* ── Top header ── */}
        <header className="flex items-center gap-2 px-3 sm:px-4 h-14 border-b border-[var(--border)] flex-shrink-0 bg-[var(--bg)] z-10">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-all"
            aria-label="Alternar panel"
          >
            <PanelLeft size={18} />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm ring-2 ring-emerald-500/20 flex-shrink-0">
              <Sparkles size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-1)] leading-none">Nexus</p>
              <p className="text-[10px] text-[var(--text-4)] leading-none mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                En línea · UNIPUTUMAYO
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ThemeToggle size="sm" />

            <Link
              href="/"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-all"
              aria-label="Inicio"
              title="Inicio"
            >
              <Home size={16} />
            </Link>

            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)] text-white text-xs font-medium hover:bg-[var(--brand-hover)] transition-all shadow-sm"
              >
                <Settings size={12} />
                Panel admin
              </Link>
            )}

            {/* User avatar */}
            {user && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand)] to-teal-600 flex items-center justify-center text-white text-xs font-bold uppercase flex-shrink-0 ml-0.5">
                {user.display_name?.[0] ?? "U"}
              </div>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[var(--brand-dim)] border-b border-[var(--brand)] border-opacity-20 flex-shrink-0">
            <span className="flex items-center gap-2 text-xs text-[var(--brand)]">
              <AlertCircle size={13} /> {error}
            </span>
            <button
              onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
              className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[var(--brand)] hover:bg-[var(--brand-dim)] transition-all"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Messages */}
        <MessageList
          messages={messages}
          sources={sources}
          isLoading={isLoading}
          onQuickReply={(msg) => handleSend(msg, "text")}
        />

        {/* Quick reply chips — show when there are messages */}
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
