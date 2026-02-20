"use client";

import { cn } from "@/lib/utils/cn";
import { MiniGuacamaya } from "@/components/avatar/AvatarDisplay";
import type { Conversation } from "@/types/chat";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <div className="w-72 bg-[var(--primary-800)] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <MiniGuacamaya className="w-7 h-7" />
          <div>
            <p className="text-sm font-bold text-white leading-tight">Nexus UniPutumayo</p>
            <p className="text-xs text-green-300/70 leading-tight">Universidad del Putumayo</p>
          </div>
        </div>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva conversación
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-sm text-green-300/50 text-center mt-8 px-4">
            No hay conversaciones aún
          </p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "flex items-center justify-between px-4 py-3 cursor-pointer border-b border-white/5 transition-colors",
              {
                "bg-white/10 border-l-2 border-l-[var(--primary-400)]": conv.id === activeId,
                "hover:bg-white/5": conv.id !== activeId,
              }
            )}
            onClick={() => onSelect(conv.id)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {conv.title || "Nueva conversación"}
              </p>
              <p className="text-xs text-green-300/50 mt-0.5">
                {new Date(conv.created_at).toLocaleDateString("es-CO")}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="ml-2 text-green-300/30 hover:text-red-400 transition-colors flex-shrink-0"
              title="Eliminar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
