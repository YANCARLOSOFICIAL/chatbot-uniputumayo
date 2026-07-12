"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowRight, MapPin, BookOpen, Mic, Clock, ShieldCheck, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/ui/SiteFooter";

/* ── Intersection observer scroll reveal ── */
function useInView(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
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
  return [ref, inView];
}

/* ── Count-up on scroll-into-view (feedback: draws the eye to real stats) ── */
function useCountUp(target: number, inView: boolean, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(raf);
    }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);
  return value;
}

const PROGRAMS = [
  { num: "01", name: "Ingenieria de Sistemas",      snies: "SNIES 105603", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "02", name: "Ingenieria Ambiental",         snies: "SNIES 53095",  sede: "Mocoa · Sibundoy",          cat: "PREGRADO" },
  { num: "03", name: "Contaduria Publica",           snies: "SNIES 104829", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "04", name: "Ingenieria Forestal",          snies: "SNIES 104559", sede: "Mocoa",                     cat: "PREGRADO" },
  { num: "05", name: "Administracion de Empresas",   snies: "SNIES 53156",  sede: "Mocoa · Colon · Pto. Asis", cat: "PREGRADO" },
  { num: "06", name: "Esp. en Gestion Ambiental",    snies: "Acreditado",   sede: "Mocoa",                     cat: "POSGRADO" },
];

const CHIPS = ["Costos de matricula", "Como inscribirse?", "Sedes disponibles", "Requisitos de admision"];

export default function LandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const goToChat = (q?: string) => {
    const text = q ?? query.trim();
    if (text) sessionStorage.setItem("guaca_initial_query", text);
    router.push("/chat");
  };

  const [heroRef, heroInView]         = useInView(0.05);
  const [statsRef, statsInView]       = useInView(0.3);
  const [whyRef, whyInView]           = useInView(0.1);
  const [communityRef, communityInView] = useInView(0.2);
  const [campusRef, campusInView]     = useInView(0.1);
  const [progsRef, progsInView]       = useInView(0.1);
  const [ctaRef, ctaInView]           = useInView(0.3);

  const countPrograms = useCountUp(6, statsInView);
  const countSedes    = useCountUp(3, statsInView);
  const countFuentes  = useCountUp(100, statsInView);

  return (
    <div style={{ background: "#071824", color: "#fff", overflowX: "hidden" }}>
      <div className="noise-layer" aria-hidden />

      {/* ══════ FLOATING PILL NAV ══════ */}
      <nav style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 90, maxWidth: "calc(100vw - 40px)" }}>
        <div className="pill-nav">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <Image src="/isotipo.webp" alt="Guaca" width={22} height={22} style={{ objectFit: "contain" }} priority />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>Guaca</span>
          </Link>

          <div className="hidden md:flex" style={{ gap: 18, alignItems: "center" }}>
            {[["Por que Guaca", "#why"], ["Programas", "#programs"]].map(([label, href]) => (
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

      {/* ══════ HERO - asymmetric split, real photo collage ══════ */}
      <main>
        <section style={{ position: "relative", minHeight: "100dvh", display: "flex", alignItems: "center", padding: "112px 0 64px", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 60% at 15% 20%, rgba(27,110,148,0.20) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 90% 85%, rgba(123,181,46,0.10) 0%, transparent 60%)" }} aria-hidden />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", width: "100%", position: "relative", zIndex: 1 }}>
            <div className="hero-split">
              <div ref={heroRef} className={`reveal${heroInView ? " in-view" : ""}`}>

                <div style={{ marginBottom: 24 }}>
                  <span className="eyebrow-pill">
                    <span className="dot" />
                    Guaca · Disponible ahora
                  </span>
                </div>

                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 6.5vw, 50px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px" }}>
                  ¿Quieres conocer<br />
                  sobre la <span style={{ color: "var(--brand-primary)" }}>Uniputumayo</span>?
                </h1>

                <p style={{ fontSize: "clamp(14px, 1.7vw, 17px)", color: "rgba(255,255,255,0.74)", lineHeight: 1.7, margin: "0 0 30px", maxWidth: 440 }}>
                  Programas, costos, sedes y admisiones respondidos con fuentes verificadas del catalogo oficial de la universidad.
                </p>

                <form onSubmit={(e) => { e.preventDefault(); goToChat(); }}>
                  <div className="hero-chat-bar" style={{ maxWidth: 460 }}>
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
              </div>

              <div className={`hero-collage reveal${heroInView ? " in-view" : ""} reveal-d1`} aria-hidden>
                <div className="photo-print photo-print-1">
                  <Image src="/equipo.jpg" alt="" fill style={{ objectFit: "cover", objectPosition: "center 30%" }} sizes="280px" />
                </div>
                <div className="photo-print photo-print-2">
                  <Image src="/bienvenida.jpg" alt="" fill style={{ objectFit: "cover" }} sizes="200px" />
                </div>
                <div className="photo-print photo-print-3">
                  <Image src="/taller.jpg" alt="" fill style={{ objectFit: "cover" }} sizes="200px" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════ STATS STRIP - count-up on scroll ══════ */}
        <div ref={statsRef} className={`reveal${statsInView ? " in-view" : ""}`}
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="stats-grid" style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px" }}>
            {[
              { val: `${countPrograms}`,    lbl: "Programas activos",  accent: false },
              { val: `${countSedes}`,       lbl: "Sedes en Putumayo",  accent: true  },
              { val: "24/7",                lbl: "Siempre disponible", accent: false },
              { val: `${countFuentes}%`,    lbl: "Fuentes verificadas", accent: true  },
            ].map((s) => (
              <div key={s.lbl} className="stats-cell">
                <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,4vw,38px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, color: s.accent ? "var(--brand-primary)" : "#fff" }}>
                  {s.val}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginTop: 7, fontWeight: 500, letterSpacing: "0.04em" }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════ POR QUE GUACA - bento de 4 celdas ══════ */}
        <section id="why" style={{ padding: "100px 0", background: "#071824" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>

            <div ref={whyRef} className={`reveal${whyInView ? " in-view" : ""}`} style={{ marginBottom: 52 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 50px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: 0, lineHeight: 1.05, maxWidth: 560, textWrap: "balance" }}>
                Respuestas que puedes verificar.
              </h2>
            </div>

            <div className={`feat-bento-v2 reveal${whyInView ? " in-view" : ""} reveal-d1`}>

              {/* Big cell - RAG citations demo */}
              <div className="agency-card bento-span rotate-card-1" style={{ display: "flex", flexDirection: "column", minHeight: 380 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, marginBottom: 22, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookOpen size={22} style={{ color: "var(--brand-primary)" }} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.015em", color: "#fff" }}>
                  Cada respuesta cita su fuente.
                </h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.68)", lineHeight: 1.7, margin: "0 0 auto" }}>
                  Guaca consulta el PEI, los reglamentos y el catalogo oficial de programas de Uniputumayo. No responde nada que no pueda respaldar con un documento real.
                </p>
                <div className="mini-chat">
                  <div className="mini-user">Cuales son los requisitos de admision?</div>
                  <div className="mini-bot">Cedula, diploma de bachillerato y puntaje ICFES. Te cuento tambien las fechas de inscripcion vigentes.</div>
                </div>
              </div>

              {/* Photo cell - real campus imagery, tinted */}
              <div
                className="rotate-card-2"
                style={{
                  position: "relative", overflow: "hidden", borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.08)", minHeight: 172,
                  display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 24,
                }}
              >
                <Image src="/hero-fondo.png" alt="" fill style={{ objectFit: "cover", objectPosition: "center 20%" }} sizes="480px" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(7,24,36,0.35) 0%, rgba(7,24,36,0.88) 100%)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Clock size={14} style={{ color: "var(--brand-accent)" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--brand-accent)" }}>24/7</span>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                    Disponible a cualquier hora, sin filas ni tramites.
                  </p>
                </div>
              </div>

              {/* Bottom-right pair - voice + catalog search */}
              <div className="bento-sub-grid">
                <div className="agency-card rotate-card-3" style={{ padding: 22 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, marginBottom: 16, background: "var(--accent-dim)", border: "1px solid var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Mic size={17} style={{ color: "var(--brand-accent)" }} strokeWidth={1.8} />
                  </div>
                  <h4 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em", color: "#fff" }}>
                    Habla, no escribas
                  </h4>
                  <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.68)", margin: 0, lineHeight: 1.6 }}>
                    Escucha en espanol colombiano y responde al instante.
                  </p>
                </div>

                <div className="agency-card rotate-card-3" style={{ padding: 22 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, marginBottom: 16, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Search size={16} style={{ color: "var(--brand-primary)" }} strokeWidth={1.8} />
                  </div>
                  <h4 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.01em", color: "#fff" }}>
                    Busca en el catalogo
                  </h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CHIPS.slice(0, 2).map((c) => (
                      <button key={c} className="hero-chip" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => goToChat(c)}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══════ COMUNIDAD - full-bleed manifesto, foto real del equipo ══════ */}
        <section ref={communityRef} style={{ position: "relative", padding: "150px 0", overflow: "hidden" }}>
          <Image src="/equipo.jpg" alt="" fill style={{ objectFit: "cover", objectPosition: "center 35%", filter: "grayscale(0.55) brightness(0.65) contrast(1.05)" }} aria-hidden />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(95deg, rgba(7,24,36,0.94) 0%, rgba(7,24,36,0.75) 42%, rgba(11,52,71,0.30) 100%)" }} aria-hidden />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", position: "relative", zIndex: 1 }}>
            <div className={`reveal${communityInView ? " in-view" : ""}`} style={{ maxWidth: 620 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 24, background: "var(--brand-dim)", border: "1px solid var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={20} style={{ color: "var(--brand-primary)" }} />
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 20px", lineHeight: 1.1, textWrap: "balance" }}>
                Para toda la comunidad de Uniputumayo.
              </h2>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", lineHeight: 1.75, margin: 0 }}>
                Estudiantes, docentes, aspirantes y personal administrativo pueden resolver sus dudas sobre la universidad en un solo lugar.
              </p>
            </div>
          </div>
        </section>

        {/* ══════ CAMPUS IMAGE EDITORIAL SECTION ══════ */}
        <section ref={campusRef}>
          <div className={`campus-split reveal${campusInView ? " in-view" : ""}`}>

            <div className={`campus-text-pane reveal${campusInView ? " in-view" : ""} reveal-d1`}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,3.5vw,40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 20px", lineHeight: 1.05, textWrap: "balance" }}>
                Formando profesionales para la Amazonia desde 1992.
              </h2>
              <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.70)", lineHeight: 1.75, margin: "0 0 28px" }}>
                La Institucion Universitaria del Putumayo es publica, esta acreditada y forma lideres en ciencias, tecnologia e ingenieria con impacto directo en la region.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Acreditada por el Ministerio de Educacion",
                  "Sedes en Mocoa, Sibundoy y Puerto Asis",
                  "Investigacion aplicada en biodiversidad y agua",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-accent)", marginTop: 7, flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="campus-img-pane">
              <Image
                src="/estudiantes.jpg"
                alt="Estudiantes UniPutumayo"
                fill
                style={{ objectFit: "cover", objectPosition: "center" }}
                sizes="50vw"
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, rgba(7,24,36,0.3) 0%, transparent 50%)" }} />
            </div>
          </div>
        </section>

        {/* ══════ PROGRAMS - card grid ══════ */}
        <section id="programs" style={{ padding: "100px 0", background: "#0A1C2A" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>

            <div ref={progsRef} className={`reveal${progsInView ? " in-view" : ""}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0, color: "#fff", lineHeight: 1.05, textWrap: "balance" }}>
                Oferta academica vigente.
              </h2>
              <a href="https://itp.edu.co/ITP2022/" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", textDecoration: "none" }} className="hover:text-white transition-colors">
                Ver todos los programas
              </a>
            </div>

            <div className={`prog-card-grid reveal${progsInView ? " in-view" : ""} reveal-d1`}>
              {PROGRAMS.map((p) => (
                <button
                  key={p.num}
                  onClick={() => goToChat(`Cuentame sobre ${p.name} en UniPutumayo`)}
                  className="prog-card"
                >
                  <span className="prog-card-arrow"><ArrowRight size={12} color="#fff" /></span>
                  <span className="prog-card-num">{p.num}</span>
                  <span style={{
                    alignSelf: "flex-start",
                    padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.07em",
                    background: p.cat === "POSGRADO" ? "var(--accent-dim)" : "var(--brand-dim)",
                    color: p.cat === "POSGRADO" ? "var(--brand-accent)" : "var(--brand-primary)",
                    border: `1px solid ${p.cat === "POSGRADO" ? "var(--accent-light)" : "var(--brand-light)"}`,
                  }}>
                    {p.cat}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "#fff", lineHeight: 1.25 }}>
                    {p.name}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto" }}>
                    <span className="prog-snies">{p.snies}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }} className="prog-sede">
                      <MapPin size={10} /> {p.sede}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ══════ CTA - full-bleed photo ══════ */}
        <section style={{ padding: "140px 0", position: "relative", overflow: "hidden" }}>
          <Image src="/lab-aguas.jpg" alt="" fill style={{ objectFit: "cover", objectPosition: "center" }} aria-hidden />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, rgba(7,24,36,0.95) 0%, rgba(7,24,36,0.75) 38%, rgba(27,110,148,0.45) 100%)" }} aria-hidden />

          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", position: "relative", zIndex: 1 }}>
            <div ref={ctaRef} className={`reveal${ctaInView ? " in-view" : ""}`} style={{ maxWidth: 640 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
                <ShieldCheck size={14} style={{ color: "var(--brand-accent)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
                  Sin costo · Sin registro
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 6vw, 62px)", fontWeight: 900, letterSpacing: "-0.04em", color: "#fff", margin: "0 0 20px", lineHeight: 1.02, textWrap: "balance" }}>
                Empieza la conversacion.
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.70)", margin: "0 0 40px", lineHeight: 1.65 }}>
                Guaca esta disponible ahora con informacion oficial de Uniputumayo.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                <button onClick={() => goToChat()} className="btn-island" style={{ fontSize: 15, padding: "13px 7px 13px 22px" }}>
                  Hablar con Guaca
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
