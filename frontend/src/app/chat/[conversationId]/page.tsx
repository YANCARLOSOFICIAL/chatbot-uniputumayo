"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { useChatContext } from "@/context/ChatContext";

export default function ConversationPage() {
  const params = useParams();
  const { dispatch } = useChatContext();
  const conversationId = params.conversationId as string;

  useEffect(() => {
    if (conversationId) {
      dispatch({
        type: "SET_ACTIVE_CONVERSATION",
        payload: conversationId,
      });
    }
  }, [conversationId, dispatch]);

  return <ChatContainer />;
}
