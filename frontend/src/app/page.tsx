"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  MessageCircle, BookOpen, Image, History,
  MapPin, Menu, X, ChevronRight
} from "lucide-react";

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const programs = [
    { eyebrow: "Pregrado", name: "Ingeniería de Sistemas", snies: "105603", sede: "Mocoa", featured: false },
    { eyebrow: "Pregrado · Destacado", name: "Ingeniería Ambiental", snies: "53095", sede: "Mocoa · Sibundoy", featured: true },
    { eyebrow: "Pregrado", name: "Contaduría Pública", snies: "104829", sede: "Mocoa", featured: false },
    { eyebrow: "Posgrado", name: "Esp. en Gestión Ambiental", snies: "—", sede: "Mocoa", featured: false },
    { eyebrow: "Pregrado", name: "Ingeniería Forestal", snies: "104559", sede: "Mocoa", featured: false },
    { eyebrow: "Pregrado", name: "Administración de Empresas", snies: "53156", sede: "Mocoa · Colón · Pto. Asís", featured: false },
  ];

  const features = [
    { icon: MessageCircle, title: "Conversación natural", body: "Pregúntale en español, como le preguntarías a un asesor académico. Nexus entiende contexto y matices." },
    { icon: BookOpen, title: "Citas verificadas (RAG)", body: "Cada respuesta cita el catálogo, resoluciones y el PEI. Nada inventado." },
    { icon: Image, title: "Multimodal", body: "Comparte fotos, PDFs o audios. Nexus los lee y los responde." },
    { icon: History, title: "Historial seguro", body: "Todas tus conversaciones quedan guardadas en tu cuenta y puedes retomarlas cuando quieras." },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--surface)", color: "var(--text-1)" }}>

      {/* ── NAVBAR ── */}
      <nav style={{
        background: scrolled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.60)",
        backdropFilter: "blur(14px)",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid rgba(255,255,255,0.15)",
        position: "sticky", top: 0, zIndex: 50,
        transition: "background 0.25s ease, border-color 0.25s ease",
        boxShadow: scrolled ? "var(--shadow-sm)" : "none",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/logo-azul.png" alt="UniPutumayo" style={{ height: 40, objectFit: "contain" }} />
          </Link>

          <div className="hidden md:flex gap-7 items-center">
            {[
              { label: "Conoce a Nexus", href: "#features" },
              { label: "Programas", href: "#programs" },
              { label: "Ayuda", href: "#cta" },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)", textDecoration: "none" }}
                className="hover:text-[var(--brand-primary)] transition-colors">
                {item.label}
              </a>
            ))}
            <Link href="/admin/login" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
              Iniciar sesión
            </Link>
            <Link href="/chat" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
              Habla con Nexus
            </Link>
          </div>

          <button className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: "var(--text-1)" }}
            onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "16px 24px" }}>
            {[
              { label: "Conoce a Nexus", href: "#features" },
              { label: "Programas", href: "#programs" },
              { label: "Ayuda", href: "#cta" },
              { label: "Iniciar sesión", href: "/admin/login" },
              { label: "Habla con Nexus", href: "/chat" },
            ].map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", fontSize: 14, color: "var(--text-1)", textDecoration: "none", fontWeight: 500 }}>
                <ChevronRight size={12} style={{ color: "var(--accent)" }} /> {item.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="hero-campus" style={{ minHeight: 580 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}
          className="flex flex-col md:grid md:grid-cols-[1.4fr_1fr] gap-12 items-center">
          <div style={{ maxWidth: 620 }}>
            <div className="eyebrow-band" style={{ color: "var(--accent)", marginBottom: 16 }}>
              NEXUS UNIPUTUMAYO
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)", fontSize: "clamp(38px, 5vw, 56px)", fontWeight: 800,
              color: "#fff", lineHeight: 1.05, margin: "0 0 20px", letterSpacing: "-0.025em"
            }}>
              Una guacamaya<br />que conoce tu futuro<br />académico.
            </h1>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.88)", lineHeight: 1.6, maxWidth: 520, margin: "0 0 28px" }}>
              Conversa con Nexus 24/7 sobre programas, sedes, costos y trámites. Respuestas verificadas del catálogo institucional.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/chat" className="btn btn-accent btn-lg" style={{ textDecoration: "none" }}>
                Habla con Nexus
              </Link>
              <a href="#programs" className="btn btn-lg" style={{
                background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.3)",
                color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)"
              }}>
                Ver oferta 2026
              </a>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }} className="hidden md:flex">
            <div style={{ position: "relative" }}>
              <div className="nexus-av xl" style={{ width: 180, height: 180, fontSize: 64, boxShadow: "0 24px 60px rgba(11,52,71,0.5)" }}>
                N
              </div>
              <div style={{
                position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)",
                background: "#fff", padding: "6px 14px", borderRadius: 999,
                display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
                color: "var(--text-1)", boxShadow: "var(--shadow-md)", whiteSpace: "nowrap"
              }}>
                <span className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                En línea
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "80px 0", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div className="eyebrow-band" style={{ marginBottom: 8 }}>QUÉ HACE NEXUS</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, marginTop: 0, marginBottom: 48, maxWidth: 720, lineHeight: 1.15, letterSpacing: "-0.015em", color: "var(--text-1)" }}>
            Información académica clara, verificada y siempre disponible.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {features.map((f, i) => (
              <div key={i} className="card card-interactive" style={{ padding: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--r)", background: "var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <f.icon size={22} style={{ color: "var(--brand-primary)" }} />
                </div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: "0 0 6px", color: "var(--text-1)" }}>{f.title}</h4>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.55 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROGRAMS ── */}
      <section id="programs" style={{ padding: "80px 0", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
            <div>
              <div className="eyebrow-band" style={{ marginBottom: 8 }}>OFERTA 2026-1</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, margin: 0, letterSpacing: "-0.015em", color: "var(--text-1)" }}>
                Programas que transforman territorio.
              </h2>
            </div>
            <a href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: "none" }}>
              Ver todos los programas
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {programs.map((p, i) => (
              <div key={i} className="card card-interactive" style={{
                padding: 24,
                borderTop: p.featured ? "3px solid var(--accent)" : "1px solid var(--border)"
              }}>
                <div className="eyebrow-band" style={{ fontSize: 11 }}>{p.eyebrow}</div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: "8px 0 10px", color: "var(--text-1)" }}>{p.name}</h4>
                <div style={{ fontSize: 13, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <MapPin size={12} /> {p.sede}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-3)" }}>
                    SNIES {p.snies}
                  </span>
                  <Link href="/chat" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-primary)", textDecoration: "none" }}>
                    Pregúntale a Nexus →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="cta" style={{ padding: "80px 0", background: "#0B3447", textAlign: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div className="nexus-av xl" style={{ margin: "0 auto 24px", fontSize: 48 }}>N</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, margin: "0 0 12px", color: "#fff", letterSpacing: "-0.015em" }}>
            ¿Listo para empezar?
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", maxWidth: 560, margin: "0 auto 28px" }}>
            Pregúntale a Nexus por tu programa ideal. Sin filas, sin esperas, sin costo.
          </p>
          <Link href="/chat" className="btn btn-accent btn-lg" style={{ textDecoration: "none" }}>
            Habla con Nexus
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0B3447", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "48px 0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", gap: 32 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <img src="/logo-azul.png" alt="UniPutumayo" style={{ height: 36, filter: "brightness(0) invert(1)", objectFit: "contain" }} />
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 14, lineHeight: 1.6 }}>
              Sede Principal: "Aire Libre" Barrio Luis Carlos Galán, Mocoa, Putumayo.<br />
              +57 313 805 2807 · atencionalusuario@itp.edu.co
            </p>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", marginBottom: 14 }}>Nexus</div>
            {["Habla con Nexus", "Cómo funciona", "Privacidad"].map((l) => (
              <Link key={l} href="/chat" style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none", padding: "8px 0" }}
                className="hover:text-white transition-colors">{l}</Link>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", marginBottom: 14 }}>Académico</div>
            {["Pregrados", "Posgrados", "Inscripciones", "Costos"].map((l) => (
              <a key={l} href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
                style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none", padding: "8px 0" }}
                className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fff", marginBottom: 14 }}>Institucional</div>
            {["SIGEDIN", "Biblioteca", "Bienestar"].map((l) => (
              <a key={l} href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
                style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none", padding: "8px 0" }}
                className="hover:text-white transition-colors">{l}</a>
            ))}
            <img src="/logo-vigilada.png" alt="Vigilada Mineducación" style={{ height: 52, marginTop: 14, objectFit: "contain" }} />
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: "24px auto 0", padding: "0 24px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20 }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", margin: 0 }}>
            © {new Date().getFullYear()} Institución Universitaria del Putumayo · Vigilada Mineducación
          </p>
        </div>
      </footer>
    </div>
  );
}
