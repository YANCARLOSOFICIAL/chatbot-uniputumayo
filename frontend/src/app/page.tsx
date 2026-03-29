"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  MessageSquare, Zap, ArrowRight, CheckCircle2,
  Mic, Globe, BrainCircuit, GraduationCap, Shield,
  Clock, FileText, Sparkles, Menu, X, ChevronRight
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/* URL oficial del logo de la universidad */
const IUP_LOGO = "https://itp.edu.co/ITP2022/wp-content/uploads/2026/03/Logo-UNIPUTUMAYO-500px-x-500px-01.png";

/* ── Chat preview mockup ── */
function ChatPreview() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 bg-white/5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-white/60 font-medium">Nexus · Chat</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2.5">
          <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={10} className="text-white" />
          </div>
          <div className="bg-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-white/85 max-w-[85%]">
            Hola, ¿en qué puedo ayudarte hoy?
          </div>
        </div>

        <div className="flex justify-end">
          <div className="bg-[#09618F] px-3 py-2 text-xs text-white max-w-[85%] rounded-2xl rounded-tr-sm">
            ¿Cuáles son los programas de ingeniería?
          </div>
        </div>

        <div className="flex gap-2.5">
          <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={10} className="text-white" />
          </div>
          <div className="bg-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-white/85 max-w-[90%] leading-relaxed">
            IUP ofrece <strong className="text-[#F7BF00]">Ing. de Sistemas</strong> e <strong className="text-[#F7BF00]">Ing. Agroecológica</strong>…
          </div>
        </div>

        <div className="flex gap-2.5 items-end">
          <div className="w-6 h-6 rounded-lg gradient-brand flex items-center justify-center shrink-0">
            <Sparkles size={10} className="text-white" />
          </div>
          <div className="bg-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F7BF00] typing-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#F7BF00] typing-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#F7BF00] typing-dot-3" />
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 flex items-center gap-2">
          <span className="flex-1 text-xs text-white/40">Escribe tu pregunta…</span>
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
      <div className="text-3xl md:text-4xl font-extrabold text-[#F7BF00]">{value}</div>
      <div className="text-sm text-white/60 mt-1">{label}</div>
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
    <div className="min-h-screen text-[var(--text-1)]">

      {/* ══════════════════════════════════════
          NAVBAR — sobre la imagen del campus
      ══════════════════════════════════════ */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#031928]/90 backdrop-blur-lg border-b border-white/10 shadow-lg"
          : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* Logo oficial IUP */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src={IUP_LOGO}
              alt="UNIPUTUMAYO"
              className="h-9 w-auto object-contain drop-shadow-md"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-white text-sm tracking-tight">NEXUS</span>
              <span className="text-[10px] text-[#F7BF00] font-medium tracking-widest uppercase hidden sm:block">
                UNIPUTUMAYO
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: "Características", href: "#features" },
              { label: "Cómo funciona",   href: "#how" },
              { label: "Sobre IUP",       href: "#about" },
            ].map((item) => (
              <a key={item.href} href={item.href}
                className="px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-all">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <Link href="/admin/login"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/80 hover:bg-white/10 transition-all border border-white/20">
              Iniciar sesión
            </Link>
            <Link href="/chat"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#F7BF00] text-[#031928] hover:bg-yellow-300 transition-all shadow-sm">
              Chatear <ArrowRight size={14} />
            </Link>
            <button
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition-all"
              onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-4 pb-4 border-t border-white/10 bg-[#031928]/95 backdrop-blur-lg">
            {[
              { label: "Características", href: "#features" },
              { label: "Cómo funciona",   href: "#how" },
              { label: "Sobre IUP",       href: "#about" },
              { label: "Iniciar sesión",  href: "/admin/login" },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/10 transition-all mt-1">
                <ChevronRight size={13} className="text-[#F7BF00]" /> {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════
          HERO — con foto del campus IUP
      ══════════════════════════════════════ */}
      <section className="hero-campus -mt-16">
        <div className="min-h-screen flex items-center pt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full grid lg:grid-cols-2 gap-16 items-center py-20">

            {/* Texto */}
            <div className="space-y-7 animate-fade-up">
              {/* Badge institucional */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F7BF00]/30 bg-[#F7BF00]/10 text-[#F7BF00] text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-[#F7BF00] animate-pulse" />
                Asistente universitario con IA
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight text-white">
                Tu guía inteligente<br />
                en la{" "}
                <span className="text-[#F7BF00]">
                  UNIPUTUMAYO
                </span>
              </h1>

              <p className="text-lg text-white/70 leading-relaxed max-w-lg">
                Consulta programas académicos, requisitos de admisión, horarios y más —
                en segundos, con respuestas respaldadas por documentos oficiales de la IUP.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/chat"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold bg-[#F7BF00] text-[#031928] hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-500/20 active:scale-[.98]">
                  <MessageSquare size={17} /> Empezar ahora
                </Link>
                <a href="#features"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold border border-white/25 text-white hover:bg-white/10 transition-all">
                  Ver características <ArrowRight size={15} />
                </a>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-white/60">
                {["Respuestas precisas", "Disponible 24/7", "Voz + Texto"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-[#F7BF00]" /> {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Chat preview */}
            <div className="relative flex justify-center lg:justify-end items-center animate-fade-up" style={{ animationDelay: ".15s" }}>
              <div className="absolute w-64 h-64 rounded-full bg-[#F7BF00] opacity-[.06] blur-3xl" />
              <div className="relative z-10">
                <ChatPreview />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40 animate-float">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS — con bg oscuro
      ══════════════════════════════════════ */}
      <section id="about" className="py-16 bg-[#031928] border-y border-white/8">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-10">
          <Stat value="5,000+" label="Estudiantes activos" />
          <Stat value="12"     label="Programas académicos" />
          <Stat value="24/7"   label="Disponibilidad" />
          <Stat value="98%"    label="Precisión" />
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES
      ══════════════════════════════════════ */}
      <section id="features" className="py-24 md:py-32 px-4 sm:px-6 bg-[var(--bg)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-dim)] text-[var(--brand-text)] text-sm border border-[var(--border)]">
              <Zap size={12} className="text-[var(--brand)]" /> Características
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Todo lo que necesitas,{" "}
              <span className="gradient-text">en un lugar</span>
            </h2>
            <p className="text-[var(--text-3)] max-w-xl mx-auto text-lg">
              Nexus combina IA avanzada con información oficial de la IUP.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BrainCircuit, title: "IA con Contexto Institucional",
                desc: "Respuestas respaldadas por documentos oficiales de la IUP. No inventamos — consultamos las fuentes.", color: "#09618F" },
              { icon: Mic, title: "Voz y Texto",
                desc: "Habla o escribe en español colombiano. Nexus te entiende y responde como prefieras.", color: "#F7BF00" },
              { icon: GraduationCap, title: "Programas Académicos",
                desc: "Información detallada sobre todos los programas, pensum, facultades y requisitos.", color: "#80BF1F" },
              { icon: Clock, title: "Disponible 24/7",
                desc: "Sin colas ni esperas. Respuestas instantáneas sobre la IUP en cualquier momento.", color: "#0ea5e9" },
              { icon: Shield, title: "Información Verificada",
                desc: "Cada respuesta cita sus fuentes. Transparencia total sobre la información.", color: "#ef4444" },
              { icon: Globe, title: "Multiconversación",
                desc: "Guarda y retoma el historial de todas tus consultas cuando quieras.", color: "#8b5cf6" },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="feature-card cursor-default">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: color + "18", color }}
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

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section id="how" className="py-24 md:py-32 px-4 sm:px-6 bg-[var(--bg-2)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--brand-dim)] text-[var(--brand-text)] text-sm border border-[var(--border)]">
              <Sparkles size={12} className="text-[var(--brand)]" /> Cómo funciona
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Tres pasos para tu{" "}
              <span className="gradient-text">respuesta</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Haz tu pregunta",
                desc: "Escribe o usa la voz para preguntar sobre programas, admisión o cualquier información de la IUP." },
              { n: "02", title: "Nexus consulta",
                desc: "Busca en los documentos oficiales de la institución para encontrar la información más relevante." },
              { n: "03", title: "Obtén respuesta",
                desc: "Recibes respuesta clara en español, con fuentes citadas para que puedas verificar." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex flex-col gap-4 p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <span className="text-5xl font-black text-[var(--brand)] opacity-20 leading-none">{n}</span>
                <h4 className="font-bold text-[var(--text-1)] text-base">{title}</h4>
                <p className="text-sm text-[var(--text-3)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA — con fondo del campus
      ══════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 px-4 sm:px-6">
        {/* Fondo campus */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://itp.edu.co/ITP2022/wp-content/uploads/2025/11/Fondo1-2400-x-800-01-scaled.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#031928]/90 via-[#09618F]/80 to-[#031928]/90" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Comienza a explorar la IUP hoy
          </h2>
          <p className="text-white/70 text-lg max-w-md mx-auto">
            Nexus está listo para responder tus preguntas sobre la Institución Universitaria del Putumayo.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/chat"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold bg-[#F7BF00] text-[#031928] hover:bg-yellow-300 transition-all shadow-lg active:scale-[.98]">
              <MessageSquare size={17} /> Iniciar conversación
            </Link>
            <Link href="/admin/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold border border-white/25 text-white hover:bg-white/10 transition-all">
              Acceso administrador
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-2)] py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src={IUP_LOGO} alt="UNIPUTUMAYO" className="h-8 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div>
              <span className="font-bold text-sm text-[var(--text-1)]">Nexus IA</span>
              <p className="text-[11px] text-[var(--text-4)]">Institución Universitaria del Putumayo</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[var(--text-3)]">
            <Link href="/chat"     className="hover:text-[var(--brand)] transition-colors">Chat</Link>
            <Link href="/admin/login" className="hover:text-[var(--brand)] transition-colors">Administrador</Link>
            <a href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
              className="hover:text-[var(--brand)] transition-colors flex items-center gap-1">
              <Globe size={13} /> itp.edu.co
            </a>
          </div>
          <p className="text-xs text-[var(--text-4)]">© {new Date().getFullYear()} UNIPUTUMAYO · Nexus IA</p>
        </div>
      </footer>
    </div>
  );
}
