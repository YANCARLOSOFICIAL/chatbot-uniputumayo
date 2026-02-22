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
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
}: ConversationSidebarProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onClose(); // close drawer on mobile after selecting
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-enter"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          // Layout
          "w-72 bg-[var(--primary-800)] flex flex-col",
          // Mobile: fixed overlay drawer
          "fixed inset-y-0 left-0 z-40 h-full transition-transform duration-300 ease-out",
          // Desktop: static within flex layout
          "md:static md:z-auto md:h-auto md:transition-none md:translate-x-0",
          // Mobile open/close
          isOpen ? "translate-x-0 sidebar-enter" : "-translate-x-full"
        )}
        aria-label="Conversaciones"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MiniGuacamaya className="w-7 h-7" />
              <div>
                <p className="text-sm font-bold text-white leading-tight">Nexus UniPutumayo</p>
                <p className="text-xs text-green-300/70 leading-tight">Universidad del Putumayo</p>
              </div>
            </div>
            {/* Close button — only visible on mobile */}
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cerrar menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            onClick={() => { onNew(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:bg-white/25 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva conversación
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <svg className="w-10 h-10 text-green-300/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm text-green-300/40">
                No hay conversaciones aún
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleSelect(conv.id)}
                className={cn(
                  "group flex items-center justify-between px-4 py-3 cursor-pointer border-b border-white/5 transition-colors",
                  conv.id === activeId
                    ? "bg-white/10 border-l-2 border-l-[var(--primary-400)]"
                    : "hover:bg-white/5 active:bg-white/10"
                )}
                onClick={() => handleSelect(conv.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <svg className="w-3.5 h-3.5 text-green-400/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {conv.title || "Nueva conversación"}
                    </p>
                    <p className="text-xs text-green-300/40 mt-0.5">
                      {new Date(conv.created_at).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="ml-2 p-1 rounded text-green-300/20 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Eliminar conversación"
                  aria-label="Eliminar conversación"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 flex-shrink-0">
          <p className="text-xs text-green-300/30 text-center">
            IUP © {new Date().getFullYear()}
          </p>
        </div>
      </aside>
    </>
  );
}
