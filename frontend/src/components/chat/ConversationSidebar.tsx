"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MessageSquare, Trash2, Search,
  LogOut, Settings, Home, Plus
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

export const ConversationSidebar = memo(function ConversationSidebar({
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
      style={{
        width: 260, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%",
        background: "var(--sb-bg)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
      className={[
        "md:relative md:translate-x-0 md:flex",
        "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
      aria-label="Conversaciones"
    >
      {/* Header */}
      <div style={{ padding: "14px 14px 10px", flexShrink: 0 }}>
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <Image src="/isotipo.webp" alt="Nexus" width={28} height={28} style={{ objectFit: "contain", borderRadius: 6 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1 }}>Nexus</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>UniPutumayo</div>
          </div>
        </div>

        {/* New chat button */}
        <button
          onClick={() => { onNew(); onClose(); }}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "9px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.75)", cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500,
            marginBottom: 10, transition: "background 0.12s, border-color 0.12s",
          }}
          className="hover:bg-white/10 hover:border-white/20"
        >
          <Plus size={13} strokeWidth={2} /> Nueva conversacion
        </button>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{
              width: "100%", paddingLeft: 28, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
              fontSize: 12, borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              outline: "none", boxSizing: "border-box",
              transition: "border-color 0.12s",
            }}
            className="placeholder-white/30 focus:border-white/20"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }} className="sb-scroll">
        {conversations.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 16px", textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10,
            }}>
              <MessageSquare size={15} style={{ color: "rgba(255,255,255,0.3)" }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0, fontWeight: 500 }}>Sin conversaciones</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "4px 0 0" }}>Empieza una arriba</p>
          </div>
        ) : grouped.length === 0 ? (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "32px 0" }}>Sin resultados</p>
        ) : (
          grouped.map(([label, items]) => (
            <div key={label} style={{ marginBottom: 18 }}>
              <p style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "rgba(255,255,255,0.25)",
                padding: "0 6px 4px", margin: 0,
              }}>
                {label}
              </p>
              {items.map((conv) => {
                const isActive  = conv.id === activeId;
                const isConfirm = confirmId === conv.id;
                return (
                  <div key={conv.id}>
                    <button
                      onClick={() => handleSelect(conv.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 8px", borderRadius: 7,
                        marginBottom: 1, cursor: "pointer",
                        background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
                        border: "none",
                        borderLeft: isActive ? "2px solid var(--sb-active)" : "2px solid transparent",
                        color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                        transition: "background 0.1s, color 0.1s",
                        textAlign: "left",
                      }}
                      className={!isActive ? "hover:bg-white/[0.04] hover:text-white/70" : ""}
                    >
                      <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.35 }}>
                        {conv.title ?? "Conversacion"}
                      </span>
                      <button
                        onClick={(e) => handleDeleteClick(e, conv.id)}
                        style={{
                          flexShrink: 0, width: 18, height: 18, borderRadius: 4,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "none", border: "none", cursor: "pointer",
                          color: isConfirm ? "#f87171" : "rgba(255,255,255,0.3)",
                          opacity: isConfirm ? 1 : 0,
                          transition: "opacity 0.1s, color 0.1s",
                        }}
                        className="group-hover:opacity-100"
                        title={isConfirm ? "Confirmar eliminacion" : "Eliminar"}
                      >
                        <Trash2 size={10} strokeWidth={1.5} />
                      </button>
                    </button>
                    {isConfirm && (
                      <div style={{
                        fontSize: 10, color: "rgba(248,113,113,0.8)",
                        padding: "3px 10px 6px", margin: "0 0 2px",
                      }}>
                        Clic de nuevo para confirmar
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "8px 8px 10px",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7,
          color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12,
          transition: "color 0.12s", fontWeight: 500,
        }}
          className="hover:text-white/70"
        >
          <Home size={12} strokeWidth={1.5} /> Inicio
        </Link>

        {user?.role === "admin" && (
          <Link href="/admin" style={{
            display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 7,
            color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 12,
            transition: "color 0.12s", fontWeight: 500,
          }}
            className="hover:text-white/70"
          >
            <Settings size={12} strokeWidth={1.5} /> Admin
          </Link>
        )}

        {/* User row */}
        <div style={{
          marginTop: 4, paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 8, padding: "8px",
        }}
          className="group"
        >
          {user ? (
            <>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, #1B6E94, #7BB52E)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase",
                letterSpacing: "0.01em", flexShrink: 0,
              }}>
                {(user.display_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2)) ?? "U"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.display_name ?? "Usuario"}
                </p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: 0, textTransform: "capitalize" }}>
                  {user.role}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Cerrar sesion"
                style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.25)",
                  opacity: 0, transition: "opacity 0.12s, color 0.12s",
                }}
                className="group-hover:opacity-100 hover:text-red-400"
              >
                <LogOut size={11} strokeWidth={1.5} />
              </button>
            </>
          ) : (
            <Link href="/admin/login" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%", padding: "8px", borderRadius: 7,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)", textDecoration: "none",
              fontSize: 12, fontWeight: 500,
            }}>
              Iniciar sesion
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
});
