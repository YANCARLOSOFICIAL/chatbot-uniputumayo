"use client";

import { cn } from "@/lib/utils/cn";
import { MiniGuacamaya } from "@/components/avatar/AvatarDisplay";
import type { Message } from "@/types/chat";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full mb-3 sm:mb-4", {
        "justify-end": isUser,
        "justify-start": !isUser,
      })}
    >
      {/* Bot avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mr-2 mt-1 self-end">
          <MiniGuacamaya className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[88%] sm:max-w-[78%] lg:max-w-[70%] px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-sm",
          isUser
            ? "bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-600)] text-white rounded-2xl rounded-br-sm"
            : "bg-white text-gray-900 border border-gray-100 border-l-[3px] border-l-[var(--primary-400)] rounded-2xl rounded-bl-sm"
        )}
      >
        {/* Bot label */}
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold text-[var(--primary-600)]">Nexus</span>
            {message.input_type === "voice" && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-100">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                voz
              </span>
            )}
          </div>
        )}

        {/* User voice badge */}
        {isUser && message.input_type === "voice" && (
          <div className="flex justify-end mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] text-green-200/80">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              voz
            </span>
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">
          {message.content}
        </p>

        {/* Footer: time + response time */}
        <div
          className={cn("flex items-center gap-2 mt-1.5", {
            "justify-end": isUser,
            "justify-start": !isUser,
          })}
        >
          <span className={cn("text-[10px]", isUser ? "text-green-200/70" : "text-gray-400")}>
            {new Date(message.created_at).toLocaleTimeString("es-CO", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.response_time_ms && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {(message.response_time_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* User avatar placeholder */}
      {isUser && (
        <div className="flex-shrink-0 ml-2 mt-1 self-end">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[var(--primary-400)] to-[var(--primary-600)] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
