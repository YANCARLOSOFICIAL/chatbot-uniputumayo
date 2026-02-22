"use client";

import { MiniGuacamaya } from "@/components/avatar/AvatarDisplay";

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3 sm:mb-4">
      <div className="flex-shrink-0 mr-2 mt-1 self-end">
        <MiniGuacamaya className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
      <div className="bg-white border border-gray-100 border-l-[3px] border-l-[var(--primary-400)] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--primary-600)]">Nexus</span>
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 bg-[var(--primary-400)] rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-[var(--primary-400)] rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-[var(--primary-400)] rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
