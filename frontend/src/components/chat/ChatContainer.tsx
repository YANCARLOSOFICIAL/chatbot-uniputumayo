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
    conversations, activeConversationId, messages, sources, faqSuggestion,
    isLoading, avatarState, error,
    loadConversations, createConversation, selectConversation,
    sendMessage, cancelActiveStream, deleteConversation, renameConversation, dispatch,
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

  const { interimTranscript, micStatus, startListening, stopListening, cancelListening, error: sttError, isSupported } =
    useSpeechRecognition({
      onFinal: (transcript) => {
        dispatchAvatarEvent("SPEECH_FINAL");
        handleSendRef.current?.(transcript, "voice");
      },
      onCancelled: (reason) => {
        dispatchAvatarEvent("CANCEL");
        if (reason && reason !== "empty-recording" && reason !== "no-speech" && reason !== "cancelled") {
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
    // Inside the user's tap: unlock audio playback for browsers that block
    // programmatic play() outside a gesture (see useVoicePlayback.unlock).
    voicePlayback.unlock();
    setVoiceOverlayOpen(true);
    dispatchAvatarEvent("MIC_STARTED");
    startListening();
  }, [dispatchAvatarEvent, startListening, voicePlayback]);

  // "Detener" / close: abort the whole voice turn. The recording is
  // discarded (not transcribed and sent — see cancelListening), audio stops
  // and any in-flight answer is aborted.
  const handleVoiceCancel = useCallback(() => {
    cancelListening();
    voicePlayback.stop();
    cancelActiveStream();
    dispatchAvatarEvent("CANCEL");
    setVoiceOverlayOpen(false);
  }, [cancelListening, voicePlayback, cancelActiveStream, dispatchAvatarEvent]);

  // Barge-in: the user starts talking while Guaca is still speaking. Cuts
  // audio immediately and starts listening — a real conversation lets you
  // interrupt instead of waiting out the whole reply. Also aborts the
  // in-flight response stream if it's still generating (a sentence can
  // already be playing before the SSE stream finishes) — otherwise the
  // backend keeps burning tokens on an answer nobody will hear.
  const handleBargeIn = useCallback(() => {
    voicePlayback.stop();
    voicePlayback.unlock();
    cancelActiveStream();
    setVoiceError(null);
    dispatchAvatarEvent("MIC_STARTED");
    startListening();
  }, [voicePlayback, cancelActiveStream, dispatchAvatarEvent, startListening]);

  const handleSelectConversation = useCallback((id: string) => {
    selectConversation(id);
    setMobileSidebarOpen(false);
  }, [selectConversation]);

  const initials = user?.display_name
    ? user.display_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="chat-shell">

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
            style={{ width: sidebarOpen ? 272 : 0, zIndex: 1 }}
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
      <div className="chat-main" style={{ zIndex: 1 }}>

        <header className="chat-header">
          {/* Toggle */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="composer-btn only-mobile"
            aria-label="Abrir menú"
          >
            <PanelLeft size={18} strokeWidth={1.6} />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="composer-btn only-desktop"
            aria-label={sidebarOpen ? "Colapsar barra lateral" : "Expandir barra lateral"}
            title={sidebarOpen ? "Colapsar" : "Expandir"}
          >
            <PanelLeft size={17} strokeWidth={1.6} style={{ transform: sidebarOpen ? "none" : "scaleX(-1)" }} />
          </button>

          {/* Marca — el sidebar ya la muestra cuando está abierto en desktop */}
          <div
            className="chat-header-brand"
            data-sidebar={sidebarOpen ? "open" : "closed"}
          >
            <GuacamayaAvatar
              state={(avatarState as GuacamayaState) ?? "idle"}
              size={28}
              amplitude={voicePlayback.amplitude}
              className="flex-shrink-0"
            />
            <div style={{ minWidth: 0 }}>
              <div className="chat-title">
                Guaca
                <span
                  aria-label="En línea"
                  style={{
                    display: "inline-block", width: 5, height: 5, borderRadius: "50%",
                    background: "var(--success)", marginLeft: 6, verticalAlign: "middle",
                  }}
                />
              </div>
              <div className="chat-title-sub">Asistente UniPutumayo</div>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
            <ThemeToggle />
            {mounted && (
              authed && user ? (
                <>
                  <button
                    onClick={() => { logout(); window.location.href = "/"; }}
                    className="hidden sm:inline-flex btn btn-ghost btn-sm"
                    title="Cerrar sesión"
                  >
                    <LogOut size={12} /> Salir
                  </button>
                  <div
                    title={user.display_name}
                    style={{
                      width: 30, height: 30, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "var(--brand)", color: "var(--on-brand)",
                      borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                      letterSpacing: "0.02em", textTransform: "uppercase",
                    }}
                  >
                    {initials}
                  </div>
                </>
              ) : (
                <Link href="/admin/login" className="btn btn-secondary btn-sm" style={{ whiteSpace: "nowrap" }}>
                  <LogIn size={12} /> Iniciar sesión
                </Link>
              )
            )}
          </div>
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          sources={sources}
          faqSuggestion={faqSuggestion}
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
          <div className="guest-banner">
            <span style={{ flex: 1 }}>
              Esta conversación no se guardará.{" "}
              <Link href="/admin/login" style={{ color: "var(--brand)", fontWeight: 600 }}>
                Inicia sesión
              </Link>{" "}
              para conservar tu historial.
            </span>
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
