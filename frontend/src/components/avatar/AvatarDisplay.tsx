"use client";

import { cn } from "@/lib/utils/cn";
import type { AvatarState } from "@/types/avatar";

interface AvatarDisplayProps {
  state: AvatarState;
  size?: "sm" | "md" | "lg";
}

export function AvatarDisplay({ state, size = "md" }: AvatarDisplayProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-24 h-24",
    lg: "w-36 h-36",
  };

  return (
    <div className="flex flex-col items-center py-4">
      <div className={cn("relative", sizeClasses[size])}>
        {/* Listening ring */}
        {state === "listening" && (
          <div className="absolute inset-[-6px] rounded-full border-2 border-blue-400 animate-[pulse-ring_2s_ease-in-out_infinite] opacity-50" />
        )}

        <svg
          viewBox="0 0 120 120"
          className={cn(
            "w-full h-full transition-transform duration-500",
            state === "idle" && "animate-[avatar-bob_3s_ease-in-out_infinite]",
            state === "listening" && "scale-105",
          )}
        >
          <defs>
            {/* Body gradient - green */}
            <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1B5E20" />
              <stop offset="100%" stopColor="#2E7D32" />
            </linearGradient>
            {/* Chest gradient - golden */}
            <linearGradient id="chestGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E8C07A" />
              <stop offset="100%" stopColor="#D4A574" />
            </linearGradient>
            {/* Wing gradient */}
            <linearGradient id="wingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1B5E20" />
              <stop offset="60%" stopColor="#00897B" />
              <stop offset="100%" stopColor="#26A69A" />
            </linearGradient>
            {/* Tail gradient */}
            <linearGradient id="tailGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#E53935" />
              <stop offset="40%" stopColor="#FF7043" />
              <stop offset="100%" stopColor="#2E7D32" />
            </linearGradient>
            {/* Beak gradient */}
            <linearGradient id="beakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF8F00" />
              <stop offset="100%" stopColor="#E65100" />
            </linearGradient>
            {/* Head crest */}
            <linearGradient id="crestGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#1B5E20" />
              <stop offset="100%" stopColor="#43A047" />
            </linearGradient>
          </defs>

          {/* Tail feathers */}
          <g className={cn(state === "speaking" && "animate-[avatar-bob_1.5s_ease-in-out_infinite]")}>
            <ellipse cx="42" cy="108" rx="8" ry="14" fill="url(#tailGrad)" transform="rotate(-15 42 108)" />
            <ellipse cx="55" cy="110" rx="6" ry="16" fill="url(#tailGrad)" />
            <ellipse cx="67" cy="108" rx="8" ry="14" fill="url(#tailGrad)" transform="rotate(15 67 108)" />
          </g>

          {/* Body */}
          <ellipse cx="58" cy="72" rx="26" ry="30" fill="url(#bodyGrad)" />

          {/* Chest / belly */}
          <ellipse cx="58" cy="78" rx="16" ry="20" fill="url(#chestGrad)" />

          {/* Left wing */}
          <path
            d="M32 58 C20 52, 12 62, 16 78 C18 86, 26 88, 34 82 Z"
            fill="url(#wingGrad)"
            opacity="0.9"
          />

          {/* Right wing */}
          <path
            d="M84 58 C96 52, 104 62, 100 78 C98 86, 90 88, 82 82 Z"
            fill="url(#wingGrad)"
            opacity="0.9"
          />

          {/* Head */}
          <g className={cn(state === "listening" && "animate-[head-tilt_2s_ease-in-out_infinite]")}>
            <circle cx="58" cy="38" r="22" fill="url(#bodyGrad)" />

            {/* Crest / head feathers */}
            <path
              d="M48 18 C50 10, 58 6, 60 12 C62 6, 70 10, 68 18 C66 14, 58 12, 56 14 Z"
              fill="url(#crestGrad)"
            />

            {/* Eye patches (white) */}
            <ellipse cx="48" cy="36" rx="9" ry="8" fill="white" />
            <ellipse cx="68" cy="36" rx="9" ry="8" fill="white" />

            {/* Eyes */}
            <g className={cn(
              state === "idle" && "animate-[avatar-blink_4s_ease-in-out_infinite]",
              state === "listening" && "scale-110 origin-center",
              state === "thinking" && "[transform:scaleY(0.6)]",
            )} style={{ transformOrigin: "58px 36px" }}>
              <circle cx="48" cy="36" r="5" fill="#1a1a1a" />
              <circle cx="68" cy="36" r="5" fill="#1a1a1a" />
              {/* Eye highlights */}
              <circle cx="46" cy="34" r="1.8" fill="white" />
              <circle cx="66" cy="34" r="1.8" fill="white" />
              <circle cx="50" cy="37" r="0.8" fill="white" opacity="0.6" />
              <circle cx="70" cy="37" r="0.8" fill="white" opacity="0.6" />
            </g>

            {/* Beak - upper */}
            <path
              d="M53 42 C55 40, 61 40, 63 42 L60 50 C59 51, 57 51, 56 50 Z"
              fill="url(#beakGrad)"
            />
            {/* Beak - lower (animated when speaking) */}
            <path
              d="M55 49 C56 49, 60 49, 61 49 L59 53 C58.5 53.5, 57.5 53.5, 57 53 Z"
              fill="#BF360C"
              className={cn(state === "speaking" && "animate-[beak-talk_0.3s_ease-in-out_infinite]")}
              style={{ transformOrigin: "58px 49px" }}
            />

            {/* Cheek patches */}
            <circle cx="40" cy="40" r="4" fill="#E57373" opacity="0.3" />
            <circle cx="76" cy="40" r="4" fill="#E57373" opacity="0.3" />
          </g>

          {/* Feet */}
          <g>
            <path d="M48 98 L44 106 M48 98 L48 106 M48 98 L52 106" stroke="#FF8F00" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M68 98 L64 106 M68 98 L68 106 M68 98 L72 106" stroke="#FF8F00" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        </svg>

        {/* Thinking dots */}
        {state === "thinking" && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            <div className="w-2 h-2 bg-[var(--accent-gold)] rounded-full animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 bg-[var(--accent-gold)] rounded-full animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 bg-[var(--accent-gold)] rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        {/* Speaking sound waves */}
        {state === "speaking" && (
          <div className="absolute -right-2 top-1/3 flex flex-col gap-1">
            <div className="w-2.5 h-0.5 bg-[var(--primary-500)] rounded-full animate-pulse [animation-delay:0ms]" />
            <div className="w-4 h-0.5 bg-[var(--primary-500)] rounded-full animate-pulse [animation-delay:100ms]" />
            <div className="w-2.5 h-0.5 bg-[var(--primary-500)] rounded-full animate-pulse [animation-delay:200ms]" />
          </div>
        )}
      </div>

      {size !== "sm" && (
        <span className="mt-2 text-xs text-gray-500 font-medium">
          {state === "idle" && "IUP Bot"}
          {state === "listening" && "Escuchando..."}
          {state === "thinking" && "Pensando..."}
          {state === "speaking" && "Hablando..."}
        </span>
      )}
    </div>
  );
}

/** Mini guacamaya for header / message bubbles */
export function MiniGuacamaya({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn("w-6 h-6", className)}>
      <defs>
        <linearGradient id="mbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B5E20" />
          <stop offset="100%" stopColor="#2E7D32" />
        </linearGradient>
        <linearGradient id="mbChest" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8C07A" />
          <stop offset="100%" stopColor="#D4A574" />
        </linearGradient>
        <linearGradient id="mbBeak" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8F00" />
          <stop offset="100%" stopColor="#E65100" />
        </linearGradient>
      </defs>
      <ellipse cx="58" cy="72" rx="26" ry="30" fill="url(#mbGrad)" />
      <ellipse cx="58" cy="78" rx="16" ry="20" fill="url(#mbChest)" />
      <circle cx="58" cy="38" r="22" fill="url(#mbGrad)" />
      <ellipse cx="48" cy="36" rx="7" ry="6" fill="white" />
      <ellipse cx="68" cy="36" rx="7" ry="6" fill="white" />
      <circle cx="48" cy="36" r="4" fill="#1a1a1a" />
      <circle cx="68" cy="36" r="4" fill="#1a1a1a" />
      <circle cx="46.5" cy="34.5" r="1.3" fill="white" />
      <circle cx="66.5" cy="34.5" r="1.3" fill="white" />
      <path d="M53 42 C55 40, 61 40, 63 42 L60 50 C59 51, 57 51, 56 50 Z" fill="url(#mbBeak)" />
    </svg>
  );
}
