"use client";

import { cn } from "@/lib/utils/cn";
import type { Message } from "@/types/chat";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full mb-4", {
        "justify-end": isUser,
        "justify-start": !isUser,
      })}
    >
      <div
        className={cn("max-w-[80%] rounded-2xl px-4 py-3 shadow-sm", {
          "bg-green-700 text-white rounded-br-md": isUser,
          "bg-white text-gray-900 border border-gray-200 rounded-bl-md": !isUser,
        })}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-green-700">IUP Bot</span>
            {message.input_type === "voice" && (
              <span className="text-xs text-gray-400">via voz</span>
            )}
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>
        <div
          className={cn("flex items-center gap-2 mt-1", {
            "justify-end": isUser,
            "justify-start": !isUser,
          })}
        >
          <span
            className={cn("text-xs", {
              "text-green-200": isUser,
              "text-gray-400": !isUser,
            })}
          >
            {new Date(message.created_at).toLocaleTimeString("es-CO", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.response_time_ms && (
            <span className="text-xs text-gray-400">
              {(message.response_time_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
