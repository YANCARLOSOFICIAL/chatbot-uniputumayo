"use client";

import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { SourceCard } from "./SourceCard";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import type { Message, SourceInfo } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  sources: SourceInfo[];
  isLoading: boolean;
}

export function MessageList({ messages, sources, isLoading }: MessageListProps) {
  const scrollRef = useAutoScroll(messages);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6"
    >
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Bienvenido al Chatbot IUP
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Soy el asistente virtual de la Institución Universitaria del
            Putumayo. Pregúntame sobre programas académicos, pensum, requisitos
            de admisión y más.
          </p>
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
