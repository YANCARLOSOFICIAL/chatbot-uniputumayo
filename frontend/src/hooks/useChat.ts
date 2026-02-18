"use client";

import { useCallback, useRef } from "react";
import { useChatContext } from "@/context/ChatContext";
import { apiClient } from "@/lib/api/client";
import type { Message } from "@/types/chat";

export function useChat() {
  const { state, dispatch } = useChatContext();
  const messagesRef = useRef(state.messages);
  messagesRef.current = state.messages;

  const loadConversations = useCallback(async () => {
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
        dispatch({
          type: "SET_MESSAGES",
          payload: messages as unknown as Message[],
        });
      } catch (error) {
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Error cargando mensajes",
        });
      }
    },
    [dispatch]
  );

  const sendMessage = useCallback(
    async (content: string, inputType: "text" | "voice" = "text", conversationId?: string) => {
      const convId = conversationId || state.activeConversationId;
      if (!convId) return;

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_AVATAR_STATE", payload: "thinking" });
      dispatch({ type: "SET_ERROR", payload: null });

      // Optimistically add user message
      const tempUserMessage: Message = {
        id: `temp-${Date.now()}`,
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

      try {
        const response = await apiClient.sendMessage(
          convId,
          content,
          inputType
        );

        // Use ref to get current messages (avoids stale closure)
        const currentMessages = messagesRef.current.filter(
          (m) => m.id !== tempUserMessage.id
        );
        dispatch({
          type: "SET_MESSAGES",
          payload: [
            ...currentMessages,
            response.user_message as unknown as Message,
            response.assistant_message as unknown as Message,
          ],
        });

        dispatch({
          type: "SET_SOURCES",
          payload: response.sources.map((s) => ({
            chunk_id: s.chunk_id,
            document_title: s.document_title,
            content_preview: s.content_preview,
            score: s.score,
            program: s.program ?? null,
            faculty: s.faculty ?? null,
          })),
        });

        dispatch({ type: "SET_AVATAR_STATE", payload: "speaking" });

        // Return assistant content for TTS
        return (response.assistant_message as unknown as Message).content;
      } catch (error) {
        // Remove optimistic message on error
        dispatch({
          type: "SET_MESSAGES",
          payload: messagesRef.current.filter((m) => m.id !== tempUserMessage.id),
        });
        dispatch({
          type: "SET_ERROR",
          payload: error instanceof Error ? error.message : "Error enviando mensaje",
        });
        return null;
      } finally {
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

  return {
    ...state,
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    dispatch,
  };
}
