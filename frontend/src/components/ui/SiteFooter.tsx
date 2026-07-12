"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Globe } from "lucide-react";

/* ── Social icon SVGs (inline, no external dep) ── */
function FacebookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
function YouTubeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.95C18.88 4 12 4 12 4s-6.88 0-8.59.47a2.78 2.78 0 0 0-1.95 1.95A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58a2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" />
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
  { label: "Iniciar sesion",   href: "/admin/login" },
  { label: "Panel de control", href: "/admin/login" },
];

const UNI_LINKS = [
  { label: "Pregrados",              href: "https://itp.edu.co/ITP2022/" },
  { label: "Posgrados",              href: "https://itp.edu.co/ITP2022/" },
  { label: "Bienestar universitario",href: "https://itp.edu.co/ITP2022/" },
  { label: "Investigacion",          href: "https://itp.edu.co/ITP2022/" },
];

const CONTACT = [
  { Icon: MapPin, text: "Barrio Luis Carlos Galan, Mocoa, Putumayo" },
  { Icon: Phone,  text: "(+57) 8 420966" },
  { Icon: Mail,   text: "info@itp.edu.co" },
];

function ColLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
      textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
      marginBottom: 18,
    }}>
      {children}
    </div>
  );
}

function FooterLink({ href, label, external }: { href: string; label: string; external?: boolean }) {
  const style: React.CSSProperties = {
    display: "block", fontSize: 13.5, color: "rgba(255,255,255,0.62)",
    textDecoration: "none", padding: "5px 0", transition: "color 0.12s",
    lineHeight: 1.4,
  };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#fff")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.62)")}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} style={style}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#fff")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.62)")}>
      {label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer style={{
      background: "linear-gradient(180deg, #0E2D45 0%, #071824 100%)",
      borderTop: "1px solid rgba(255,255,255,0.09)",
      padding: "60px 0 32px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>

        {/* 4-col top grid */}
        <div className="footer-grid" style={{
          display: "grid",
          gap: "36px 28px",
          marginBottom: 52,
        }}>

          {/* Brand */}
          <div>
            <Image
              src="/logo-azul.png" alt="Universidad del Putumayo"
              width={128} height={34} priority={false}
              style={{ objectFit: "contain", filter: "brightness(0) invert(1)", marginBottom: 18 }}
            />
            <p style={{
              fontSize: 13.5, color: "rgba(255,255,255,0.62)",
              lineHeight: 1.72, margin: "0 0 22px", maxWidth: 256,
            }}>
              Guaca es el asistente virtual de la Institucion Universitaria del Putumayo.
              Respuestas verificadas del catalogo oficial, disponibles las 24 horas.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {SOCIAL.map(({ href, icon: Icon, label }) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                  aria-label={label}
                  style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.55)",
                    transition: "background 0.15s, color 0.15s, border-color 0.15s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "rgba(27,110,148,0.28)";
                    el.style.color = "#fff";
                    el.style.borderColor = "rgba(27,110,148,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "rgba(255,255,255,0.07)";
                    el.style.color = "rgba(255,255,255,0.55)";
                    el.style.borderColor = "rgba(255,255,255,0.12)";
                  }}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Guaca */}
          <div>
            <ColLabel>Guaca</ColLabel>
            {NAV_LINKS.map((l) => <FooterLink key={l.label} href={l.href} label={l.label} />)}
          </div>

          {/* UniPutumayo */}
          <div>
            <ColLabel>UniPutumayo</ColLabel>
            {UNI_LINKS.map((l) => <FooterLink key={l.label} href={l.href} label={l.label} external />)}
          </div>

          {/* Contacto */}
          <div>
            <ColLabel>Contacto</ColLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {CONTACT.map(({ Icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Icon size={13} style={{ color: "rgba(123,181,46,0.75)", marginTop: 2, flexShrink: 0 }} strokeWidth={1.75} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.60)", lineHeight: 1.6 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 26 }} />

        {/* Bottom row */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", flexWrap: "wrap", gap: 16,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.58)" }}>
              © 2026 Institucion Universitaria del Putumayo. Todos los derechos reservados.
            </span>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.52)", lineHeight: 1.5 }}>
              Desarrollado por{" "}
              <span style={{ color: "rgba(255,255,255,0.70)", fontWeight: 600 }}>Yan Carlos Pinchao Guerra</span>
              {" "}y{" "}
              <span style={{ color: "rgba(255,255,255,0.70)", fontWeight: 600 }}>Ilver Edelmo Chapal Villareal</span>
              {" · "}Grupo de Investigacion Virtualab· UNIPUTUMAYO 2026
            </span>
          </div>

          <Image
            src="/logo-vigilada.png" alt="Vigilada Mineducacion"
            width={78} height={42}
            style={{ objectFit: "contain", opacity: 0.55 }}
          />
        </div>
      </div>
    </footer>
  );
}

/* ── Compact credit strip — used in login page bottom ── */
export function FooterCredit() {
  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.07)",
      padding: "16px 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 10,
      background: "rgba(0,0,0,0.15)",
    }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.52)", lineHeight: 1.5 }}>
        © 2026 Uniputumayo ·{" "}
        <span style={{ color: "rgba(255,255,255,0.55)" }}>Yan Carlos Pinchao</span>
        {" & "}
        <span style={{ color: "rgba(255,255,255,0.55)" }}>Ilver Chapal</span>
      </span>
      <Image src="/logo-vigilada.png" alt="Vigilada Mineducacion" width={54} height={30}
        style={{ objectFit: "contain", opacity: 0.45 }} />
    </div>
  );
}
