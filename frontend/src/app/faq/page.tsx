"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, FileText, CalendarCheck, Search, MessageCircle, HelpCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { FaqPublic } from "@/types/chat";
import dynamic from "next/dynamic";

const MarkdownContent = dynamic(
  () => import("@/components/chat/MarkdownContent").then((m) => ({ default: m.MarkdownContent })),
  { ssr: false, loading: () => <span style={{ color: "var(--ink-3)", fontSize: 13 }}>...</span> }
);

const UNCATEGORIZED = "Otras preguntas";
// Entries per page on the public list — enough to scan without endless
// scrolling on a phone; the search box narrows the set first.
const PAGE_SIZE = 10;

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
      className="faq-item"
      data-highlight={highlighted}
    >
      <button onClick={onToggle} aria-expanded={open} className="faq-q">
        <span>{entry.question}</span>
        <ChevronDown size={15} className="faq-chevron" />
      </button>

      {open && (
        <div className="faq-a animate-fade-up">
          <div className="prose-chat" style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--ink)" }}>
            <MarkdownContent content={entry.answer} />
          </div>

          <div className="faq-meta">
            {entry.source_document && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <FileText size={11} /> Fuente: {entry.source_document}
              </span>
            )}
            {entry.valid_period && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
      .catch(() => setError("No pudimos cargar las preguntas frecuentes. Intenta de nuevo en unos minutos."))
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

  // Client-side pagination over the filtered list (the whole FAQ is one
  // small request). A deep link (/faq?id=...) opens on the page that holds
  // that entry; typing in the search box goes back to page 1.
  const [pageOverride, setPageOverride] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const focusPage = useMemo(() => {
    if (!focusId) return null;
    const idx = filtered.findIndex((e) => e.id === focusId);
    return idx >= 0 ? Math.floor(idx / PAGE_SIZE) + 1 : null;
  }, [filtered, focusId]);
  const safePage = Math.min(pageOverride ?? focusPage ?? 1, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);
  const goToPage = (n: number) => {
    setPageOverride(Math.min(Math.max(1, n), totalPages));
    setOpenId(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const groups = useMemo(() => {
    const map = new Map<string, FaqPublic[]>();
    for (const e of pageItems) {
      const key = e.category?.trim() || UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [pageItems]);

  const askGuaca = (q: string) => {
    sessionStorage.setItem("guaca_initial_query", q);
    router.push("/chat");
  };

  return (
    <div className="faq-shell">
      {/* Header */}
      <header className="faq-header">
        <div className="faq-header-inner">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--ink)" }}>
            <Image src="/isotipo.webp" alt="Guaca" width={24} height={24} style={{ objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>Guaca</span>
          </Link>
          <span className="faq-crumb">/ Preguntas frecuentes</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <ThemeToggle />
            <Link href="/chat" className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
              <MessageCircle size={12} /> Ir al chat
            </Link>
          </div>
        </div>
      </header>

      <main className="faq-main">
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <span className="eyebrow">Respuestas oficiales</span>
          </div>
          <h1 className="faq-title">Preguntas frecuentes</h1>
          <p className="faq-lede">
            Respuestas oficiales, revisadas por la institución, a las preguntas que más recibe Guaca.
            Si no encuentras la tuya, pregúntale directamente al chat.
          </p>
        </div>

        {/* Search */}
        <div className="search-box" style={{ maxWidth: "none", marginBottom: 24 }}>
          <Search size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPageOverride(null); }}
            placeholder="Buscar en las preguntas frecuentes..."
            aria-label="Buscar preguntas frecuentes"
          />
        </div>

        {loading ? (
          <div className="faq-empty">Cargando…</div>
        ) : error ? (
          <div className="faq-empty" style={{ color: "var(--danger)" }}>{error}</div>
        ) : entries.length === 0 ? (
          <div className="faq-empty">
            <HelpCircle size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
            <div>Todavía no hay preguntas frecuentes publicadas.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="faq-empty">
            Ninguna pregunta coincide con «{query}».{" "}
            <button onClick={() => askGuaca(query)} className="btn btn-ghost btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              Preguntarle a Guaca <ArrowRight size={11} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {groups.map(([category, items]) => (
              <section key={category}>
                <h2 className="faq-group-label">
                  {category} <span style={{ opacity: 0.6 }}>· {items.length}</span>
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

            {totalPages > 1 && (
              <nav aria-label="Paginación de preguntas frecuentes" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingTop: 4 }}>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  Mostrando <strong style={{ fontWeight: 600 }}>{rangeStart}–{rangeEnd}</strong> de {filtered.length}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => goToPage(safePage - 1)} disabled={safePage <= 1}
                    className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ChevronLeft size={13} /> Anterior
                  </button>
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{safePage} / {totalPages}</span>
                  <button onClick={() => goToPage(safePage + 1)} disabled={safePage >= totalPages}
                    className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Siguiente <ChevronRight size={13} />
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}

        <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-3)", textDecoration: "none" }}>
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
    <Suspense fallback={<div className="faq-empty" style={{ margin: 48 }}>Cargando…</div>}>
      <FaqPageContent />
    </Suspense>
  );
}
