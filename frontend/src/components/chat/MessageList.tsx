"use client";

import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { SourceCard } from "./SourceCard";
import { QuickReplies } from "./QuickReplies";
import { MiniGuacamaya } from "@/components/avatar/AvatarDisplay";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import type { Message, SourceInfo } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  sources: SourceInfo[];
  isLoading: boolean;
  onQuickReply?: (text: string) => void;
}

export function MessageList({ messages, sources, isLoading, onQuickReply }: MessageListProps) {
  const scrollRef = useAutoScroll(messages);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6 bg-gray-50/50"
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 mb-4">
            <MiniGuacamaya className="w-full h-full" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Bienvenido a Nexus UniPutumayo
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Soy Nexus, el asistente virtual de la Institución Universitaria del
            Putumayo. Pregúntame sobre programas académicos, pensum, requisitos
            de admisión y más.
          </p>
          {onQuickReply && <QuickReplies onSelect={onQuickReply} />}
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {sources.length > 0 && <SourceCard sources={sources} />}

      {isLoading && <TypingIndicator />}
    </div>
  );
}
