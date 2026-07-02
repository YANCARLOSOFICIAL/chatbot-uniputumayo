"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowRight, MapPin, BookOpen, Mic, MessageCircle, Search, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/ui/SiteFooter";

/* ── Intersection observer scroll reveal ── */
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

const PROGRAMS = [
  { num: "01", name: "Ingenieria de Sistemas",      snies: "SNIES 105603", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "02", name: "Ingenieria Ambiental",         snies: "SNIES 53095",  sede: "Mocoa · Sibundoy",          cat: "PREGRADO" },
  { num: "03", name: "Contaduria Publica",           snies: "SNIES 104829", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "04", name: "Ingenieria Forestal",          snies: "SNIES 104559", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "05", name: "Administracion de Empresas",   snies: "SNIES 53156",  sede: "Mocoa · Colon · Pto. Asis", cat: "PREGRADO" },
  { num: "06", name: "Esp. en Gestion Ambiental",    snies: "Acreditado",   sede: "Mocoa",                     cat: "POSGRADO" },
];

const CHIPS = ["Que pregrados tienen?", "Costos 2026-1", "Como inscribirse?", "Sedes disponibles"];

const STEPS = [
  { icon: MessageCircle, num: "01", title: "Escribe o habla", body: "Pregunta en espanol natural. Guaca entiende contexto, no solo palabras clave." },
  { icon: Search,        num: "02", title: "Busca en el catalogo", body: "Consulta el PEI, reglamentos y programas oficiales de UniPutumayo en tiempo real." },
  { icon: Shield,        num: "03", title: "Responde con fuentes", body: "Cada respuesta cita el documento de origen. Informacion verificada, no alucinada." },
];

export default function LandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [navVisible, setNavVisible] = useState(true);
  const lastY = useRef(0);

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
    if (text) sessionStorage.setItem("guaca_initial_query", text);
    router.push("/chat");
  };

  const hero   = useInView(0.05);
  const stats  = useInView(0.3);
  const steps  = useInView(0.15);
  const campus = useInView(0.1);
  const bento  = useInView(0.1);
  const progs  = useInView(0.1);
  const cta    = useInView(0.3);

  return (
    <div style={{ background: "#071824", color: "#fff", overflowX: "hidden" }}>
      <div className="noise-layer" aria-hidden />

      {/* ══════ FLOATING PILL NAV ══════ */}
      <nav style={{
        position: "fixed", top: 20, left: "50%",
        transform: `translateX(-50%) translateY(${navVisible ? 0 : -80}px)`,
        zIndex: 90, transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)",
        maxWidth: "calc(100vw - 40px)",
      }}>
        <div className="pill-nav">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <Image src="/isotipo.webp" alt="Guaca" width={22} height={22} style={{ objectFit: "contain" }} priority />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Guaca</span>
          </Link>

          <div className="hidden md:flex" style={{ gap: 18, alignItems: "center" }}>
            {[["Como funciona", "#how"], ["Programas", "#programs"]].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", textDecoration: "none" }} className="hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/admin/login" style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.72)", textDecoration: "none", padding: "6px 12px", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 9999, transition: "color 0.15s, border-color 0.15s", whiteSpace: "nowrap" }}>
              Iniciar sesion
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

      {/* ══════ HERO — campus background ══════ */}
      <main>
        <section className="landing-hero">
          {/* Background photo */}
          <div className="landing-hero-bg" aria-hidden />
          <div className="landing-hero-bg-glow" aria-hidden />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", width: "100%", position: "relative", zIndex: 1 }}>
            <div className="hero-split">

              {/* Left — headline + input */}
              <div ref={hero.ref} className={`reveal${hero.inView ? " in-view" : ""}`}>
                <div style={{ marginBottom: 28 }}>
                  <span className="eyebrow-pill">
                    <span className="dot" />
                    Guaca · UniPutumayo 2026
                  </span>
                </div>

                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(48px, 7vw, 86px)", fontWeight: 900, lineHeight: 0.93, letterSpacing: "-0.04em", margin: "0 0 24px", textWrap: "balance" }}>
                  La guia<br />
                  <span style={{ color: "var(--brand-primary)" }}>academica</span><br />
                  del Putumayo.
                </h1>

                <p style={{ fontSize: "clamp(14px, 1.7vw, 17px)", color: "rgba(255,255,255,0.70)", lineHeight: 1.7, margin: "0 0 36px", maxWidth: 420 }}>
                  Respuestas verificadas del catalogo oficial. Sin filas, sin formularios. Disponible 24 horas.
                </p>

                <form onSubmit={(e) => { e.preventDefault(); goToChat(); }} style={{ marginBottom: 16 }}>
                  <div className="hero-chat-bar" style={{ maxWidth: 440 }}>
                    <input
                      type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="Pregunta sobre programas, costos, sedes..."
                      autoComplete="off"
                    />
                    <button type="submit" className="hero-chat-send" aria-label="Enviar">
                      <ArrowUp size={17} color="#fff" strokeWidth={2.5} />
                    </button>
                  </div>
                </form>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {CHIPS.map((c) => (
                    <button key={c} className="hero-chip" onClick={() => goToChat(c)}>{c}</button>
                  ))}
                </div>
              </div>

              {/* Right — Double-Bezel chat preview */}
              <div className="hidden md:flex justify-center" style={{
                opacity: hero.inView ? 1 : 0,
                transform: hero.inView ? "none" : "translateY(28px)",
                filter: hero.inView ? "none" : "blur(3px)",
                transition: "opacity 0.75s 0.2s cubic-bezier(0.32,0.72,0,1), transform 0.75s 0.2s cubic-bezier(0.32,0.72,0,1), filter 0.75s 0.2s cubic-bezier(0.32,0.72,0,1)",
              }}>
                <div className="double-bezel" style={{ width: "100%", maxWidth: 340 }}>
                  <div className="double-bezel-inner">
                    <div className="chat-mockup-hd">
                      <Image src="/isotipo.webp" alt="Guaca" width={22} height={22} style={{ objectFit: "contain", borderRadius: 5 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1 }}>Guaca</div>
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
                      <div className="mock-input">Preguntale a Guaca...</div>
                      <div className="mock-send"><ArrowUp size={12} color="#fff" /></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══════ STATS STRIP ══════ */}
        <div ref={stats.ref} className={`reveal${stats.inView ? " in-view" : ""}`}
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
            {[
              { val: "6",    lbl: "Programas",        accent: false },
              { val: "3",    lbl: "Sedes activas",    accent: true  },
              { val: "24/7", lbl: "Disponible",       accent: false },
              { val: "100%", lbl: "Catalogo oficial", accent: true  },
            ].map((s, i) => (
              <div key={s.lbl} style={{ padding: "32px 20px", textAlign: "center", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,4vw,38px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: s.accent ? "var(--brand-primary)" : "#fff" }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 7, fontWeight: 500, letterSpacing: "0.04em" }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════ HOW IT WORKS — 3 steps ══════ */}
        <section id="how" style={{ padding: "100px 0", background: "#071824" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px" }}>
            <div ref={steps.ref} className={`reveal${steps.inView ? " in-view" : ""}`} style={{ marginBottom: 52 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.52)", marginBottom: 14 }}>
                Como funciona
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.05, color: "#fff", textWrap: "balance", maxWidth: 520 }}>
                Informacion institucional en segundos.
              </h2>
            </div>

            <div className={`steps-grid reveal${steps.inView ? " in-view" : ""} reveal-d1`}>
              {STEPS.map(({ icon: Icon, num, title, body }) => (
                <div key={num} className="step-card">
                  <div className="step-num">{num}</div>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(27,110,148,0.12)", border: "1px solid rgba(27,110,148,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <Icon size={18} style={{ color: "var(--brand-primary)" }} strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 10px", letterSpacing: "-0.01em" }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.68)", lineHeight: 1.7, margin: 0 }}>
                    {body}
                  </p>
                  <div className="step-connector" aria-hidden />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ CAMPUS IMAGE EDITORIAL SECTION ══════ */}
        <section ref={campus.ref}>
          <div className={`campus-split reveal${campus.inView ? " in-view" : ""}`}>

            {/* Left — campus photo */}
            <div className="campus-img-pane">
              <Image
                src="/estudiantes.jpg"
                alt="Estudiantes UniPutumayo"
                fill
                style={{ objectFit: "cover", objectPosition: "center" }}
                sizes="50vw"
              />
              {/* Subtle overlay */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(7,24,36,0.3) 0%, transparent 50%)" }} />
            </div>

            {/* Right — text */}
            <div className={`campus-text-pane reveal${campus.inView ? " in-view" : ""} reveal-d1`}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(123,181,46,0.7)", marginBottom: 18 }}>
                Universidad del Putumayo
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 20px", lineHeight: 1.05, textWrap: "balance" }}>
                Formacion de calidad en el corazon de la Amazonia.
              </h2>
              <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.70)", lineHeight: 1.75, margin: "0 0 28px" }}>
                Desde 1992, la Institucion Universitaria del Putumayo forma lideres y profesionales en ciencias, tecnologia e ingenieria con impacto regional.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Acreditada por el Ministerio de Educacion",
                  "3 sedes: Mocoa, Sibundoy, Colon, Puerto Asis",
                  "Investigacion aplicada en biodiversidad y agua",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-accent)", marginTop: 7, flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════ FEATURES BENTO ══════ */}
        <section id="features" style={{ padding: "100px 0", background: "#071824" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>

            <div ref={bento.ref} className={`reveal${bento.inView ? " in-view" : ""}`} style={{ marginBottom: 52 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 50px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: 0, lineHeight: 1.05, maxWidth: 560, textWrap: "balance" }}>
                Informacion que puedes citar.
              </h2>
            </div>

            <div className={`feat-bento-v2 reveal${bento.inView ? " in-view" : ""} reveal-d1`}>

              {/* Card 1 — RAG catalog */}
              <div className="agency-card bento-span rotate-card-1" style={{ display: "flex", flexDirection: "column", minHeight: 380 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, marginBottom: 22, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookOpen size={22} style={{ color: "var(--brand-primary)" }} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.015em", color: "#fff" }}>
                  Respuestas del catalogo, no del internet.
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.68)", lineHeight: 1.7, margin: "0 0 auto" }}>
                  Guaca consulta el PEI, reglamentos y catalogo de programas de UniPutumayo. Cada respuesta cita el documento fuente.
                </p>
                <div style={{ marginTop: 24, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="mini-user">Cuales son los requisitos de admision?</div>
                  <div className="mini-bot">Cedula, diploma de bachillerato y puntaje ICFES. Inscripciones cierran el 28 de feb.</div>
                </div>
              </div>

              {/* Card 2 — Voice */}
              <div className="agency-card rotate-card-2">
                <div style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 18, background: "var(--accent-dim)", border: "1px solid var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mic size={18} style={{ color: "var(--brand-accent)" }} strokeWidth={1.8} />
                </div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.01em", color: "#fff" }}>
                  Voz y texto
                </h4>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", margin: 0, lineHeight: 1.65 }}>
                  Habla directamente. Guaca escucha en espanol colombiano y responde al instante.
                </p>
              </div>

              {/* Card 3 — 24/7 */}
              <div className="agency-card rotate-card-3">
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", lineHeight: 1 }}>
                    24<span style={{ color: "var(--brand-primary)", fontSize: 28 }}>/7</span>
                  </span>
                </div>
                <h4 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.01em", color: "#fff" }}>
                  Historial privado
                </h4>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", margin: 0, lineHeight: 1.65 }}>
                  Tu cuenta, tus conversaciones. Disponible sin importar la hora ni el dia.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ══════ PROGRAMS — editorial table ══════ */}
        <section id="programs" style={{ padding: "100px 0", background: "#0A1C2A" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>

            <div ref={progs.ref} className={`reveal${progs.inView ? " in-view" : ""}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 52, flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0, color: "#fff", lineHeight: 1.05, textWrap: "balance" }}>
                  Oferta academica 2026-1.
                </h2>
              </div>
              <a href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", textDecoration: "none" }} className="hover:text-white transition-colors">
                Ver todos los programas
              </a>
            </div>

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
                    <span className="hidden md:inline-block prog-snies">{p.snies}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }} className="hidden md:flex prog-sede">
                      <MapPin size={10} /> {p.sede}
                    </span>
                    <span style={{
                      padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                      letterSpacing: "0.07em",
                      background: p.cat === "POSGRADO" ? "var(--accent-dim)" : "var(--brand-dim)",
                      color: p.cat === "POSGRADO" ? "var(--brand-accent)" : "var(--brand-primary)",
                      border: `1px solid ${p.cat === "POSGRADO" ? "var(--accent-light)" : "var(--brand-light)"}`,
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

        {/* ══════ CTA ══════ */}
        <section style={{ padding: "120px 0", background: "#071824", position: "relative", overflow: "hidden" }}>
          {/* Subtle photo background */}
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "45%", overflow: "hidden", opacity: 0.32 }} aria-hidden>
            <Image src="/lab-aguas.jpg" alt="" fill style={{ objectFit: "cover", objectPosition: "center" }} />
          </div>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "55%", background: "linear-gradient(to right, #071824 20%, transparent 100%)" }} aria-hidden />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", position: "relative", zIndex: 1 }}>
            <div ref={cta.ref} className={`reveal${cta.inView ? " in-view" : ""}`} style={{ maxWidth: 680 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 6vw, 68px)", fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", margin: "0 0 20px", lineHeight: 0.95, textWrap: "balance" }}>
                Empieza ahora.<br />
                <span style={{ color: "rgba(255,255,255,0.48)" }}>Sin costo, sin registro.</span>
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.70)", margin: "0 0 40px", lineHeight: 1.65 }}>
                Guaca responde al instante con informacion oficial de UniPutumayo.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <button onClick={() => goToChat()} className="btn-island" style={{ fontSize: 15, padding: "13px 7px 13px 22px" }}>
                  Habla con Guaca
                  <span className="btn-island-icon" style={{ width: 38, height: 38, marginLeft: 12 }}>
                    <ArrowRight size={16} />
                  </span>
                </button>
                <Link href="/admin/login" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", textDecoration: "none" }} className="hover:text-white/80 transition-colors">
                  Crear una cuenta gratuita
                </Link>
              </div>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
