"use client";

const SUGGESTIONS = [
  { label: "Programas académicos", icon: "🎓", query: "¿Cuáles son los programas académicos de la IUP?" },
  { label: "Requisitos de admisión", icon: "📋", query: "¿Cuáles son los requisitos de admisión para ingresar a la IUP?" },
  { label: "Horarios de atención", icon: "🕐", query: "¿Cuáles son los horarios de atención de la IUP?" },
  { label: "Pensum Ing. Sistemas", icon: "💻", query: "¿Cuál es el pensum de la carrera de Ingeniería de Sistemas?" },
  { label: "Costos de matrícula", icon: "💰", query: "¿Cuáles son los costos de matrícula en la IUP?" },
  { label: "Bienestar universitario", icon: "🌿", query: "¿Qué servicios de bienestar universitario ofrece la IUP?" },
];

interface QuickRepliesProps {
  onSelect: (query: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="flex-shrink-0 px-4 pb-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => onSelect(s.query)}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs font-medium text-[var(--text-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] hover:bg-[var(--brand)]/5 active:scale-[0.96] transition-all shadow-sm hover:shadow-md whitespace-nowrap flex-shrink-0 backdrop-blur-sm"
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
