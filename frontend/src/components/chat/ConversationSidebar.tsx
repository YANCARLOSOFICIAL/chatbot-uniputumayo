"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus, X, MessageSquare, Trash2, Search, Sparkles,
  LogOut, Settings, ChevronRight, Home
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
  const now = new Date();
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
  const [search, setSearch]           = useState("");
  const [confirmId, setConfirmId]     = useState<string | null>(null);
  const [user, setUser]               = useState<AuthUser | null>(null);

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
    <>
      {/* Backdrop - always when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 animate-fade-in"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={[
          "w-[260px] bg-[var(--sb-bg)] flex flex-col h-full border-r border-[var(--sb-border)]",
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Panel de conversaciones"
      >
        {/* ── Top: Brand + new chat ── */}
        <div className="p-3 pt-4 flex-shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center shadow-sm glow-pulse">
                <Sparkles size={13} className="text-white" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--sb-text)] leading-tight">Nexus</p>
                <p className="text-[8px] text-[var(--sb-muted)] leading-tight">UNIPUTUMAYO</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors duration-200"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* New conversation — premium button */}
          <button
            onClick={() => { onNew(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-brand text-white font-semibold text-xs hover:shadow-lg active:scale-[0.98] transition-all duration-200"
          >
            <Plus size={14} strokeWidth={2} />
            Nueva conversación
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sb-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-[var(--sb-hover)] border border-[var(--sb-border)] text-[var(--sb-text)] placeholder-[var(--sb-muted)] outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30 transition-all duration-200"
            />
          </div>
        </div>

        {/* ── Conversations ── */}
        <div className="flex-1 overflow-y-auto sb-scroll px-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare size={28} className="text-[var(--sb-border)] mb-3" />
              <p className="text-xs text-[var(--sb-muted)]">Sin conversaciones</p>
              <p className="text-[10px] text-[var(--sb-muted)] opacity-60 mt-0.5">Inicia un nuevo chat arriba</p>
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-xs text-[var(--sb-muted)] text-center py-8">Sin resultados</p>
          ) : (
            grouped.map(([label, items]) => (
              <div key={label} className="mb-4">
                <p className="text-[10px] font-semibold text-[var(--sb-muted)] uppercase tracking-wider px-2 py-1.5">
                  {label}
                </p>
                {items.map((conv) => {
                  const isActive = conv.id === activeId;
                  const isConfirm = confirmId === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelect(conv.id)}
                      className={[
                        "group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left mb-0.5 transition-all duration-200",
                        isActive
                          ? "bg-[var(--brand)]/10 text-[var(--text-1)] border border-[var(--brand)]/30"
                          : "text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]",
                      ].join(" ")}
                    >
                      <MessageSquare
                        size={12}
                        strokeWidth={1.5}
                        className={`shrink-0 transition-colors ${isActive ? "text-[var(--brand)]" : "text-[var(--sb-border)]"}`}
                      />
                      <span className="flex-1 text-xs truncate font-medium">
                        {conv.title ?? "Conversación"}
                      </span>
                      <button
                        onClick={(e) => handleDeleteClick(e, conv.id)}
                        className={[
                          "shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all duration-200",
                          isConfirm
                            ? "opacity-100 text-[var(--error)] bg-[var(--error)]/15 scale-110"
                            : "opacity-0 group-hover:opacity-100 text-[var(--sb-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10",
                        ].join(" ")}
                        title={isConfirm ? "Confirmar" : "Eliminar"}
                      >
                        <Trash2 size={10} strokeWidth={1.5} />
                      </button>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Bottom: User profile ── */}
        <div className="p-3 border-t border-[var(--sb-border)] flex-shrink-0 space-y-1.5">
          <Link
            href="/"
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[var(--sb-muted)] hover:text-[var(--sb-text)] hover:bg-[var(--sb-hover)] transition-colors duration-200 text-xs font-medium"
          >
            <Home size={13} strokeWidth={1.5} /> Inicio
          </Link>

          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[var(--sb-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors duration-200 text-xs font-medium"
            >
              <Settings size={13} strokeWidth={1.5} /> Admin
            </Link>
          )}

          {user && (
            <div className="px-2.5 py-2 rounded-lg hover:bg-[var(--sb-hover)] transition-colors duration-200 group cursor-default mt-2">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center text-white text-xs font-bold uppercase shrink-0 shadow-sm">
                  {user.display_name?.[0] ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--sb-text)] truncate">{user.display_name ?? "Usuario"}</p>
                  <p className="text-[9px] text-[var(--sb-muted)] capitalize">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--sb-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                >
                  <LogOut size={11} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {!user && (
            <div className="px-2.5 py-3 rounded-lg bg-[var(--surface-2)]/50 border border-[var(--border)] group cursor-default">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-full bg-[var(--text-4)]/20 flex items-center justify-center text-[var(--text-4)] text-xs font-bold uppercase shrink-0">
                  •
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--sb-text)] truncate">Invitado</p>
                  <p className="text-[9px] text-[var(--sb-muted)] leading-tight mt-0.5">Inicia sesión para guardar historial</p>
                </div>
              </div>
              <Link
                href="/admin/login"
                className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--brand)]/10 border border-[var(--brand)]/30 text-[var(--brand)] hover:bg-[var(--brand)]/20 transition-colors duration-200 text-xs font-medium mt-2"
              >
                <span>Iniciar sesión</span>
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
