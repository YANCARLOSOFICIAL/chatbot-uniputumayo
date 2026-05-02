"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare, Trash2, Search,
  LogOut, Settings, Home, PenSquare
} from "lucide-react";
import { isAuthenticated, getUser, logout, type AuthUser } from "@/lib/auth";
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

function groupByDate(convs: Conversation[]) {
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo   = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const monthAgo  = new Date(today); monthAgo.setMonth(today.getMonth() - 1);

  const groups: Record<string, Conversation[]> = {
    "Hoy": [], "Ayer": [], "Esta semana": [], "Este mes": [], "Anteriores": [],
  };
  for (const c of convs) {
    const d = new Date(c.created_at);
    if (d >= today)          groups["Hoy"].push(c);
    else if (d >= yesterday) groups["Ayer"].push(c);
    else if (d >= weekAgo)   groups["Esta semana"].push(c);
    else if (d >= monthAgo)  groups["Este mes"].push(c);
    else                     groups["Anteriores"].push(c);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export function ConversationSidebar({
  conversations, activeId, onSelect, onNew, onDelete, isOpen, onClose,
}: ConversationSidebarProps) {
  const [search, setSearch]       = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [user, setUser]           = useState<AuthUser | null>(null);

  useEffect(() => {
    if (isAuthenticated()) setUser(getUser());
  }, []);

  const handleLogout = () => { logout(); window.location.href = "/"; };

  const filtered = conversations.filter(
    (c) => !search || (c.title ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const grouped = search
    ? [["Resultados", filtered] as [string, Conversation[]]]
    : groupByDate(filtered);

  const handleSelect = (id: string) => { onSelect(id); onClose(); };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmId === id) { onDelete(id); setConfirmId(null); }
    else { setConfirmId(id); setTimeout(() => setConfirmId(null), 3000); }
  };

  return (
    <aside
      className={[
        "w-[260px] flex flex-col h-full",
        "bg-[var(--sb-bg)] border-r border-[var(--sb-border)]",
        "md:relative md:translate-x-0 md:flex",
        "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
      aria-label="Conversaciones"
    >
      {/* Header */}
      <div className="px-3 pt-3.5 pb-2.5 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src="/isotipo.webp" alt="UniPutumayo" style={{ height: 28, objectFit: "contain" }} />
            <div>
              <div className="text-[15px] font-bold text-[var(--sb-text)]" style={{ fontFamily: "var(--font-display)" }}>Nexus</div>
              <div className="text-[11px] text-[var(--sb-muted)]">UniPutumayo</div>
            </div>
          </div>
          <button
            onClick={() => { onNew(); onClose(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors"
            title="Nueva conversación"
          >
            <PenSquare size={13} strokeWidth={1.5} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--sb-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-6 pr-2.5 py-2 text-[13px] rounded-md bg-[var(--sb-hover)] border border-[var(--sb-border)] text-[var(--sb-text)] placeholder-[var(--sb-muted)] outline-none focus:border-[var(--sb-active)]/50 transition-colors"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto sb-scroll px-1.5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <div className="w-8 h-8 rounded-lg bg-[var(--sb-hover)] flex items-center justify-center mb-2.5">
              <MessageSquare size={15} className="text-[var(--sb-muted)]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] text-[var(--sb-muted)] font-medium">Sin conversaciones</p>
            <p className="text-[11px] text-[var(--sb-muted)] opacity-50 mt-0.5">
              Empieza una nueva arriba
            </p>
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-[13px] text-[var(--sb-muted)] text-center py-8">Sin resultados</p>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label} className="mb-4">
              <p className="text-[11px] font-semibold text-[var(--sb-muted)] uppercase tracking-wider px-2 py-1">
                {label}
              </p>
              {items.map((conv) => {
                const isActive  = conv.id === activeId;
                const isConfirm = confirmId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelect(conv.id)}
                    className={[
                      "group w-full flex items-center gap-1.5 px-2 py-2 rounded-md text-left mb-0.5 transition-all duration-100 relative",
                      isActive
                        ? "bg-[var(--sb-hover)] text-[var(--sb-text)] active-left-border"
                        : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
                    ].join(" ")}
                  >
                    <MessageSquare
                      size={10}
                      strokeWidth={1.5}
                      className={`shrink-0 ${isActive ? "text-[var(--sb-active)]" : "text-[var(--sb-muted)]"}`}
                    />
                    <span className="flex-1 text-[13px] truncate">{conv.title ?? "Conversación"}</span>
                    <button
                      onClick={(e) => handleDeleteClick(e, conv.id)}
                      className={[
                        "shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all duration-100",
                        isConfirm
                          ? "opacity-100 text-[var(--error)] bg-[var(--error)]/12"
                          : "opacity-0 group-hover:opacity-100 text-[var(--sb-muted)] hover:text-[var(--error)]",
                      ].join(" ")}
                      title={isConfirm ? "Confirmar eliminación" : "Eliminar"}
                    >
                      <Trash2 size={8} strokeWidth={1.5} />
                    </button>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-1.5 border-t border-[var(--sb-border)] flex-shrink-0 space-y-0.5">
        <Link href="/"
          className="flex items-center gap-1.5 px-2 py-2 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors text-[13px]"
        >
          <Home size={13} strokeWidth={1.5} /> Inicio
        </Link>

        {user?.role === "admin" && (
          <Link href="/admin"
            className="flex items-center gap-1.5 px-2 py-2 rounded-md text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors text-[13px]"
          >
            <Settings size={13} strokeWidth={1.5} /> Admin
          </Link>
        )}

        <div className="pt-1 mt-0.5 border-t border-[var(--sb-border)]">
          {user ? (
            <div className="flex items-center gap-1.5 px-2 py-2 rounded-md group cursor-default">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold uppercase shrink-0" style={{ background: "var(--brand-accent)" }}>
                {user.display_name?.[0] ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--sb-text)] truncate leading-tight">
                  {user.display_name ?? "Usuario"}
                </p>
                <p className="text-[10px] text-[var(--sb-muted)] capitalize">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-4 h-4 rounded flex items-center justify-center text-[var(--sb-muted)] hover:text-[var(--error)] transition-colors opacity-0 group-hover:opacity-100"
                title="Cerrar sesión"
              >
                <LogOut size={9} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <Link
              href="/admin/login"
              className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-md bg-[var(--sb-hover)] border border-[var(--sb-border)] text-[var(--sb-text)] hover:bg-white/10 transition-colors text-[13px] font-medium"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
