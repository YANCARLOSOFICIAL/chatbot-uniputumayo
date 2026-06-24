"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PanelLeft, LogOut } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { toast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { QuickReplies } from "./QuickReplies";
import { GuacamayaAvatar, type GuacamayaState } from "./GuacamayaAvatar";

// Carga diferida: el sidebar es pesado y no bloquea el primer paint del chat
const ConversationSidebar = dynamic(
  () => import("./ConversationSidebar").then((m) => ({ default: m.ConversationSidebar })),
  { ssr: false }
);

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

  // Show error as toast and clear from state
  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch({ type: "SET_ERROR", payload: null });
    }
  }, [error, dispatch]);

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

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) handleSend(lastUser.content, lastUser.input_type ?? "text");
  }, [messages, handleSend]);

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
        <header className="flex-shrink-0 h-14 px-4 border-b border-[var(--border)] bg-[var(--bg)] flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden w-9 h-9 rounded-md flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Abrir menú"
          >
            <PanelLeft size={20} strokeWidth={1.5} />
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <GuacamayaAvatar
              state={(avatarState as GuacamayaState) ?? "idle"}
              size={28}
              className="flex-shrink-0"
            />
            <span className="text-[15px] font-semibold text-[var(--text-1)] truncate">Nexus</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] flex-shrink-0" />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {mounted && user && (
              <>
                <button
                  onClick={() => { logout(); window.location.href = "/"; }}
                  className="hidden sm:flex items-center gap-1.5 text-[13px] text-[var(--text-3)] hover:text-[var(--error)] transition-colors px-2.5 py-1.5 rounded-md hover:bg-[var(--error-dim)]"
                  title="Cerrar sesión"
                >
                  <LogOut size={13} /> Salir
                </button>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: "linear-gradient(135deg, #1B6E94, #7BB52E)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.01em", textTransform: "uppercase",
                }}>
                  {(user.display_name?.split(" ").map((w) => w[0]).join("").slice(0, 2)) ?? "U"}
                </div>
              </>
            )}
          </div>
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          sources={sources}
          isLoading={isLoading}
          onQuickReply={(msg) => handleSend(msg, "text")}
          onRegenerate={handleRegenerate}
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
