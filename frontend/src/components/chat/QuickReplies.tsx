"use client";

import { GraduationCap, ClipboardList, Coins, MapPin, Code2, Leaf } from "lucide-react";

const SUGGESTIONS = [
  { label: "Pregrados en Mocoa",      Icon: GraduationCap, query: "¿Qué pregrados ofrece UniPutumayo en la sede Mocoa?" },
  { label: "Requisitos de admisión",  Icon: ClipboardList,  query: "¿Cuáles son los requisitos de admisión para ingresar a UniPutumayo?" },
  { label: "Costos matrícula 2026",   Icon: Coins,          query: "¿Cuáles son los costos académicos y derechos de matrícula en UniPutumayo?" },
  { label: "Pensum Ing. Sistemas",    Icon: Code2,          query: "¿Cuál es el pensum de Ingeniería de Sistemas en UniPutumayo?" },
  { label: "Sedes universitarias",    Icon: MapPin,         query: "¿Cuáles son las sedes de UniPutumayo y qué programas ofrecen?" },
  { label: "Bienestar universitario", Icon: Leaf,           query: "¿Qué servicios de bienestar universitario ofrece UniPutumayo?" },
];

interface QuickRepliesProps {
  onSelect: (query: string) => void;
}

export function QuickReplies({ onSelect }: QuickRepliesProps) {
  return (
    <div className="quick-wrap">
      <div className="quick-inner">
        <div className="quick-row">
          {SUGGESTIONS.map(({ label, Icon, query }) => (
            <button key={label} onClick={() => onSelect(query)} className="quick-chip">
              <Icon size={11} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
