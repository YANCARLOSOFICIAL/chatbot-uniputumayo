"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Globe } from "lucide-react";

/* ── Iconos sociales (SVG inline, sin dependencias) ── */
function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
function YouTubeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.95C18.88 4 12 4 12 4s-6.88 0-8.59.47a2.78 2.78 0 0 0-1.95 1.95A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58a2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="var(--footer-bg)" />
    </svg>
  );
}

const SOCIAL = [
  { href: "https://www.facebook.com/universidaddelputumayo", icon: FacebookIcon, label: "Facebook" },
  { href: "https://www.instagram.com/universidadputumayo",  icon: InstagramIcon,  label: "Instagram" },
  { href: "https://www.youtube.com/@universidaddelputumayo", icon: YouTubeIcon,   label: "YouTube" },
  { href: "https://itp.edu.co",                             icon: Globe,          label: "Sitio web" },
];

const NAV_LINKS = [
  { label: "Habla con Guaca",  href: "/chat" },
  { label: "Preguntas frecuentes", href: "/faq" },
  { label: "Iniciar sesión",   href: "/admin/login" },
];

const UNI_LINKS = [
  { label: "Pregrados",               href: "https://itp.edu.co/ITP2022/" },
  { label: "Posgrados",               href: "https://itp.edu.co/ITP2022/" },
  { label: "Bienestar universitario", href: "https://itp.edu.co/ITP2022/" },
  { label: "Investigación",           href: "https://itp.edu.co/ITP2022/" },
];

const CONTACT = [
  { Icon: MapPin, text: "Barrio Luis Carlos Galán, Mocoa, Putumayo" },
  { Icon: Phone,  text: "(+57) 8 420966" },
  { Icon: Mail,   text: "info@itp.edu.co" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-wide">
        <div className="footer-grid">
          {/* Marca */}
          <div>
            <Image
              src="/logo-azul.png"
              alt="Universidad del Putumayo"
              width={126}
              height={34}
              style={{ objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.92, marginBottom: 16 }}
            />
            <p style={{ margin: "0 0 20px", maxWidth: 270, fontSize: 12.5, lineHeight: 1.7, color: "var(--footer-muted)" }}>
              Guaca es el asistente virtual de la Institución Universitaria del Putumayo.
              Respuestas verificadas del catálogo oficial, disponibles las 24 horas.
            </p>
            <div style={{ display: "flex", gap: 7 }}>
              {SOCIAL.map(({ href, icon: Icon, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    border: "1px solid var(--footer-rule)",
                    color: "var(--footer-muted)",
                    textDecoration: "none",
                    transition: "color 120ms, border-color 120ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--footer-fg)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--footer-muted)";
                    e.currentTarget.style.borderColor = "var(--footer-rule)";
                  }}
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Guaca */}
          <div>
            <div className="footer-label">Guaca</div>
            {NAV_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="footer-link">{l.label}</Link>
            ))}
          </div>

          {/* Universidad */}
          <div>
            <div className="footer-label">UniPutumayo</div>
            {UNI_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Contacto */}
          <div>
            <div className="footer-label">Contacto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {CONTACT.map(({ Icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                  <Icon size={12} strokeWidth={1.75} style={{ color: "var(--accent)", marginTop: 3, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--footer-muted)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-rule" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--footer-muted)" }}>
              © 2026 Institución Universitaria del Putumayo. Todos los derechos reservados.
            </span>
            <span style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--footer-muted)" }}>
              Desarrollado por{" "}
              <span style={{ color: "var(--footer-fg)", fontWeight: 500 }}>Yan Carlos Pinchao Guerra</span>
              {" "}y{" "}
              <span style={{ color: "var(--footer-fg)", fontWeight: 500 }}>Ilver Edelmo Chapal Villarreal</span>
              {" · "}Grupo de Investigación Virtualab · UNIPUTUMAYO 2026
            </span>
          </div>

          <Image
            src="/logo-vigilada.png"
            alt="Vigilada Mineducación"
            width={76}
            height={40}
            style={{ objectFit: "contain", opacity: 0.5 }}
          />
        </div>
      </div>
    </footer>
  );
}

/* ── Crédito compacto — usado al pie de las pantallas de autenticación ── */
export function FooterCredit() {
  return (
    <div className="auth-credit">
      <span>
        © 2026 Uniputumayo ·{" "}
        <span style={{ color: "var(--ink-2)" }}>Yan Carlos Pinchao</span>
        {" & "}
        <span style={{ color: "var(--ink-2)" }}>Ilver Chapal</span>
      </span>
      <Image
        src="/logo-vigilada.png"
        alt="Vigilada Mineducación"
        width={52}
        height={28}
        style={{ objectFit: "contain", opacity: 0.45 }}
      />
    </div>
  );
}
