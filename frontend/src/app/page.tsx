"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  MessageSquare, ArrowRight, BrainCircuit,
  Mic, GraduationCap, Shield,
  Clock, Globe, Menu, X, ChevronRight, User
} from "lucide-react";

const IUP_LOGO = "https://itp.edu.co/ITP2022/wp-content/uploads/2026/03/Logo-UNIPUTUMAYO-500px-x-500px-01.png";

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

      {/* ── NAVBAR ── */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#031928]/92 backdrop-blur-xl border-b border-white/8 shadow-lg"
          : "bg-transparent"
      }`}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src={IUP_LOGO}
              alt="UNIPUTUMAYO"
              className="h-8 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-white text-[13px] tracking-tight">NEXUS</span>
              <span className="text-[9px] text-white/50 font-medium tracking-wider hidden sm:block">
                UNIPUTUMAYO
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {[
              { label: "Beneficios", href: "#features" },
              { label: "Cómo funciona", href: "#how" },
            ].map((item) => (
              <a key={item.href} href={item.href}
                className="px-3 py-1.5 rounded-lg text-[13px] text-white/60 hover:text-white transition-colors">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/admin/login"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-[13px] text-white/60 hover:text-white transition-colors">
              <User size={13} /> Acceder
            </Link>
            <Link href="/chat"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[#F7BF00] text-[#031928] hover:bg-[#e8b300] transition-all active:scale-[.97]">
              Chatear <ArrowRight size={13} />
            </Link>
            <button
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-5 pb-4 border-t border-white/8 bg-[#031928]/95 backdrop-blur-xl">
            {[
              { label: "Beneficios", href: "#features" },
              { label: "Cómo funciona", href: "#how" },
              { label: "Acceder", href: "/admin/login" },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-white/70 hover:text-white transition-colors mt-0.5">
                <ChevronRight size={11} className="text-[#F7BF00]" /> {item.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="hero-campus -mt-14">
        <div className="min-h-[100vh] flex items-center justify-center pt-14">
          <div className="max-w-2xl mx-auto px-5 sm:px-6 py-24 text-center">

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F7BF00]/25 bg-[#F7BF00]/8 text-[#F7BF00] text-[12px] font-medium mb-8 animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F7BF00] animate-pulse" />
              Asistente con inteligencia artificial
            </div>

            <h1 className="text-display text-4xl sm:text-5xl lg:text-[3.5rem] text-white mb-5 animate-fade-up" style={{ animationDelay: ".05s" }}>
              Encuentra lo que{" "}
              <br className="hidden sm:block" />
              necesitas en la{" "}
              <span className="text-[#F7BF00]">IUP</span>
            </h1>

            <p className="text-body text-base sm:text-lg text-white/60 max-w-lg mx-auto mb-10 animate-fade-up" style={{ animationDelay: ".1s" }}>
              Consulta programas académicos, requisitos de admisión, horarios y toda la información oficial de la universidad — al instante.
            </p>

            <div className="animate-fade-up" style={{ animationDelay: ".15s" }}>
              <Link href="/chat"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold bg-[#F7BF00] text-[#031928] hover:bg-[#e8b300] transition-all shadow-lg shadow-[#F7BF00]/15 active:scale-[.97] text-base">
                <MessageSquare size={17} /> Preguntar ahora
              </Link>
            </div>

            <div className="flex justify-center gap-6 mt-10 animate-fade-up" style={{ animationDelay: ".2s" }}>
              {[
                { icon: Shield, label: "Fuentes verificadas" },
                { icon: Clock, label: "Disponible 24/7" },
                { icon: Mic, label: "Voz y texto" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-[12px] text-white/40">
                  <Icon size={12} /> {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/25 animate-float">
          <div className="w-px h-6 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-5 sm:px-6 bg-[var(--bg)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-label text-[var(--brand)] font-semibold mb-3 uppercase tracking-wider">Beneficios</p>
            <h2 className="text-display text-2xl sm:text-3xl text-[var(--text-1)]">
              Todo lo que necesitas, en un lugar
            </h2>
          </div>

          {/* Asymmetric layout: one big + two stacked */}
          <div className="grid md:grid-cols-5 gap-4">
            {/* Main feature — big */}
            <div className="md:col-span-3 feature-card flex flex-col justify-between min-h-[220px] animate-appear stagger-1">
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "#09618F18", color: "#09618F" }}>
                  <BrainCircuit size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-[var(--text-1)] mb-2 text-base">IA con contexto institucional</h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">
                  Cada respuesta está respaldada por documentos oficiales de la IUP. No inventamos — consultamos las fuentes reales para darte información confiable.
                </p>
              </div>
            </div>

            {/* Two stacked */}
            <div className="md:col-span-2 flex flex-col gap-4">
              <div className="feature-card flex-1 animate-appear stagger-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "#F7BF0018", color: "#d4a000" }}>
                  <Mic size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-[var(--text-1)] mb-1.5 text-sm">Voz y texto</h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">
                  Habla o escribe en español. Nexus te entiende y responde como prefieras.
                </p>
              </div>
              <div className="feature-card flex-1 animate-appear stagger-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: "#80BF1F18", color: "#6aab15" }}>
                  <GraduationCap size={20} strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-[var(--text-1)] mb-1.5 text-sm">Programas académicos</h3>
                <p className="text-sm text-[var(--text-2)] leading-relaxed">
                  Información actualizada sobre todos los programas, pensum y requisitos de admisión.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 px-5 sm:px-6 bg-[var(--bg-2)] border-y border-[var(--border)]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-label text-[var(--brand)] font-semibold mb-3 uppercase tracking-wider">Cómo funciona</p>
            <h2 className="text-display text-2xl sm:text-3xl text-[var(--text-1)]">
              Tres pasos para tu respuesta
            </h2>
          </div>

          <div className="flex flex-col md:flex-row gap-0">
            {[
              { n: "1", title: "Haz tu pregunta", desc: "Escribe o usa la voz para preguntar sobre la IUP." },
              { n: "2", title: "Nexus consulta",  desc: "Busca en documentos oficiales la información más relevante." },
              { n: "3", title: "Obtén respuesta",  desc: "Recibe una respuesta clara con fuentes citadas." },
            ].map(({ n, title, desc }, i) => (
              <div key={n} className="flex-1 relative animate-appear" style={{ animationDelay: `${i * 80}ms` }}>
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-6 right-0 w-full h-px bg-[var(--border)]" style={{ left: "50%" }} />
                )}
                <div className="text-center px-4 py-6">
                  <div className="w-10 h-10 rounded-full border-2 border-[var(--brand)] text-[var(--brand)] flex items-center justify-center mx-auto mb-3 text-sm font-bold bg-[var(--bg-2)] relative z-10">
                    {n}
                  </div>
                  <h4 className="font-semibold text-[var(--text-1)] text-sm mb-1">{title}</h4>
                  <p className="text-sm text-[var(--text-2)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-5 sm:px-6 bg-[var(--bg)]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-display text-2xl sm:text-3xl text-[var(--text-1)] mb-3">
            Empieza a explorar la IUP
          </h2>
          <p className="text-[var(--text-2)] mb-8 text-base">
            Nexus está listo para responder tus preguntas.
          </p>
          <Link href="/chat"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition-all shadow-sm active:scale-[.97] text-base">
            <MessageSquare size={17} /> Iniciar conversación
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-2)] py-8 px-5 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={IUP_LOGO} alt="UNIPUTUMAYO" className="h-6 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-sm text-[var(--text-2)]">Nexus IA · UniPutumayo</span>
          </div>
          <div className="flex items-center gap-5 text-[13px] text-[var(--text-3)]">
            <Link href="/chat" className="hover:text-[var(--text-1)] transition-colors">Chat</Link>
            <Link href="/admin/login" className="hover:text-[var(--text-1)] transition-colors">Administrador</Link>
            <a href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
              className="hover:text-[var(--text-1)] transition-colors flex items-center gap-1">
              <Globe size={12} /> itp.edu.co
            </a>
          </div>
          <p className="text-[11px] text-[var(--text-3)]">© {new Date().getFullYear()} UNIPUTUMAYO</p>
        </div>
      </footer>
    </div>
  );
}
