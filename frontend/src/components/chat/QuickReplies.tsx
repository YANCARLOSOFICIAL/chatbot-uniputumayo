"use client";

import { GraduationCap, ClipboardList, Coins, MapPin, Code2, Leaf } from "lucide-react";

const SUGGESTIONS = [
  { label: "Pregrados en Mocoa",      Icon: GraduationCap, query: "Que pregrados ofrece UniPutumayo en la sede Mocoa?" },
  { label: "Requisitos de admision",  Icon: ClipboardList,  query: "Cuales son los requisitos de admision para ingresar a UniPutumayo?" },
  { label: "Costos matricula 2026",   Icon: Coins,          query: "Cuales son los costos academicos y derechos de matricula en UniPutumayo?" },
  { label: "Pensum Ing. Sistemas",    Icon: Code2,          query: "Cual es el pensum de Ingenieria de Sistemas en UniPutumayo?" },
  { label: "Sedes universitarias",    Icon: MapPin,         query: "Cuales son las sedes de UniPutumayo y que programas ofrecen?" },
  { label: "Bienestar universitario", Icon: Leaf,           query: "Que servicios de bienestar universitario ofrece UniPutumayo?" },
];

interface QuickRepliesProps {
  onSelect: (query: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="flex-shrink-0 px-4 pb-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {SUGGESTIONS.map(({ label, Icon, query }) => (
            <button
              key={label}
              onClick={() => onSelect(query)}
              className="flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 active:scale-[0.96] transition-all hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-dim)]"
              style={{
                padding: "5px 12px", borderRadius: 9999,
                background: "transparent", border: "1px solid var(--border)",
                fontSize: 12, fontWeight: 500, color: "var(--text-2)", cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s, background 0.15s",
              }}
            >
              <Icon size={11} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
