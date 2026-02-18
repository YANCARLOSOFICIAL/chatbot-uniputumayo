"use client";

import { useEffect, useCallback, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ConversationSidebar } from "./ConversationSidebar";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";

export function ChatContainer() {
  const {
    conversations,
    activeConversationId,
    messages,
    sources,
    isLoading,
    avatarState,
    error,
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    dispatch,
  } = useChat();

  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    isSupported: isVoiceSupported,
  } = useSpeechRecognition();

  const { speak, isSpeaking } = useSpeechSynthesis();

  const handleSendRef = useRef<((content: string, inputType: "text" | "voice") => Promise<void>) | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSend = useCallback(
    async (content: string, inputType: "text" | "voice" = "text") => {
      let convId = activeConversationId;
      if (!convId) {
        convId = await createConversation();
        if (!convId) return;
      }
      const response = await sendMessage(content, inputType, convId);
      if (response && inputType === "voice") {
        speak(response);
      }
    },
    [activeConversationId, createConversation, sendMessage, speak]
  );

  handleSendRef.current = handleSend;

  // Handle voice transcript
  useEffect(() => {
    if (transcript && !isListening) {
      handleSendRef.current?.(transcript, "voice");
    }
  }, [transcript, isListening]);

  // Sync speaking state with avatar
  useEffect(() => {
    if (!isSpeaking && avatarState === "speaking") {
      dispatch({ type: "SET_AVATAR_STATE", payload: "idle" });
    }
  }, [isSpeaking, avatarState, dispatch]);

  const handleVoiceStart = useCallback(() => {
    dispatch({ type: "SET_AVATAR_STATE", payload: "listening" });
    startListening();
  }, [dispatch, startListening]);

  const handleVoiceStop = useCallback(() => {
    stopListening();
  }, [stopListening]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={selectConversation}
        onNew={createConversation}
        onDelete={deleteConversation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Avatar */}
        <div className="border-b border-gray-100">
          <AvatarDisplay state={avatarState} />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
              className="text-red-500 hover:text-red-700"
            >
              &times;
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

        {/* Input */}
        <ChatInput
          onSend={(msg) => handleSend(msg, "text")}
          onVoiceStart={handleVoiceStart}
          onVoiceStop={handleVoiceStop}
          isListening={isListening}
          isLoading={isLoading}
          isVoiceSupported={isVoiceSupported}
        />
      </div>
    </div>
  );
}
