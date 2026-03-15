"use client";

import Link from "next/link";
import { useState, useEffect, useId } from "react";
import {
  MessageSquare, Zap, Users, ArrowRight, CheckCircle2,
  Mic, Globe, BrainCircuit, GraduationCap, ChevronRight,
  Sparkles, Shield, Clock, Menu, X
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/* ─── Guacamaya SVG ─── */
function GuacamayaHero() {
  const uid = useId().replace(/:/g, "_");
  return (
    <svg viewBox="0 0 120 160" fill="none" className="w-full h-full drop-shadow-2xl" aria-hidden>
      <defs>
        <radialGradient id={`${uid}_glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}_body`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={`${uid}_wing`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#0e7490" />
        </linearGradient>
        <linearGradient id={`${uid}_chest`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={`${uid}_tail1`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id={`${uid}_tail2`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <radialGradient id={`${uid}_eye`} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="100" rx="50" ry="30" fill={`url(#${uid}_glow)`} />
      <path d="M 52 110 Q 40 130 35 155 Q 42 145 52 135 Z" fill={`url(#${uid}_tail1)`} opacity=".9" />
      <path d="M 56 112 Q 50 135 48 160 Q 54 148 58 135 Z" fill={`url(#${uid}_tail2)`} opacity=".95" />
      <path d="M 60 113 Q 60 138 60 162 Q 64 150 64 135 Z" fill={`url(#${uid}_tail1)`} />
      <path d="M 64 112 Q 70 135 72 160 Q 66 148 62 135 Z" fill={`url(#${uid}_tail2)`} opacity=".95" />
      <path d="M 68 110 Q 80 130 85 155 Q 78 145 68 135 Z" fill={`url(#${uid}_tail1)`} opacity=".9" />
      <path d="M 30 75 Q 10 60 8 85 Q 20 95 35 95 Z" fill={`url(#${uid}_wing)`} opacity=".9" />
      <path d="M 90 75 Q 110 60 112 85 Q 100 95 85 95 Z" fill={`url(#${uid}_wing)`} opacity=".9" />
      <ellipse cx="60" cy="90" rx="28" ry="32" fill={`url(#${uid}_body)`} />
      <ellipse cx="60" cy="95" rx="16" ry="20" fill={`url(#${uid}_chest)`} opacity=".85" />
      <circle cx="60" cy="52" r="22" fill={`url(#${uid}_body)`} />
      <path d="M 42 50 Q 60 42 78 50 Q 78 62 60 66 Q 42 62 42 50 Z" fill="#ef4444" opacity=".5" />
      <circle cx="50" cy="49" r="7" fill={`url(#${uid}_eye)`} />
      <circle cx="70" cy="49" r="7" fill={`url(#${uid}_eye)`} />
      <circle cx="51" cy="50" r="4" fill="#1a1a2e" />
      <circle cx="71" cy="50" r="4" fill="#1a1a2e" />
      <circle cx="52.5" cy="48.5" r="1.5" fill="white" opacity=".9" />
      <circle cx="72.5" cy="48.5" r="1.5" fill="white" opacity=".9" />
      <path d="M 54 60 Q 60 65 66 60 Q 63 70 60 72 Q 57 70 54 60 Z" fill="#f97316" />
      <path d="M 55 62 Q 60 66 65 62" stroke="#ea580c" strokeWidth="1" fill="none" />
      <path d="M 50 32 Q 48 20 52 15 Q 54 22 55 30" fill="#059669" />
      <path d="M 60 30 Q 60 18 62 13 Q 64 20 64 30" fill="#10b981" />
      <path d="M 70 32 Q 72 20 68 15 Q 66 22 65 30" fill="#059669" />
    </svg>
  );
}

function ChatPreview() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--surface-2)]">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <div className="w-2 h-2 rounded-full bg-yellow-400" />
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="ml-2 text-xs text-[var(--text-3)] font-medium">Nexus · Chat</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0 mt-1" />
          <div className="bg-[var(--surface-3)] rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-[var(--text-2)] max-w-[85%]">
            Hola, ¿en qué puedo ayudarte hoy?
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-[var(--brand)] text-white rounded-2xl rounded-tr-sm px-3 py-2 text-xs max-w-[85%]">
            ¿Cuáles son los programas de ingeniería?
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0 mt-1" />
          <div className="bg-[var(--surface-3)] rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-[var(--text-2)] max-w-[90%]">
            IUP ofrece <strong>Ingeniería de Sistemas</strong> e <strong>Ingeniería Agroecológica</strong>...
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0" />
          <div className="bg-[var(--surface-3)] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-4)] typing-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-4)] typing-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-4)] typing-dot-3" />
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 flex items-center gap-2">
          <span className="flex-1 text-xs text-[var(--text-4)]">Escribe tu pregunta...</span>
          <div className="w-6 h-6 rounded-full bg-[var(--brand)] flex items-center justify-center">
            <ArrowRight size={11} className="text-white ml-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold gradient-text">{value}</div>
      <div className="text-sm text-[var(--text-3)] mt-1">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, description, accent }: {
  icon: React.ElementType; title: string; description: string; accent: string
}) {
  return (
    <div className="feature-card card-hover group cursor-default">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ background: accent + "20", color: accent }}
      >
        <Icon size={22} />
      </div>
      <h3 className="font-semibold text-[var(--text-1)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-3)] leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ n, title, description }: { n: number; title: string; description: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-10 h-10 rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-bold text-sm shrink-0">
        {n}
      </div>
      <div>
        <h4 className="font-semibold text-[var(--text-1)] mb-1">{title}</h4>
        <p className="text-sm text-[var(--text-3)]">{description}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-1)]">

      {/* ── NAVBAR ── */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass shadow-[var(--shadow-md)] border-b border-[var(--border)]" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-[var(--text-1)] tracking-tight">Nexus</span>
              <span className="hidden sm:inline text-[var(--text-3)] text-sm ml-1.5">· UniPutumayo</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: "Características", href: "#features" },
              { label: "Cómo funciona", href: "#how" },
              { label: "Sobre IUP", href: "#about" },
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
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-all shadow-sm">
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
              { label: "Cómo funciona", href: "#how" },
              { label: "Sobre IUP", href: "#about" },
              { label: "Iniciar sesión", href: "/admin/login" },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--text-2)] hover:bg-[var(--surface-3)] transition-all mt-1">
                <ChevronRight size={14} className="text-[var(--brand)]" /> {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="hero-gradient pt-16 pb-24 md:pt-24 md:pb-32 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--brand-dim)] border border-[var(--brand)] border-opacity-30 text-[var(--brand-text)] text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
              Asistente Universitario con IA
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
              Tu guía inteligente en{" "}
              <span className="gradient-text">UniPutumayo</span>
            </h1>
            <p className="text-lg text-[var(--text-3)] leading-relaxed max-w-lg">
              Consulta programas académicos, requisitos de admisión, horarios y más —
              en segundos, con respuestas respaldadas por documentos oficiales de la IUP.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/chat"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-all shadow-[var(--glow-brand)] hover:shadow-lg active:scale-[.98]">
                <MessageSquare size={18} /> Comenzar ahora
              </Link>
              <a href="#features"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border border-[var(--border)] text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-all">
                Ver características <ArrowRight size={16} />
              </a>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--text-3)]">
              {["Respuestas precisas", "Disponible 24/7", "Voz + Texto"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[var(--brand)]" /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center items-center">
            <div className="absolute w-80 h-80 rounded-full bg-[var(--brand)] opacity-[.06] blur-3xl" />
            <div className="relative z-10 flex flex-col items-center gap-8 lg:flex-row lg:items-end">
              <div className="w-48 h-64 animate-float"><GuacamayaHero /></div>
              <div className="lg:-mb-8 animate-fade-up" style={{ animationDelay: ".2s" }}>
                <ChatPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section id="about" className="py-12 border-y border-[var(--border)] bg-[var(--surface-2)]">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <Stat value="5,000+" label="Estudiantes activos" />
          <Stat value="12"     label="Programas académicos" />
          <Stat value="24/7"   label="Disponibilidad" />
          <Stat value="98%"    label="Precisión" />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-3)] text-sm text-[var(--text-3)] border border-[var(--border)]">
              <Zap size={13} className="text-[var(--brand)]" /> Características
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">
              Todo lo que necesitas, <span className="gradient-text">en un lugar</span>
            </h2>
            <p className="text-[var(--text-3)] max-w-xl mx-auto">
              Nexus combina IA avanzada con información oficial de la IUP para la experiencia de consulta más completa.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature icon={BrainCircuit} title="IA con Contexto Institucional"
              description="Respuestas precisas respaldadas por documentos oficiales de la IUP. No inventamos — consultamos las fuentes."
              accent="#10b981" />
            <Feature icon={Mic} title="Voz y Texto"
              description="Habla o escribe en español colombiano. Nexus te entiende y responde en el modo que prefieras."
              accent="#3b82f6" />
            <Feature icon={GraduationCap} title="Programas Académicos"
              description="Información detallada sobre todos los programas, pensum, facultades y requisitos de ingreso."
              accent="#f59e0b" />
            <Feature icon={Clock} title="Disponible 24/7"
              description="Sin colas, sin esperas. Obtén respuestas instantáneas sobre la IUP en cualquier momento."
              accent="#8b5cf6" />
            <Feature icon={Shield} title="Información Verificada"
              description="Cada respuesta cita sus fuentes. Transparencia total sobre de dónde viene la información."
              accent="#ef4444" />
            <Feature icon={Globe} title="Multiconversación"
              description="Guarda el historial de tus consultas. Retoma conversaciones anteriores cuando quieras."
              accent="#0891b2" />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-20 md:py-28 px-4 sm:px-6 bg-[var(--bg-2)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-3)] text-sm text-[var(--text-3)] border border-[var(--border)]">
              <Sparkles size={13} className="text-[var(--brand)]" /> Cómo funciona
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">
              Tres pasos para <span className="gradient-text">tu respuesta</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Step n={1} title="Haz tu pregunta"
                description="Escribe o usa la voz para preguntar sobre programas, admisiones, horarios u otra información de la IUP." />
              <Step n={2} title="Nexus consulta la fuente"
                description="Nuestro sistema RAG busca en los documentos oficiales de la institución para encontrar la información relevante." />
              <Step n={3} title="Recibe respuesta precisa"
                description="Obtienes una respuesta clara, en español, con las fuentes citadas para que puedas verificar la información." />
            </div>
            <div className="relative flex justify-center">
              <div className="p-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] max-w-xs w-full">
                <div className="space-y-4">
                  {[
                    { role: "user", text: "¿Cuándo son las matrículas?" },
                    { role: "bot",  text: "Las matrículas del primer semestre inician el 15 de enero. Fuente: Reglamento Académico 2024." },
                    { role: "user", text: "¿Qué documentos necesito?" },
                  ].map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        m.role === "user"
                          ? "bg-[var(--brand)] text-white rounded-tr-sm"
                          : "bg-[var(--surface-3)] text-[var(--text-2)] rounded-tl-sm border border-[var(--border)]"
                      }`}>{m.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 md:py-28 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div className="relative z-10 text-center px-8 py-14 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Comienza a explorar la IUP hoy
              </h2>
              <p className="text-white/80 text-lg max-w-lg mx-auto">
                No más esperas. Nexus está listo para responder tus preguntas sobre la Institución Universitaria del Putumayo.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/chat"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold bg-white text-emerald-700 hover:bg-gray-50 transition-all shadow-lg active:scale-[.98]">
                  <MessageSquare size={18} /> Iniciar conversación
                </Link>
                <Link href="/admin/login"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold border border-white/30 text-white hover:bg-white/10 transition-all">
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
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-[var(--text-1)]">Nexus</span>
              <p className="text-xs text-[var(--text-4)]">Institución Universitaria del Putumayo</p>
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
