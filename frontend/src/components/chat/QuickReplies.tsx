"use client";

const SUGGESTIONS = [
  { label: "Pregrados en Mocoa",      icon: "🎓", query: "¿Qué pregrados ofrece UniPutumayo en la sede Mocoa?" },
  { label: "Requisitos de admisión",  icon: "📋", query: "¿Cuáles son los requisitos de admisión para ingresar a UniPutumayo?" },
  { label: "Costos de matrícula",     icon: "💰", query: "¿Cuáles son los costos académicos y derechos de matrícula en UniPutumayo?" },
  { label: "Pensum Ing. Sistemas",    icon: "💻", query: "¿Cuál es el pensum de Ingeniería de Sistemas en UniPutumayo?" },
  { label: "Sedes universitarias",    icon: "📍", query: "¿Cuáles son las sedes de UniPutumayo y qué programas ofrecen?" },
  { label: "Bienestar universitario", icon: "🌿", query: "¿Qué servicios de bienestar universitario ofrece UniPutumayo?" },
];

interface QuickRepliesProps {
  onSelect: (query: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="flex-shrink-0 px-4 pb-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => onSelect(s.query)}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-2)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-dim)] active:scale-[0.96] transition-all whitespace-nowrap flex-shrink-0"
            >
              <span className="text-sm">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
