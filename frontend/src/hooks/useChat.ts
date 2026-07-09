"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChatContext } from "@/context/ChatContext";
import { apiClient } from "@/lib/api/client";
import { isAuthenticated } from "@/lib/auth";
import type { Message } from "@/types/chat";

const _GUEST_CONV_KEY = "guest_conv_id";

export function useChat() {
  const { state, dispatch } = useChatContext();
  const messagesRef = useRef(state.messages);
  messagesRef.current = state.messages;

  // Aborts any in-flight stream if the component unmounts mid-response.
  const activeStreamController = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => activeStreamController.current?.abort();
  }, []);

  // ── Guest session lifecycle ──────────────────────────────────────────────

  // Ref keeps a stable pointer to selectConversation so the mount effect
  // doesn't need it in its dependency array (avoids re-running on each render).
  const selectConvRef = useRef<((id: string) => Promise<void>) | null>(null);

  // 1. On mount: restore a guest conversation saved in sessionStorage (e.g. after page refresh)
  useEffect(() => {
    if (isAuthenticated()) return;
    const savedId = sessionStorage.getItem(_GUEST_CONV_KEY);
    if (savedId && selectConvRef.current) {
      selectConvRef.current(savedId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Keep sessionStorage in sync with the active guest conversation
  useEffect(() => {
    if (isAuthenticated()) {
      sessionStorage.removeItem(_GUEST_CONV_KEY);
      return;
    }
    if (state.activeConversationId) {
      sessionStorage.setItem(_GUEST_CONV_KEY, state.activeConversationId);
    }
  }, [state.activeConversationId]);

  // 3. On tab/window close: delete the guest conversation via sendBeacon
  useEffect(() => {
    const handleUnload = () => {
      const guestId = sessionStorage.getItem(_GUEST_CONV_KEY);
      if (guestId) {
        apiClient.guestClose(guestId);
        sessionStorage.removeItem(_GUEST_CONV_KEY);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // ────────────────────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated()) return; // guests don't have persistent history
    try {
      const data = await apiClient.getConversations();
      dispatch({
        type: "SET_CONVERSATIONS",
        payload: data.map((c) => ({
          id: c.id,
          user_id: null,
          title: c.title,
          language: "es",
          is_active: true,
          created_at: c.created_at,
          updated_at: c.updated_at,
        })),
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error.message : "Error cargando conversaciones",
      });
    }
  }, [dispatch]);

  const createConversation = useCallback(async () => {
    try {
      const data = await apiClient.createConversation();
      const conversation = {
        id: data.id,
        user_id: null,
        title: data.title,
        language: "es",
        is_active: true,
        created_at: data.created_at,
        updated_at: data.created_at,
      };
      dispatch({ type: "ADD_CONVERSATION", payload: conversation });
      dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: data.id });
      return data.id;
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error.message : "Error creando conversación",
      });
      return null;
    }
  }, [dispatch]);

  const selectConversation = useCallback(
    async (conversationId: string) => {
      dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: conversationId });
      dispatch({ type: "SET_ERROR", payload: null });
      try {
        const messages = await apiClient.getMessages(conversationId);
        dispatch({ type: "SET_MESSAGES", payload: messages as unknown as Message[] });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Error cargando mensajes",
        });
      }
    },
    [dispatch]
  );
  // Keep the mount-effect ref current after selectConversation is defined
  selectConvRef.current = selectConversation;

  const sendMessage = useCallback(
    async (
      content: string,
      inputType: "text" | "voice" = "text",
      conversationId?: string,
      llmProvider?: string,
      llmModel?: string,
      voice?: { enqueueDelta: (token: string) => void; flush: () => void },
    ) => {
      const convId = conversationId || state.activeConversationId;
      if (!convId) return;

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "AVATAR_EVENT", payload: "REQUEST_SENT" });
      dispatch({ type: "SET_ERROR", payload: null });

      // Optimistically add user message
      const tempUserId = `temp-user-${Date.now()}`;
      const tempUserMessage: Message = {
        id: tempUserId,
        conversation_id: convId,
        role: "user",
        content,
        input_type: inputType,
        tokens_used: null,
        llm_provider: null,
        llm_model: null,
        response_time_ms: null,
        created_at: new Date().toISOString(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: tempUserMessage });

      // Placeholder para el mensaje del asistente mientras llega el stream
      const streamingId = `streaming-${Date.now()}`;
      const streamingMessage: Message = {
        id: streamingId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        input_type: "text",
        tokens_used: null,
        llm_provider: null,
        llm_model: null,
        response_time_ms: null,
        created_at: new Date().toISOString(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: streamingMessage });

      let assistantContent = "";
      const controller = new AbortController();
      activeStreamController.current = controller;

      try {
        await apiClient.sendMessageStream(
          convId,
          content,
          inputType,
          (event) => {
            const e = event as {
              type: string;
              sources?: unknown[];
              content?: string;
              user_message?: unknown;
              assistant_message?: unknown;
              message?: string;
            };

            if (e.type === "sources" && e.sources) {
              dispatch({
                type: "SET_SOURCES",
                payload: (e.sources as Array<{
                  chunk_id: string;
                  document_title: string;
                  content_preview: string;
                  score: number;
                  program: string | null;
                  faculty: string | null;
                  citation_number: number;
                }>).map((s) => ({
                  chunk_id: s.chunk_id,
                  document_title: s.document_title,
                  content_preview: s.content_preview,
                  score: s.score,
                  program: s.program ?? null,
                  faculty: s.faculty ?? null,
                  citation_number: s.citation_number,
                })),
              });
            } else if (e.type === "token" && e.content) {
              assistantContent += e.content;
              dispatch({
                type: "UPDATE_MESSAGE_CONTENT",
                payload: { id: streamingId, append: e.content },
              });
              voice?.enqueueDelta(e.content);
            } else if (e.type === "done") {
              const currentMessages = messagesRef.current.filter(
                (m) => m.id !== tempUserId && m.id !== streamingId
              );
              dispatch({
                type: "SET_MESSAGES",
                payload: [
                  ...currentMessages,
                  e.user_message as unknown as Message,
                  e.assistant_message as unknown as Message,
                ],
              });
              if (voice) {
                // Avatar stays "thinking" until the queued TTS audio actually
                // starts playing (see useVoicePlayback onPlaybackStarted).
                voice.flush();
              } else {
                dispatch({ type: "AVATAR_EVENT", payload: "RESPONSE_DONE_NO_TTS" });
              }
            } else if (e.type === "error") {
              throw new Error(e.message || "Error del servidor");
            }
          },
          llmProvider,
          llmModel,
          controller.signal,
        );

        return assistantContent;
      } catch (error) {
        // Keep the user's message and whatever partial answer already
        // streamed in — losing both on a mid-stream failure is confusing and
        // gives the user nothing to retry. An empty partial answer becomes a
        // placeholder so the "last bot message" regenerate button still
        // appears (MessageList only shows it when a bot message exists).
        dispatch({
          type: "SET_MESSAGES",
          payload: [
            ...messagesRef.current.filter((m) => m.id !== tempUserId && m.id !== streamingId),
            tempUserMessage,
            {
              ...streamingMessage,
              content: assistantContent.trim() || "⚠️ No se pudo completar la respuesta.",
            },
          ],
        });
        dispatch({ type: "AVATAR_EVENT", payload: "ERROR" });
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Error enviando mensaje",
        });
        return null;
      } finally {
        activeStreamController.current = null;
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [state.activeConversationId, dispatch]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await apiClient.deleteConversation(conversationId);
        dispatch({ type: "REMOVE_CONVERSATION", payload: conversationId });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Error eliminando conversación",
        });
      }
    },
    [dispatch]
  );

  const renameConversation = useCallback(
    async (conversationId: string, title: string) => {
      try {
        await apiClient.renameConversation(conversationId, title);
        dispatch({ type: "RENAME_CONVERSATION", payload: { id: conversationId, title } });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Error renombrando conversación",
        });
      }
    },
    [dispatch]
  );

  return {
    ...state,
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    renameConversation,
    dispatch,
  };
}
