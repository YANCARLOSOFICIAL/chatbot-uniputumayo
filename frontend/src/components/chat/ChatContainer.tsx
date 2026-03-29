"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, X, Home, Settings, Sparkles, PanelLeft, LogOut } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
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
      {/* ── Sidebar Drawer (Mobile Responsive) ── */}
      {mounted && (
        <>
          {/* Backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden animate-fade-in transition-opacity duration-200"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          )}

          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={selectConversation}
            onNew={createConversation}
            onDelete={deleteConversation}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </>
      )}

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* ── Bot Header: Avatar + Info ── */}
        <header className="flex-shrink-0 px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
            {/* Left: Avatar + Bot Info */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Bot Avatar + Info */}
              <div className="flex items-center gap-3">
                {/* Bot avatar - Guacamaya */}
                <div className="w-10 h-10 rounded-lg bg-gradient-brand flex items-center justify-center shadow-md glow-pulse flex-shrink-0 overflow-hidden">
                  <AvatarDisplay state={avatarState} size="sm" />
                </div>

                {/* Bot name and subtitle */}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--text-1)]">Nexus</p>
                  <p className="text-xs text-[var(--text-4)]">Asistente UNIPUTUMAYO</p>
                </div>
              </div>
            </div>

            {/* Right: Chat Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <ThemeToggle size="sm" />

              {mounted && user && (
                <button
                  onClick={() => { logout(); window.location.href = "/"; }}
                  className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-[var(--text-3)] hover:bg-[var(--error-dim)] hover:text-[var(--error)] transition-all duration-200"
                  title="Cerrar sesión"
                >
                  <LogOut size={15} strokeWidth={1.5} />
                </button>
              )}

              {mounted && user && (
                <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm flex-shrink-0">
                  {user.display_name?.[0] ?? "U"}
                </div>
              )}

              {/* Sidebar toggle - visible always */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--brand)] transition-colors duration-200"
                aria-label="Alternar panel"
              >
                <PanelLeft size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[var(--error-dim)] border-b border-[var(--error)] border-opacity-30 flex-shrink-0 animate-slide-down">
            <span className="flex items-center gap-2 text-xs text-[var(--error)] font-medium">
              <AlertCircle size={14} strokeWidth={2} /> {error}
            </span>
            <button
              onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
              className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* ── Messages Area ── */}
        <MessageList
          messages={messages}
          sources={sources}
          isLoading={isLoading}
          onQuickReply={(msg) => handleSend(msg, "text")}
          avatarState={avatarState}
        />

        {/* ── Quick Replies ── */}
        {messages.length > 0 && !isLoading && (
          <QuickReplies onSelect={(q) => handleSend(q, "text")} />
        )}

        {/* ── Chat Input ── */}
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
