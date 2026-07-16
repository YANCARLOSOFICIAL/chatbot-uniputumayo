"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PanelLeft, LogOut, LogIn } from "lucide-react";
import Link from "next/link";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useVoicePlayback } from "@/hooks/useVoicePlayback";
import type { AvatarEvent } from "@/lib/avatarMachine";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
import { toast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { QuickReplies } from "./QuickReplies";
import { GuacamayaAvatar, type GuacamayaState } from "./GuacamayaAvatar";
import { VoiceModeOverlay } from "./VoiceModeOverlay";

const ConversationSidebar = dynamic(
  () => import("./ConversationSidebar").then((m) => ({ default: m.ConversationSidebar })),
  { ssr: false }
);

export function ChatContainer() {
  const [sidebarOpen, setSidebarOpen] = useState(true); // desktop: open by default
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const {
    conversations, activeConversationId, messages, sources,
    isLoading, avatarState, error,
    loadConversations, createConversation, selectConversation,
    sendMessage, deleteConversation, renameConversation, dispatch,
  } = useChat();

  // Prevents double-tap / rapid calls from creating two conversations simultaneously
  const creatingConvRef = useRef(false);

  const handleSendRef = useRef<
    ((content: string, inputType: "text" | "voice") => Promise<void>) | null
  >(null);

  // Tracks which AVATAR_EVENT most recently fired, so the idle-transition
  // effect below can tell "Guaca just finished answering" (keep the
  // conversation going) apart from "the user/an error ended this turn"
  // (close the overlay). Only events dispatched from this component matter —
  // see the effect for why that's sufficient.
  const lastAvatarEventRef = useRef<AvatarEvent | null>(null);
  const dispatchAvatarEvent = useCallback(
    (payload: AvatarEvent) => {
      lastAvatarEventRef.current = payload;
      dispatch({ type: "AVATAR_EVENT", payload });
    },
    [dispatch]
  );

  const voicePlayback = useVoicePlayback({
    onPlaybackStarted: () => dispatchAvatarEvent("TTS_CHUNK_PLAYBACK_STARTED"),
    onQueueDrained: () => dispatchAvatarEvent("TTS_QUEUE_DRAINED"),
    onPlaybackFailed: () => dispatchAvatarEvent("ERROR"),
    onError: (msg) => toast.error(msg),
  });

  const { interimTranscript, micStatus, startListening, stopListening, error: sttError, isSupported } =
    useSpeechRecognition({
      onFinal: (transcript) => {
        dispatchAvatarEvent("SPEECH_FINAL");
        handleSendRef.current?.(transcript, "voice");
      },
      onCancelled: (reason) => {
        dispatchAvatarEvent("CANCEL");
        if (reason && reason !== "empty-recording" && reason !== "no-speech") {
          toast.error("No se pudo capturar audio. Intenta de nuevo.");
        }
      },
    });

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch({ type: "SET_ERROR", payload: null });
    }
  }, [error, dispatch]);

  useEffect(() => {
    setVoiceError(sttError);
  }, [sttError]);

  useEffect(() => {
    const a = isAuthenticated();
    setAuthed(a);
    if (a) setUser(getUser());
    loadConversations();
    setMounted(true);
  }, [loadConversations]);

  // Force everything back to a clean idle state on unmount — never leave the
  // mic, TTS queue, or avatarState hanging mid-flight.
  useEffect(() => {
    return () => {
      stopListening();
      voicePlayback.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What happens a beat after the avatar settles back to idle depends on WHY
  // it got there: if Guaca just finished speaking, keep the conversation
  // going hands-free by listening again; anything else (the user cancelled,
  // said nothing, or something errored) ends the voice session. This is what
  // turns voice mode from "one question per tap" into a real back-and-forth.
  const prevAvatarStateRef = useRef(avatarState);
  useEffect(() => {
    const prev = prevAvatarStateRef.current;
    prevAvatarStateRef.current = avatarState;
    if (!voiceOverlayOpen || avatarState !== "idle" || prev === "idle") return;

    if (lastAvatarEventRef.current === "TTS_QUEUE_DRAINED") {
      const t = setTimeout(() => {
        setVoiceError(null);
        dispatchAvatarEvent("MIC_STARTED");
        startListening();
      }, 550);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setVoiceOverlayOpen(false), 450);
    return () => clearTimeout(t);
  }, [voiceOverlayOpen, avatarState, dispatchAvatarEvent, startListening]);

  const handleSend = useCallback(
    async (content: string, inputType: "text" | "voice" = "text") => {
      let convId = activeConversationId;
      if (!convId) {
        if (creatingConvRef.current) return;
        creatingConvRef.current = true;
        try {
          convId = await createConversation();
        } finally {
          creatingConvRef.current = false;
        }
        if (!convId) return;
      }
      if (inputType === "voice") voicePlayback.beginResponse();
      await sendMessage(
        content,
        inputType,
        convId,
        undefined,
        undefined,
        inputType === "voice"
          ? { enqueueDelta: voicePlayback.enqueueDelta, flush: voicePlayback.flush }
          : undefined
      );
    },
    [activeConversationId, createConversation, sendMessage, voicePlayback]
  );

  handleSendRef.current = handleSend;

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) handleSend(lastUser.content, lastUser.input_type ?? "text");
  }, [messages, handleSend]);

  const handleVoiceStart = useCallback(() => {
    setVoiceError(null);
    setVoiceOverlayOpen(true);
    dispatchAvatarEvent("MIC_STARTED");
    startListening();
  }, [dispatchAvatarEvent, startListening]);

  const handleVoiceCancel = useCallback(() => {
    stopListening();
    voicePlayback.stop();
    dispatchAvatarEvent("CANCEL");
    setVoiceOverlayOpen(false);
  }, [stopListening, voicePlayback, dispatchAvatarEvent]);

  // Barge-in: the user starts talking while Guaca is still speaking. Cuts
  // audio immediately and starts listening — a real conversation lets you
  // interrupt instead of waiting out the whole reply.
  const handleBargeIn = useCallback(() => {
    voicePlayback.stop();
    setVoiceError(null);
    dispatchAvatarEvent("MIC_STARTED");
    startListening();
  }, [voicePlayback, dispatchAvatarEvent, startListening]);

  const handleSelectConversation = useCallback((id: string) => {
    selectConversation(id);
    setMobileSidebarOpen(false);
  }, [selectConversation]);

  const initials = user?.display_name
    ? user.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="flex h-[100dvh] bg-[var(--bg)] overflow-hidden relative">

      {mounted && voiceOverlayOpen && (
        <VoiceModeOverlay
          isOpen={voiceOverlayOpen}
          avatarState={(avatarState as GuacamayaState) ?? "idle"}
          interimTranscript={interimTranscript}
          micStatus={micStatus}
          amplitude={voicePlayback.amplitude}
          error={voiceError}
          onCancel={handleVoiceCancel}
          onBargeIn={handleBargeIn}
        />
      )}

      {/* Mobile backdrop */}
      {mounted && mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — desktop persistent/collapsible, mobile overlay */}
      {mounted && (
        <>
          {/* Desktop sidebar */}
          <div
            className="hidden md:block flex-shrink-0 overflow-hidden transition-all duration-200 relative"
            style={{ width: sidebarOpen ? 260 : 0, zIndex: 1 }}
            aria-hidden={!sidebarOpen}
          >
            <ConversationSidebar
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={handleSelectConversation}
              onNew={createConversation}
              onDelete={deleteConversation}
              onRename={renameConversation}
              isOpen
              onClose={() => {}}
            />
          </div>

          {/* Mobile overlay sidebar */}
          <div className="md:hidden">
            <ConversationSidebar
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={handleSelectConversation}
              onNew={createConversation}
              onDelete={deleteConversation}
              onRename={renameConversation}
              isOpen={mobileSidebarOpen}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative" style={{ zIndex: 1 }}>

        {/* Top bar — flat, blends into the canvas like ChatGPT's borderless
            header (no card/glass chrome, just a hairline separator). */}
        <header className="flex-shrink-0 h-14 px-3 flex items-center gap-2" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
          {/* Toggle buttons */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden w-9 h-9 rounded-md flex items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label="Abrir menú"
          >
            <PanelLeft size={20} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex w-9 h-9 rounded-md items-center justify-center text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)] transition-colors"
            aria-label={sidebarOpen ? "Colapsar barra lateral" : "Expandir barra lateral"}
            title={sidebarOpen ? "Colapsar" : "Expandir"}
          >
            <PanelLeft size={18} strokeWidth={1.5} style={{ transform: sidebarOpen ? "none" : "scaleX(-1)" }} />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2 min-w-0 ml-1">
            <GuacamayaAvatar
              state={(avatarState as GuacamayaState) ?? "idle"}
              size={26}
              amplitude={voicePlayback.amplitude}
              className="flex-shrink-0"
            />
            <span className="text-[14px] font-semibold text-[var(--text-1)] truncate" style={{ fontFamily: "var(--font-display)" }}>
              Guaca
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] flex-shrink-0" />
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {mounted && (
              authed && user ? (
                <>
                  <button
                    onClick={() => { logout(); window.location.href = "/"; }}
                    className="hidden sm:flex items-center gap-1.5 text-[12px] text-[var(--text-3)] hover:text-[var(--error)] transition-colors px-2 py-1.5 rounded-md hover:bg-[var(--error-dim)]"
                    title="Cerrar sesión"
                  >
                    <LogOut size={12} /> Salir
                  </button>
                  <div
                    title={user.display_name}
                    style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.01em", textTransform: "uppercase", cursor: "default" }}
                  >
                    {initials}
                  </div>
                </>
              ) : (
                <Link
                  href="/admin/login"
                  className="flex items-center gap-1.5 text-[12px] text-[var(--text-2)] hover:text-[var(--brand-primary)] transition-colors px-2.5 py-1.5 rounded-md border border-[var(--border)] hover:border-[var(--brand-primary)] font-medium"
                  style={{ whiteSpace: "nowrap" }}
                >
                  <LogIn size={12} /> Iniciar sesion
                </Link>
              )
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

        {/* Guest banner — subtle, dismissible */}
        {mounted && !authed && messages.length > 0 && (
          <div style={{ padding: "0 16px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 10, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", fontSize: 12 }}>
              <span style={{ color: "var(--text-2)", flex: 1 }}>
                Esta conversacion no se guardara.{" "}
                <Link href="/admin/login" style={{ color: "var(--brand-primary)", fontWeight: 600, textDecoration: "none" }}>
                  Inicia sesion
                </Link>{" "}
                para guardar tu historial.
              </span>
            </div>
          </div>
        )}

        {/* Input */}
        <ChatInput
          onSend={(msg) => handleSend(msg, "text")}
          onVoiceStart={handleVoiceStart}
          onVoiceStop={stopListening}
          isListening={micStatus !== "idle"}
          isLoading={isLoading}
          isVoiceSupported={isSupported}
        />
      </div>
    </div>
  );
}
