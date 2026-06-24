"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowRight, MapPin, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";

/* ── IntersectionObserver scroll reveal ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold, rootMargin: "0px 0px -48px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Data ── */
const PROGRAMS = [
  { num: "01", name: "Ingenieria de Sistemas",      snies: "SNIES 105603", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "02", name: "Ingenieria Ambiental",         snies: "SNIES 53095",  sede: "Mocoa · Sibundoy",          cat: "PREGRADO" },
  { num: "03", name: "Contaduria Publica",           snies: "SNIES 104829", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "04", name: "Ingenieria Forestal",          snies: "SNIES 104559", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "05", name: "Administracion de Empresas",   snies: "SNIES 53156",  sede: "Mocoa · Colon · Pto. Asis", cat: "PREGRADO" },
  { num: "06", name: "Esp. en Gestion Ambiental",    snies: "Acreditado",   sede: "Mocoa",                     cat: "POSGRADO" },
];

const CHIPS = [
  "Que pregrados tienen?",
  "Costos 2026-1",
  "Como inscribirse?",
  "Sedes disponibles",
];

/* ── Ambient glow blob ── */
function Glow({ color, top, left, size = 400 }: { color: string; top: string; left: string; size?: number }) {
  return (
    <div style={{
      position: "absolute", top, left,
      width: size, height: size, borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: "blur(60px)", pointerEvents: "none", transform: "translate(-50%,-50%)",
    }} />
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [navVisible, setNavVisible] = useState(true);
  const lastY = useRef(0);

  /* Hide pill nav on scroll down, show on scroll up */
  useEffect(() => {
    const h = () => {
      const y = window.scrollY;
      setNavVisible(y < 80 || y < lastY.current);
      lastY.current = y;
    };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const goToChat = (q?: string) => {
    const text = q ?? query.trim();
    if (text) sessionStorage.setItem("nexus_initial_query", text);
    router.push("/chat");
  };

  /* Reveal refs */
  const hero   = useInView(0.05);
  const stats  = useInView(0.3);
  const bento  = useInView(0.1);
  const progs  = useInView(0.1);
  const cta    = useInView(0.3);

  return (
    <div style={{ background: "#071824", color: "#fff", overflowX: "hidden" }}>

      {/* Grain overlay — physical texture */}
      <div className="noise-layer" aria-hidden />

      {/* ══════════ FLOATING PILL NAV ══════════ */}
      <nav style={{
        position: "fixed", top: 20, left: "50%",
        transform: `translateX(-50%) translateY(${navVisible ? 0 : -80}px)`,
        zIndex: 90, transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)",
        maxWidth: "calc(100vw - 40px)",
      }}>
        <div className="pill-nav">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <Image src="/isotipo.webp" alt="Nexus" width={22} height={22} style={{ objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
              Nexus
            </span>
          </Link>

          <div className="hidden md:flex" style={{ gap: 18, alignItems: "center" }}>
            <a href="#features" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color 0.15s" }}
              className="hover:text-white">
              Que hace
            </a>
            <a href="#programs" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none", transition: "color 0.15s" }}
              className="hover:text-white">
              Programas
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/admin/login" style={{
              fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.5)",
              textDecoration: "none", padding: "6px 12px",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9999,
              transition: "color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
            }}>
              Entrar
            </Link>
            <button onClick={() => goToChat()} className="btn-island" style={{ fontSize: 12, padding: "7px 5px 7px 14px" }}>
              Hablar
              <span className="btn-island-icon" style={{ width: 26, height: 26, marginLeft: 6 }}>
                <ArrowRight size={11} />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════ HERO — left-aligned, asymmetric split ══════════ */}
      <main>
        <section style={{ minHeight: "100dvh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden", padding: "120px 0 80px" }}>
          <Glow color="rgba(27,110,148,0.14)" top="40%" left="30%" size={600} />
          <Glow color="rgba(123,181,46,0.07)" top="65%" left="75%" size={350} />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", width: "100%", position: "relative", zIndex: 1 }}>
            <div className="hero-split">

              {/* Left — headline + input */}
              <div ref={hero.ref} className={`reveal${hero.inView ? " in-view" : ""}`}>
                {/* Eyebrow pill with pulse dot */}
                <div style={{ marginBottom: 28 }}>
                  <span className="eyebrow-pill">
                    <span className="dot" />
                    NEXUS · UNIPUTUMAYO · 2026
                  </span>
                </div>

                {/* H1 — left-aligned, Variance=8, NOT centered */}
                <h1 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(52px, 7.5vw, 90px)",
                  fontWeight: 900, lineHeight: 0.93,
                  letterSpacing: "-0.04em",
                  margin: "0 0 26px",
                  textWrap: "balance",
                }}>
                  La guia<br />
                  <span style={{ color: "#1B6E94" }}>academica</span><br />
                  del Putumayo.
                </h1>

                <p style={{
                  fontSize: "clamp(15px, 1.8vw, 17px)",
                  color: "rgba(255,255,255,0.52)", lineHeight: 1.7,
                  margin: "0 0 38px", maxWidth: 420,
                }}>
                  Respuestas verificadas del catalogo oficial. Sin filas, sin formularios.
                </p>

                {/* Hero chat bar */}
                <form
                  onSubmit={(e) => { e.preventDefault(); goToChat(); }}
                  style={{ marginBottom: 16 }}
                >
                  <div className="hero-chat-bar" style={{ maxWidth: 440 }}>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Pregunta sobre programas, costos, sedes..."
                      autoComplete="off"
                    />
                    <button type="submit" className="hero-chat-send" aria-label="Enviar">
                      <ArrowUp size={17} color="#fff" strokeWidth={2.5} />
                    </button>
                  </div>
                </form>

                {/* Suggestion chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {CHIPS.map((c) => (
                    <button key={c} className="hero-chip" onClick={() => goToChat(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right — Double-Bezel chat preview */}
              <div className="hidden md:flex justify-center reveal reveal-d2" style={{
                opacity: hero.inView ? 1 : 0,
                transform: hero.inView ? "none" : "translateY(28px)",
                filter: hero.inView ? "none" : "blur(3px)",
                transition: "opacity 0.75s 0.2s cubic-bezier(0.32,0.72,0,1), transform 0.75s 0.2s cubic-bezier(0.32,0.72,0,1), filter 0.75s 0.2s cubic-bezier(0.32,0.72,0,1)",
              }}>
                <div className="double-bezel" style={{ width: "100%", maxWidth: 340 }}>
                  <div className="double-bezel-inner">
                    <div className="chat-mockup-hd">
                      <Image src="/isotipo.webp" alt="Nexus" width={22} height={22} style={{ objectFit: "contain", borderRadius: 5 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1 }}>Nexus</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>UniPutumayo</div>
                      </div>
                      <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                        En linea
                      </span>
                    </div>
                    <div className="chat-mockup-bd">
                      <div className="mock-user">Tienen Ingenieria Ambiental?</div>
                      <div className="mock-bot" style={{ animationDelay: "0.7s" }}>
                        Si, SNIES <span className="mock-tag">53095</span>. Disponible en <strong>Mocoa y Sibundoy</strong>. Quieres saber sobre costos o requisitos?
                      </div>
                      <div className="mock-source" style={{ animationDelay: "1.2s" }}>
                        <BookOpen size={8} /> Catalogo Programas 2026 · 2 fuentes
                      </div>
                    </div>
                    <div className="chat-mockup-ft">
                      <div className="mock-input">Preguntale a Nexus...</div>
                      <div className="mock-send"><ArrowUp size={12} color="#fff" /></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════ STATS — minimal strip ══════════ */}
        <div
          ref={stats.ref}
          className={`reveal${stats.inView ? " in-view" : ""}`}
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {[
              { val: "6",    lbl: "Programas",         accent: false },
              { val: "3",    lbl: "Sedes activas",     accent: true  },
              { val: "24/7", lbl: "Disponible",        accent: false },
              { val: "100%", lbl: "Catalogo oficial",  accent: true  },
            ].map((s, i) => (
              <div key={s.lbl} style={{
                padding: "32px 20px", textAlign: "center",
                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px,4vw,38px)", fontWeight: 900,
                  letterSpacing: "-0.04em", lineHeight: 1,
                  color: s.accent ? "#1B6E94" : "#fff",
                }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 7, fontWeight: 500, letterSpacing: "0.04em" }}>
                  {s.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════ FEATURES — Z-Axis Bento (no 3 equal cards, rotated depth) ══════════ */}
        <section id="features" style={{ padding: "120px 0", background: "#071824" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>

            <div ref={bento.ref} className={`reveal${bento.inView ? " in-view" : ""}`} style={{ marginBottom: 52 }}>
              <h2 style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px, 4.5vw, 52px)",
                fontWeight: 800, letterSpacing: "-0.03em",
                color: "#fff", margin: 0, lineHeight: 1.05,
                maxWidth: 560, textWrap: "balance",
              }}>
                Informacion que puedes citar.
              </h2>
            </div>

            {/* Z-Axis bento — 3 cards with physical rotation */}
            <div className={`feat-bento-v2 reveal${bento.inView ? " in-view" : ""} reveal-d1`}>

              {/* Card 1 — main (spans 2 rows), rotated */}
              <div className="agency-card bento-span rotate-card-1" style={{ display: "flex", flexDirection: "column", minHeight: 380 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, marginBottom: 22,
                  background: "rgba(27,110,148,0.15)", border: "1px solid rgba(27,110,148,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BookOpen size={22} style={{ color: "#1B6E94" }} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.015em", color: "#fff" }}>
                  Respuestas del catalogo, no del internet.
                </h3>
                <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 0 auto" }}>
                  Nexus consulta el PEI, reglamentos y catalogo de programas de UniPutumayo. Cada respuesta cita el documento fuente.
                </p>
                {/* Mini chat inside card */}
                <div style={{
                  marginTop: 24, background: "rgba(0,0,0,0.25)", borderRadius: 12,
                  padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div className="mini-user">Cuales son los requisitos de admision?</div>
                  <div className="mini-bot">Cedula, diploma de bachillerato y puntaje ICFES. Inscripciones cierran el 28 de feb.</div>
                </div>
              </div>

              {/* Card 2 — top right, rotated */}
              <div className="agency-card rotate-card-2">
                <div style={{
                  width: 40, height: 40, borderRadius: 12, marginBottom: 18,
                  background: "rgba(123,181,46,0.12)", border: "1px solid rgba(123,181,46,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7BB52E" strokeWidth="1.8">
                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                </div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.01em", color: "#fff" }}>
                  Voz y texto
                </h4>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.65 }}>
                  Habla directamente. Nexus escucha en espanol colombiano y responde al instante.
                </p>
              </div>

              {/* Card 3 — bottom right, rotated */}
              <div className="agency-card rotate-card-3">
                <div style={{ marginBottom: 16 }}>
                  <span style={{
                    fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 900,
                    letterSpacing: "-0.04em", color: "#fff", lineHeight: 1,
                  }}>
                    24<span style={{ color: "#1B6E94", fontSize: 28 }}>/7</span>
                  </span>
                </div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.01em", color: "#fff" }}>
                  Historial privado
                </h4>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.65 }}>
                  Tu cuenta, tus conversaciones. Disponible sin importar la hora ni el dia.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════ PROGRAMS — editorial table ══════════ */}
        <section id="programs" style={{ padding: "100px 0", background: "#0A1C2A" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>

            <div
              ref={progs.ref}
              className={`reveal${progs.inView ? " in-view" : ""}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 52, flexWrap: "wrap", gap: 16 }}
            >
              <div>
                <h2 style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px,4vw,46px)", fontWeight: 800,
                  letterSpacing: "-0.03em", margin: 0, color: "#fff", lineHeight: 1.05, textWrap: "balance",
                }}>
                  Oferta academica 2026-1.
                </h2>
              </div>
              <a href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "color 0.15s" }}
                className="hover:text-white">
                Ver todos los programas
              </a>
            </div>

            {/* Editorial program rows */}
            <div className={`reveal${progs.inView ? " in-view" : ""} reveal-d1`}>
              {PROGRAMS.map((p) => (
                <button
                  key={p.num}
                  onClick={() => goToChat(`Cuentame sobre ${p.name} en UniPutumayo`)}
                  className="prog-row"
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span className="prog-num">{p.num}</span>
                  <span className="prog-name">{p.name}</span>
                  <span className="prog-dots" />
                  <span className="prog-meta">
                    <span style={{
                      display: "none",
                    }} className="md:inline-block prog-snies">
                      {p.snies}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }} className="hidden md:flex prog-sede">
                      <MapPin size={10} /> {p.sede}
                    </span>
                    <span style={{
                      padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                      letterSpacing: "0.07em",
                      background: p.cat === "POSGRADO" ? "rgba(123,181,46,0.12)" : "rgba(27,110,148,0.12)",
                      color: p.cat === "POSGRADO" ? "#7BB52E" : "#1B6E94",
                      border: `1px solid ${p.cat === "POSGRADO" ? "rgba(123,181,46,0.2)" : "rgba(27,110,148,0.2)"}`,
                    }}>
                      {p.cat}
                    </span>
                  </span>
                  <span className="prog-arrow">
                    <ArrowRight size={12} color="#fff" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ CTA — bold, left-aligned ══════════ */}
        <section style={{ padding: "120px 0", background: "#071824", position: "relative", overflow: "hidden" }}>
          <Glow color="rgba(27,110,148,0.12)" top="50%" left="70%" size={500} />
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", position: "relative", zIndex: 1 }}>
            <div
              ref={cta.ref}
              className={`reveal${cta.inView ? " in-view" : ""}`}
              style={{ maxWidth: 680 }}
            >
              <h2 style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(36px, 6vw, 72px)",
                fontWeight: 900, letterSpacing: "-0.04em",
                color: "#fff", margin: "0 0 20px", lineHeight: 0.95,
                textWrap: "balance",
              }}>
                Empieza ahora.<br />
                <span style={{ color: "rgba(255,255,255,0.28)" }}>Sin costo, sin registro.</span>
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", margin: "0 0 40px", lineHeight: 1.65 }}>
                Nexus responde al instante con informacion oficial de UniPutumayo.
              </p>

              {/* Button-in-button island */}
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <button onClick={() => goToChat()} className="btn-island" style={{ fontSize: 15, padding: "13px 7px 13px 22px" }}>
                  Habla con Nexus
                  <span className="btn-island-icon" style={{ width: 38, height: 38, marginLeft: 12 }}>
                    <ArrowRight size={16} />
                  </span>
                </button>
                <Link href="/admin/login" style={{
                  fontSize: 14, color: "rgba(255,255,255,0.35)",
                  textDecoration: "none", transition: "color 0.15s",
                }}
                  className="hover:text-white">
                  Soy administrador
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ FOOTER ══════════ */}
        <footer style={{ background: "#040E16", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "48px 0 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32, marginBottom: 36 }}>

              <div style={{ maxWidth: 280 }}>
                <Image src="/logo-azul.png" alt="UniPutumayo" width={120} height={34}
                  style={{ filter: "brightness(0) invert(1)", objectFit: "contain" }} />
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 12, lineHeight: 1.7 }}>
                  Barrio Luis Carlos Galan, Mocoa, Putumayo.
                </p>
              </div>

              <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
                    Nexus
                  </div>
                  {[
                    { label: "Habla con Nexus", href: "/chat" },
                    { label: "Entrar",          href: "/admin/login" },
                  ].map((l) => (
                    <Link key={l.href} href={l.href}
                      style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", padding: "5px 0", transition: "color 0.15s" }}
                      className="hover:text-white">
                      {l.label}
                    </Link>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
                    Institucional
                  </div>
                  {["Pregrados", "Posgrados", "Bienestar"].map((l) => (
                    <a key={l} href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
                      style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none", padding: "5px 0", transition: "color 0.15s" }}
                      className="hover:text-white">
                      {l}
                    </a>
                  ))}
                </div>
              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 20, flexWrap: "wrap", gap: 12 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                2026 Institucion Universitaria del Putumayo. Vigilada Mineducacion.
              </span>
              <Image src="/logo-vigilada.png" alt="Vigilada Mineducacion" width={80} height={44}
                style={{ objectFit: "contain", opacity: 0.5 }} />
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
