"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowUp, ArrowRight, MapPin, BookOpen, Mic, Clock,
  ShieldCheck, Search, GraduationCap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const PROGRAMS = [
  { num: "01", name: "Ingeniería de Sistemas",     snies: "SNIES 105603", sede: "Mocoa",                     cat: "Pregrado" },
  { num: "02", name: "Ingeniería Ambiental",        snies: "SNIES 53095",  sede: "Mocoa · Sibundoy",          cat: "Pregrado" },
  { num: "03", name: "Contaduría Pública",          snies: "SNIES 104829", sede: "Mocoa",                     cat: "Pregrado" },
  { num: "04", name: "Ingeniería Forestal",          snies: "SNIES 104559", sede: "Mocoa",                     cat: "Pregrado" },
  { num: "05", name: "Administración de Empresas",  snies: "SNIES 53156",  sede: "Mocoa · Colón · Pto. Asís", cat: "Pregrado" },
  { num: "06", name: "Esp. en Gestión Ambiental",   snies: "Acreditado",   sede: "Mocoa",                     cat: "Posgrado" },
];

const CHIPS = [
  "Costos de matrícula",
  "Cómo inscribirse",
  "Sedes disponibles",
  "Requisitos de admisión",
];

const STATS = [
  { value: "06", label: "Programas vigentes" },
  { value: "03", label: "Sedes en Putumayo" },
  { value: "24/7", label: "Siempre disponible" },
  { value: "100%", label: "Fuentes verificadas" },
];

const FEATURES = [
  {
    num: "01",
    title: "Cada respuesta cita su fuente.",
    body: "Guaca consulta el PEI, los reglamentos y el catálogo oficial de programas. Si no puede respaldarlo con un documento real, no lo responde.",
  },
  {
    num: "02",
    title: "Habla, no escribas.",
    body: "Escucha en español colombiano y responde en voz alta. Útil cuando estás en el celular, caminando o sin tiempo para escribir.",
  },
  {
    num: "03",
    title: "Disponible a cualquier hora.",
    body: "Sin filas, sin horarios de oficina y sin formularios. La información institucional está ahí cuando la necesitas.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const goToChat = (q?: string) => {
    const text = q ?? query.trim();
    if (text) sessionStorage.setItem("guaca_initial_query", text);
    router.push("/chat");
  };

  return (
    <div className="landing">
      {/* ── Navegación ── */}
      <header className="landing-nav">
        <div className="container-wide landing-nav-inner">
          <Link href="/" className="nav-brand">
            <Image src="/isotipo.webp" alt="" width={26} height={26} style={{ objectFit: "contain" }} priority />
            <span>
              <span className="nav-brand-name">Guaca</span>
              <span className="nav-brand-sub">UniPutumayo</span>
            </span>
          </Link>

          <nav className="nav-links" aria-label="Principal">
            <a href="#why" className="nav-link">Por qué Guaca</a>
            <a href="#campus" className="nav-link">La institución</a>
            <a href="#programs" className="nav-link">Programas</a>
            <Link href="/faq" className="nav-link">Preguntas frecuentes</Link>
          </nav>

          <div className="nav-actions">
            <ThemeToggle />
            <Link href="/admin/login" className="btn btn-ghost btn-sm nav-login">
              Iniciar sesión
            </Link>
            <button onClick={() => goToChat()} className="btn btn-primary btn-sm">
              Hablar con Guaca
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="hero">
          <div className="container-wide hero-grid">
            <div className="hero-copy animate-fade-up">
              <span className="eyebrow brand">Asistente institucional · 2026</span>

              <h1 className="display-xl">
                Pregunta lo que quieras.<br />
                <em>La universidad responde.</em>
              </h1>

              <p className="lede">
                Guaca resuelve tus dudas sobre programas, costos, sedes y admisiones
                con información oficial y fuentes verificables del catálogo institucional.
              </p>

              <form onSubmit={(e) => { e.preventDefault(); goToChat(); }}>
                <div className="search-box">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Pregunta por programas, costos, sedes o admisión…"
                    aria-label="Pregunta a Guaca"
                    autoComplete="off"
                  />
                  <button type="submit" className="search-submit" aria-label="Enviar pregunta">
                    <ArrowUp size={17} strokeWidth={2.25} />
                  </button>
                </div>
              </form>

              <div className="chip-row">
                {CHIPS.map((chip) => (
                  <button key={chip} className="chip" onClick={() => goToChat(chip)}>
                    {chip}
                  </button>
                ))}
              </div>

              <p className="hero-note">
                <ShieldCheck size={13} style={{ color: "var(--brand)", flexShrink: 0 }} />
                Respuestas con fuentes citadas · Sin registro para empezar
              </p>
            </div>

            <figure className="hero-figure animate-fade-up stagger-2">
              <div className="hero-figure-img">
                <Image
                  src="/estudiantes.jpg"
                  alt="Estudiantes de la Institución Universitaria del Putumayo"
                  fill
                  sizes="(max-width: 960px) 90vw, 440px"
                  priority
                />
              </div>
              <figcaption>
                <span>Mocoa · Putumayo</span>
                <span>Campus universitario</span>
              </figcaption>

              <div className="hero-quote">
                <span className="meta">Fuentes verificables</span>
                <p>Cada respuesta cita el documento oficial del que proviene.</p>
              </div>
            </figure>
          </div>
        </section>

        {/* ── Cifras ── */}
        <section className="stats-band" aria-label="Cifras institucionales">
          <div className="container-wide">
            <div className="stats-row">
              {STATS.map((stat, i) => (
                <div key={stat.label} className="stats-cell">
                  <div className={`stat-value${i === 1 || i === 3 ? " accent" : ""}`}>{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Por qué Guaca ── */}
        <section id="why" className="section">
          <div className="container-wide split">
            <div className="split-head">
              <span className="eyebrow">Por qué Guaca</span>
              <h2 className="display-lg">Respuestas que puedes verificar.</h2>
              <p className="lede" style={{ fontSize: 14.5 }}>
                No es un buscador genérico. Es el asistente de la institución, entrenado
                con su documentación y obligado a señalar de dónde sale cada dato.
              </p>
            </div>

            <ol className="feature-list">
              {FEATURES.map((feature) => (
                <li key={feature.num} className="feature-item">
                  <span className="feature-num">{feature.num}</span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── La institución ── */}
        <section id="campus" className="image-band">
          <Image
            src="/equipo.jpg"
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center 35%" }}
            aria-hidden
          />
          <div className="container-wide image-band-inner">
            <span className="eyebrow on-dark">La institución</span>
            <blockquote>
              Formando profesionales para la Amazonia desde 1992.
            </blockquote>
            <p className="lede">
              La Institución Universitaria del Putumayo es pública, está acreditada y
              forma líderes en ciencias, tecnología e ingeniería con impacto directo
              en la región.
            </p>
            <ul className="image-band-list">
              <li>Acreditada por el Ministerio de Educación Nacional</li>
              <li>Sedes en Mocoa, Sibundoy y Puerto Asís</li>
              <li>Investigación aplicada en biodiversidad y agua</li>
            </ul>
          </div>
        </section>

        {/* ── Programas ── */}
        <section id="programs" className="section section-tint">
          <div className="container-wide">
            <div className="programs-head">
              <div>
                <span className="eyebrow">Oferta académica</span>
                <h2 className="display-lg">Programas vigentes.</h2>
              </div>
              <a
                href="https://itp.edu.co/ITP2022/"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link"
                style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                Ver catálogo completo <ArrowRight size={12} />
              </a>
            </div>

            <div className="program-grid">
              {PROGRAMS.map((program) => (
                <button
                  key={program.num}
                  onClick={() => goToChat(`Cuéntame sobre ${program.name} en UniPutumayo`)}
                  className="program-row"
                  aria-label={`Preguntar sobre ${program.name}`}
                >
                  <span className="program-code">{program.num}</span>
                  <span>
                    <span className="program-name">{program.name}</span>
                    <span className="program-meta">
                      <span>{program.cat}</span>
                      <span>{program.snies}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <MapPin size={9} /> {program.sede}
                      </span>
                    </span>
                  </span>
                  <span className="program-arrow">
                    <ArrowRight size={12} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="cta-band">
          <div className="container-wide cta-grid">
            <div>
              <span className="eyebrow on-dark">Sin costo · Sin registro</span>
              <h2 className="display-lg">Empieza la conversación.</h2>
              <p className="lede">
                Guaca está disponible ahora con información oficial de UniPutumayo.
                Pregunta en texto o en voz, cuando quieras.
              </p>
            </div>

            <div className="cta-actions">
              <button onClick={() => goToChat()} className="btn btn-primary btn-lg">
                Hablar con Guaca
                <ArrowRight size={15} />
              </button>
              <Link href="/faq" className="cta-link">
                Ver preguntas frecuentes
              </Link>
            </div>
          </div>
        </section>

        {/* ── Capacidades rápidas ── */}
        <section className="section" style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div className="container-wide">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 24,
              }}
            >
              {[
                { Icon: GraduationCap, title: "Programas y SNIES", text: "Oferta vigente, sedes y registro calificado." },
                { Icon: BookOpen, title: "Documentación oficial", text: "PEI, reglamentos y catálogos institucionales." },
                { Icon: Mic, title: "Voz y texto", text: "Pregunta hablando o escribiendo, tú eliges." },
                { Icon: Clock, title: "Siempre disponible", text: "Sin filas ni horarios de atención." },
              ].map(({ Icon, title, text }) => (
                <div key={title} style={{ borderTop: "1px solid var(--rule-strong)", paddingTop: 16 }}>
                  <Icon size={17} strokeWidth={1.6} style={{ color: "var(--brand)" }} />
                  <h3 style={{ margin: "10px 0 4px", fontSize: 14, fontWeight: 650, letterSpacing: "-0.01em" }}>
                    {title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 40, fontSize: 12, color: "var(--ink-3)" }}>
              <Search size={13} />
              <span>
                También puedes explorar las{" "}
                <Link href="/faq" style={{ color: "var(--brand)", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  preguntas frecuentes revisadas por la institución
                </Link>
                .
              </span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
