"use client";

import { useState, useEffect, useRef, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageSquare, Trash2, Search, LogOut, Settings,
  Home, Plus, Pencil, Check, X, LogIn, UserPlus, HelpCircle,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { useAuthenticated, useAuthUser } from "@/hooks/useAuthState";
import type { Conversation } from "@/types/chat";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
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

function ConvItem({
  conv, isActive, onSelect, onDelete, onRename,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conv.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => inputRef.current?.select(), 0);
    return () => clearTimeout(t);
  }, [editing]);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conv.title ?? "");
    setEditing(true);
  };

  const commitRename = () => {
    const t = editTitle.trim();
    if (t && t !== conv.title) onRename(t);
    setEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) { onDelete(); setConfirmDelete(false); }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
  };

  if (editing) {
    return (
      <div style={{ padding: "3px 4px", marginBottom: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 7px",
          background: "var(--surface)",
          border: "1px solid var(--brand)",
          borderRadius: "var(--r-sm)",
        }}>
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Nombre de la conversación"
            style={{
              flex: 1, minWidth: 0, background: "none", border: "none", outline: "none",
              fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ink)",
            }}
          />
          <button onClick={commitRename} aria-label="Guardar nombre" className="chat-item-action">
            <Check size={12} />
          </button>
          <button onClick={() => setEditing(false)} aria-label="Cancelar" className="chat-item-action">
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
        }}
        className="chat-item"
        data-active={isActive}
      >
        <MessageSquare size={13} strokeWidth={1.6} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }} />
        <span className="chat-item-title">{conv.title ?? "Conversación"}</span>

        <div className="chat-item-actions">
          <button
            onClick={startEditing}
            title="Renombrar"
            aria-label={`Renombrar ${conv.title ?? "conversación"}`}
            className="chat-item-action"
          >
            <Pencil size={10} strokeWidth={1.6} />
          </button>
          <button
            onClick={handleDeleteClick}
            title={confirmDelete ? "Confirmar eliminación" : "Eliminar"}
            aria-label={confirmDelete ? "Confirmar eliminación" : `Eliminar ${conv.title ?? "conversación"}`}
            className="chat-item-action danger"
            style={confirmDelete ? { color: "var(--danger)" } : undefined}
          >
            <Trash2 size={10} strokeWidth={1.6} />
          </button>
        </div>
      </div>
      {confirmDelete && (
        <div style={{ padding: "0 9px 5px", fontSize: 9.5, color: "var(--danger)", marginTop: -2 }}>
          Clic de nuevo para confirmar
        </div>
      )}
    </div>
  );
}

export const ConversationSidebar = memo(function ConversationSidebar({
  conversations, activeId, onSelect, onNew, onDelete, onRename, isOpen, onClose,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState("");
  const authed = useAuthenticated();
  const user = useAuthUser();

  const handleLogout = () => { logout(); window.location.href = "/"; };

  const filtered = conversations.filter(
    (c) => !search || (c.title ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const grouped = search
    ? [["Resultados", filtered] as [string, Conversation[]]]
    : groupByDate(filtered);

  const handleSelect = (id: string) => { onSelect(id); onClose(); };

  return (
    <aside
      className={[
        "chat-sidebar",
        "md:relative md:translate-x-0 md:flex",
        "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
      aria-label="Conversaciones"
    >
      {/* Cabecera */}
      <div className="chat-sidebar-head">
        <div className="chat-sidebar-brand">
          <Image
            src="/isotipo.webp"
            alt=""
            width={30}
            height={30}
            style={{ objectFit: "contain", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="chat-sidebar-name">Guaca</div>
            <div className="chat-sidebar-sub">UniPutumayo</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="chat-close-mobile chat-item-action"
          >
            <X size={14} />
          </button>
        </div>

        <button
          onClick={() => { onNew(); onClose(); }}
          className="chat-new-btn"
        >
          <Plus size={14} strokeWidth={2} /> Nueva conversación
        </button>

        <div className="chat-search">
          <Search size={12} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversaciones"
            aria-label="Buscar conversaciones"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
              style={{
                position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--sb-muted)", display: "flex", padding: 2,
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="chat-list sb-scroll">
        {!authed ? (
          <div style={{ padding: "30px 12px", textAlign: "center" }}>
            <div style={{
              width: 38, height: 38, margin: "0 auto 12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid var(--sb-border)", borderRadius: "var(--r-sm)",
              background: "var(--surface)", color: "var(--sb-muted)",
            }}>
              <MessageSquare size={15} strokeWidth={1.6} />
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "var(--sb-fg)" }}>
              Sin historial
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 11, lineHeight: 1.5, color: "var(--sb-muted)" }}>
              Inicia sesión para guardar y revisar tus conversaciones.
            </p>
            <Link href="/admin/login" className="btn btn-primary btn-sm" style={{ width: "100%" }}>
              <LogIn size={12} /> Iniciar sesión
            </Link>
            <Link href="/admin/login" className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 6 }}>
              <UserPlus size={12} /> Crear cuenta
            </Link>
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px", textAlign: "center" }}>
            <MessageSquare size={17} strokeWidth={1.5} style={{ color: "var(--sb-muted)", marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "var(--sb-fg)" }}>Sin conversaciones</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--sb-muted)" }}>Empieza una arriba</p>
          </div>
        ) : grouped.length === 0 ? (
          <p style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--sb-muted)" }}>
            Sin resultados
          </p>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label}>
              <p className="chat-group-label">{label}</p>
              {items.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === activeId}
                  onSelect={() => handleSelect(conv.id)}
                  onDelete={() => onDelete(conv.id)}
                  onRename={(title) => onRename(conv.id, title)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Pie */}
      <div className="chat-sidebar-foot">
        <Link href="/" className="chat-foot-link">
          <Home size={12} strokeWidth={1.6} /> Inicio
        </Link>
        <Link href="/faq" className="chat-foot-link">
          <HelpCircle size={12} strokeWidth={1.6} /> Preguntas frecuentes
        </Link>
        {user?.role === "admin" && (
          <Link href="/admin" className="chat-foot-link">
            <Settings size={12} strokeWidth={1.6} /> Panel de control
          </Link>
        )}

        <div style={{
          marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--sb-border)",
          display: "flex", alignItems: "center", gap: 8, padding: "10px 6px 2px",
        }}>
          {user ? (
            <>
              <div style={{
                width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                background: "var(--brand)", color: "var(--on-brand)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              }}>
                {(user.display_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2)) ?? "U"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: "var(--sb-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.display_name ?? "Usuario"}
                </p>
                <p style={{ margin: 0, fontSize: 9.5, color: "var(--sb-muted)", textTransform: "capitalize" }}>
                  {user.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="chat-item-action"
              >
                <LogOut size={12} strokeWidth={1.6} />
              </button>
            </>
          ) : (
            <Link href="/admin/login" className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
});
