"use client";

import { cn } from "@/lib/utils/cn";
import type { AvatarState } from "@/types/avatar";

interface AvatarDisplayProps {
  state: AvatarState;
}

export function AvatarDisplay({ state }: AvatarDisplayProps) {
  return (
    <div className="flex flex-col items-center py-4">
      <div
        className={cn(
          "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
          {
            "bg-green-100": state === "idle",
            "bg-blue-100 animate-pulse": state === "listening",
            "bg-yellow-100": state === "thinking",
            "bg-green-200": state === "speaking",
          }
        )}
      >
        {/* Avatar face */}
        <div className="relative w-16 h-16">
          {/* Eyes */}
          <div className="absolute top-3 left-2 flex gap-4">
            <div
              className={cn(
                "w-3 h-3 rounded-full bg-gray-800 transition-all",
                {
                  "animate-blink": state === "idle",
                  "w-3.5 h-3.5": state === "listening",
                  "animate-spin-slow": state === "thinking",
                }
              )}
            />
            <div
              className={cn(
                "w-3 h-3 rounded-full bg-gray-800 transition-all",
                {
                  "animate-blink": state === "idle",
                  "w-3.5 h-3.5": state === "listening",
                  "animate-spin-slow": state === "thinking",
                }
              )}
            />
          </div>
          {/* Mouth */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <div
              className={cn("transition-all duration-300", {
                "w-6 h-2 bg-gray-700 rounded-full": state === "idle",
                "w-4 h-4 bg-gray-700 rounded-full": state === "listening",
                "w-3 h-3 bg-gray-700 rounded-full animate-pulse":
                  state === "thinking",
                "w-6 h-4 bg-gray-700 rounded-b-full rounded-t-sm animate-bounce":
                  state === "speaking",
              })}
            />
          </div>
        </div>

        {/* Listening ring animation */}
        {state === "listening" && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
            <div className="absolute inset-[-4px] rounded-full border-2 border-blue-300 animate-pulse opacity-20" />
          </>
        )}

        {/* Thinking dots */}
        {state === "thinking" && (
          <div className="absolute -bottom-2 flex gap-1">
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:0ms]" />
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        {/* Speaking waves */}
        {state === "speaking" && (
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="w-2 h-1 bg-green-500 rounded-full animate-pulse [animation-delay:0ms]" />
            <div className="w-3 h-1 bg-green-500 rounded-full animate-pulse [animation-delay:100ms]" />
            <div className="w-2 h-1 bg-green-500 rounded-full animate-pulse [animation-delay:200ms]" />
          </div>
        )}
      </div>

      <span className="mt-2 text-xs text-gray-500 font-medium">
        {state === "idle" && "IUP Bot"}
        {state === "listening" && "Escuchando..."}
        {state === "thinking" && "Pensando..."}
        {state === "speaking" && "Hablando..."}
      </span>
    </div>
  );
}
