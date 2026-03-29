"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  MessageSquare, Zap, ArrowRight, CheckCircle2,
  Mic, Globe, BrainCircuit, GraduationCap, Shield,
  Clock, FileText, Sparkles, Menu, X, ChevronRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/* ── Chat preview mockup ── */
function ChatPreview() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden">
      {/* Window bar */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--surface-2)]">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-xs text-[var(--text-3)] font-medium">Nexus · Chat</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Bot message */}
        <div className="flex gap-2.5">
          <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={10} className="text-white" />
          </div>
          <div className="bg-[var(--surface-3)] rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-[var(--text-2)] max-w-[85%]">
            Hola, ¿en qué puedo ayudarte hoy?
          </div>
        </div>

        {/* User message */}
        <div className="flex justify-end">
          <div className="msg-user px-3 py-2 text-xs max-w-[85%]">
            ¿Cuáles son los programas de ingeniería?
          </div>
        </div>

        {/* Bot message */}
        <div className="flex gap-2.5">
          <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={10} className="text-white" />
          </div>
          <div className="bg-[var(--surface-3)] rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-[var(--text-2)] max-w-[90%] leading-relaxed">
            IUP ofrece <strong>Ingeniería de Sistemas</strong> e <strong>Ingeniería Agroecológica</strong>…
          </div>
        </div>

        {/* Typing */}
        <div className="flex gap-2.5 items-end">
          <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center shrink-0">
            <Sparkles size={10} className="text-white" />
          </div>
          <div className="bg-[var(--surface-3)] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] typing-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] typing-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] typing-dot-3" />
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 flex items-center gap-2">
          <span className="flex-1 text-xs text-[var(--text-4)]">Escribe tu pregunta…</span>
          <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center">
            <ArrowRight size={10} className="text-white ml-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold gradient-text-warm">{value}</div>
      <div className="text-sm text-[var(--text-3)] mt-1">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled]   = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)]">

      {/* ── NAVBAR ── */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass border-b border-[var(--border)] shadow-[var(--shadow-sm)]" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 16 16" fill="none" className="w-4.5 h-4.5 text-white" style={{width:18,height:18}}>
                <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-[var(--text-1)] tracking-tight">Nexus</span>
              <span className="hidden sm:inline text-[var(--text-3)] text-sm ml-1.5">· UniPutumayo</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: "Características", href: "#features" },
              { label: "Cómo funciona",   href: "#how" },
              { label: "Sobre IUP",       href: "#about" },
            ].map((item) => (
              <a key={item.href} href={item.href}
                className="px-3 py-2 rounded-lg text-sm text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-all">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <Link href="/admin/login"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-all border border-[var(--border)]">
              Iniciar sesión
            </Link>
            <Link href="/chat"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-all shadow-sm">
              Chatear <ArrowRight size={14} />
            </Link>
            <button
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--surface-3)] transition-all"
              onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-4 pb-4 border-t border-[var(--border)] bg-[var(--bg)] animate-fade-down">
            {[
              { label: "Características", href: "#features" },
              { label: "Cómo funciona",   href: "#how" },
              { label: "Sobre IUP",       href: "#about" },
              { label: "Iniciar sesión",  href: "/admin/login" },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-all mt-1">
                <ChevronRight size={13} className="text-[var(--brand)]" /> {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="hero-gradient pt-20 pb-28 md:pt-28 md:pb-36 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">

          {/* Text side */}
          <div className="space-y-7 animate-fade-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--brand)]/25 bg-[var(--brand-dim)] text-[var(--brand-text)] text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
              Asistente universitario con IA
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight">
              Tu guía inteligente<br />
              en{" "}
              <span className="gradient-text-warm">UniPutumayo</span>
            </h1>

            <p className="text-lg text-[var(--text-3)] leading-relaxed max-w-lg">
              Consulta programas académicos, requisitos, horarios y más —
              en segundos, con respuestas respaldadas por documentos oficiales de la IUP.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/chat"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-all shadow-[var(--shadow-md)] hover:shadow-[var(--glow-brand)] active:scale-[.98]">
                <MessageSquare size={17} /> Empezar ahora
              </Link>
              <a href="#features"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border border-[var(--border)] text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-all">
                Ver características <ArrowRight size={15} />
              </a>
            </div>

            <div className="flex flex-wrap gap-5 text-sm text-[var(--text-3)]">
              {["Respuestas precisas", "Disponible 24/7", "Voz + Texto"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[var(--brand)]" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Visual side */}
          <div className="relative flex justify-center items-center">
            {/* Glow orb */}
            <div className="absolute w-72 h-72 rounded-full bg-[var(--brand)] opacity-[.07] blur-3xl" />
            <div
              className="relative z-10 animate-fade-up"
              style={{ animationDelay: ".15s" }}
            >
              <ChatPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section id="about" className="py-14 border-y border-[var(--border)] bg-[var(--surface-2)]">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-10">
          <Stat value="5,000+" label="Estudiantes activos" />
          <Stat value="12"     label="Programas académicos" />
          <Stat value="24/7"   label="Disponibilidad" />
          <Stat value="98%"    label="Precisión" />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-3)] text-sm text-[var(--text-3)] border border-[var(--border)]">
              <Zap size={12} className="text-[var(--brand)]" /> Características
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Todo lo que necesitas,{" "}
              <span className="gradient-text-warm">en un lugar</span>
            </h2>
            <p className="text-[var(--text-3)] max-w-xl mx-auto text-lg">
              Nexus combina IA avanzada con información oficial de la IUP.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BrainCircuit, title: "IA con Contexto Institucional",
                desc: "Respuestas respaldadas por documentos oficiales de la IUP.",
                color: "#f97316" },
              { icon: Mic, title: "Voz y Texto",
                desc: "Habla o escribe en español colombiano. Nexus te entiende.",
                color: "#8b5cf6" },
              { icon: GraduationCap, title: "Programas Académicos",
                desc: "Información sobre todos los programas, pensum y requisitos.",
                color: "#0891b2" },
              { icon: Clock, title: "Disponible 24/7",
                desc: "Sin colas ni esperas. Respuestas instantáneas sobre la IUP.",
                color: "#10b981" },
              { icon: Shield, title: "Información Verificada",
                desc: "Cada respuesta cita sus fuentes. Transparencia total.",
                color: "#ef4444" },
              { icon: Globe, title: "Multiconversación",
                desc: "Guarda y retoma el historial de todas tus consultas.",
                color: "#f59e0b" },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="feature-card card-hover cursor-default">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: color + "15", color }}
                >
                  <Icon size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-[var(--text-1)] mb-2 text-sm">{title}</h3>
                <p className="text-sm text-[var(--text-3)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 md:py-32 px-4 sm:px-6 bg-[var(--bg-2)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-3)] text-sm text-[var(--text-3)] border border-[var(--border)]">
              <Sparkles size={12} className="text-[var(--brand)]" /> Cómo funciona
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Tres pasos para{" "}
              <span className="gradient-text-warm">tu respuesta</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: "01", title: "Haz tu pregunta",
                desc: "Escribe o usa la voz para preguntar sobre programas, admisión o cualquier información de la IUP." },
              { n: "02", title: "Nexus consulta",
                desc: "Nuestro sistema RAG busca en documentos oficiales de la institución para encontrar información relevante." },
              { n: "03", title: "Obtén respuesta",
                desc: "Recibes respuesta clara en español, con fuentes citadas para verificar la información." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex flex-col gap-4 p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <span className="text-4xl font-black text-[var(--brand)] opacity-30 leading-none">{n}</span>
                <h4 className="font-bold text-[var(--text-1)]">{title}</h4>
                <p className="text-sm text-[var(--text-3)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 md:py-32 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand)] via-[var(--accent)] to-[var(--secondary)]" />
            <div className="absolute inset-0 opacity-[.07]"
              style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
            <div className="relative z-10 text-center px-8 py-16 space-y-6">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
                Comienza a explorar la IUP hoy
              </h2>
              <p className="text-white/75 text-lg max-w-md mx-auto">
                Nexus está listo para responder tus preguntas sobre la Institución Universitaria del Putumayo.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/chat"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold bg-white text-[var(--brand)] hover:bg-white/90 transition-all shadow-lg active:scale-[.98]">
                  <MessageSquare size={17} /> Iniciar conversación
                </Link>
                <Link href="/admin/login"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold border border-white/25 text-white hover:bg-white/10 transition-all">
                  Acceso administrador
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface-2)] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" style={{width:14,height:14}}>
                <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z" fill="white" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm text-[var(--text-1)]">Nexus</span>
              <p className="text-[11px] text-[var(--text-4)]">Institución Universitaria del Putumayo</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[var(--text-3)]">
            <Link href="/chat" className="hover:text-[var(--brand)] transition-colors">Chat</Link>
            <Link href="/admin/login" className="hover:text-[var(--brand)] transition-colors">Administrador</Link>
            <a href="https://www.uniputumayo.edu.co" target="_blank" rel="noopener noreferrer"
              className="hover:text-[var(--brand)] transition-colors flex items-center gap-1">
              <Globe size={13} /> UniPutumayo.edu.co
            </a>
          </div>
          <p className="text-xs text-[var(--text-4)]">© {new Date().getFullYear()} IUP · Nexus IA</p>
        </div>
      </footer>
    </div>
  );
}
