"use client";

const SUGGESTIONS = [
  "Programas académicos disponibles",
  "Requisitos de admisión",
  "Horarios de atención",
  "Pensum Ingeniería de Sistemas",
];

interface QuickRepliesProps {
  onSelect: (text: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-[var(--primary-500)] hover:text-[var(--primary-600)] hover:bg-[var(--primary-100)] transition-all"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
