"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, FileText, CalendarCheck, Search, MessageCircle, HelpCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { FaqPublic } from "@/types/chat";
import dynamic from "next/dynamic";

const MarkdownContent = dynamic(
  () => import("@/components/chat/MarkdownContent").then((m) => ({ default: m.MarkdownContent })),
  { ssr: false, loading: () => <span style={{ color: "var(--text-3)", fontSize: 13 }}>...</span> }
);

const UNCATEGORIZED = "Otras preguntas";

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function FaqItem({
  entry, open, onToggle, highlighted, onAsk,
}: {
  entry: FaqPublic; open: boolean; onToggle: () => void; highlighted: boolean; onAsk: (q: string) => void;
}) {
  return (
    <div
      id={`faq-${entry.id}`}
      style={{
        borderBottom: "1px solid var(--border)",
        background: highlighted ? "var(--brand-dim)" : "transparent",
        transition: "background 0.4s",
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.35 }}>
          {entry.question}
        </span>
        <ChevronDown
          size={15}
          style={{ color: "var(--text-3)", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }} className="animate-fade-up">
          <div className="prose-chat" style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-1)" }}>
            <MarkdownContent content={entry.answer} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            {entry.source_document && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-3)" }}>
                <FileText size={11} /> Fuente: {entry.source_document}
              </span>
            )}
            {entry.valid_period && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-3)" }}>
                <CalendarCheck size={11} /> Vigencia: {entry.valid_period}
              </span>
            )}
            <button
              onClick={() => onAsk(entry.question)}
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}
              title="Abrir esta pregunta en el chat para seguir conversando"
            >
              <MessageCircle size={12} /> Preguntarle a Guaca <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FaqPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const focusId = params.get("id");

  const [entries, setEntries] = useState<FaqPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(focusId);

  useEffect(() => {
    apiClient.getFaq()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar las preguntas frecuentes"))
      .finally(() => setLoading(false));
  }, []);

  // Deep link from a chat answer (/faq?id=...): `openId` starts as focusId
  // above; once the list is rendered, scroll the entry into view.
  useEffect(() => {
    if (!focusId || loading) return;
    const raf = requestAnimationFrame(() => {
      document.getElementById(`faq-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [focusId, loading]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return entries;
    return entries.filter((e) => normalize(e.question).includes(q) || normalize(e.answer).includes(q));
  }, [entries, query]);

  const groups = useMemo(() => {
    const map = new Map<string, FaqPublic[]>();
    for (const e of filtered) {
      const key = e.category?.trim() || UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const askGuaca = (q: string) => {
    sessionStorage.setItem("guaca_initial_query", q);
    router.push("/chat");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-1)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text-1)" }}>
            <Image src="/isotipo.webp" alt="Guaca" width={24} height={24} style={{ objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800 }}>Guaca</span>
          </Link>
          <span style={{ color: "var(--text-3)", fontSize: 13 }}>/ Preguntas frecuentes</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <ThemeToggle />
            <Link href="/chat" className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
              <MessageCircle size={12} /> Ir al chat
            </Link>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, width: "100%", maxWidth: 760, margin: "0 auto", padding: "32px 16px 48px" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Preguntas frecuentes
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0, lineHeight: 1.6 }}>
            Respuestas oficiales, revisadas por la institución, a las preguntas que más recibe Guaca.
            Si no encuentras la tuya, pregúntale directamente al chat.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en las preguntas frecuentes..."
            className="input"
            style={{ width: "100%", boxSizing: "border-box", paddingLeft: 34 }}
            aria-label="Buscar preguntas frecuentes"
          />
        </div>

        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Cargando...</div>
        ) : error ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--danger)", fontSize: 13, border: "1px solid var(--border)", borderRadius: 12 }}>
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 13, border: "1px solid var(--border)", borderRadius: 12 }}>
            <HelpCircle size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
            <div>Todavía no hay preguntas frecuentes publicadas.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 13, border: "1px solid var(--border)", borderRadius: 12 }}>
            Ninguna pregunta coincide con «{query}».{" "}
            <button onClick={() => askGuaca(query)} className="btn btn-ghost btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              Preguntarle a Guaca <ArrowRight size={11} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {groups.map(([category, items]) => (
              <section key={category}>
                <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", margin: "0 0 8px 2px" }}>
                  {category} <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>· {items.length}</span>
                </h2>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {items.map((entry) => (
                    <FaqItem
                      key={entry.id}
                      entry={entry}
                      open={openId === entry.id}
                      onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
                      highlighted={focusId === entry.id}
                      onAsk={askGuaca}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-3)", textDecoration: "none" }}>
            <ArrowLeft size={12} /> Volver al inicio
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default function FaqPage() {
  // useSearchParams needs a Suspense boundary for static rendering in Next.
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Cargando...</div>}>
      <FaqPageContent />
    </Suspense>
  );
}
