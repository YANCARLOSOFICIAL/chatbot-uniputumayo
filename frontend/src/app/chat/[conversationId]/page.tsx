"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { useChat } from "@/hooks/useChat";

export default function ConversationPage() {
  const params = useParams();
  const { selectConversation } = useChat();
  const conversationId = params.conversationId as string;

  useEffect(() => {
    if (conversationId) selectConversation(conversationId);
  }, [conversationId, selectConversation]);

  return <ChatContainer />;
}
