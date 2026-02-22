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
      className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 bg-gray-50/50"
    >
      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4">
            <MiniGuacamaya className="w-full h-full" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
            Hola, soy Nexus
          </h3>
          <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
            El asistente virtual de la Institución Universitaria del Putumayo.
            Pregúntame sobre programas académicos, pensum, requisitos de admisión y más.
          </p>
          {onQuickReply && (
            <div className="mt-6 w-full max-w-sm">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">
                Sugerencias
              </p>
              <QuickReplies onSelect={onQuickReply} />
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Sources */}
      {sources.length > 0 && <SourceCard sources={sources} />}

      {/* Typing indicator */}
      {isLoading && <TypingIndicator />}
    </div>
  );
}
