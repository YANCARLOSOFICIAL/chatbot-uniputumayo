"use client";

const SUGGESTIONS = [
  { label: "Programas académicos", icon: "🎓" },
  { label: "Requisitos de admisión", icon: "📋" },
  { label: "Horarios de atención", icon: "🕐" },
  { label: "Pensum Ing. de Sistemas", icon: "💻" },
];

interface QuickRepliesProps {
  onSelect: (text: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 w-full">
      {SUGGESTIONS.map((s) => (
        <button
          key={s.label}
          onClick={() => onSelect(s.label)}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white border border-gray-200 rounded-full text-xs sm:text-sm text-gray-700 hover:border-[var(--primary-400)] hover:text-[var(--primary-600)] hover:bg-[var(--primary-100)] active:scale-95 transition-all shadow-sm hover:shadow"
        >
          <span>{s.icon}</span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
