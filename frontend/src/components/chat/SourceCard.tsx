"use client";

import type { SourceInfo } from "@/types/chat";

interface SourceCardProps {
  sources: SourceInfo[];
}

export function SourceCard({ sources }: SourceCardProps) {
  if (!sources.length) return null;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%]">
        <p className="text-xs text-gray-500 mb-2 font-medium">
          Fuentes consultadas:
        </p>
        <div className="flex flex-wrap gap-2">
          {sources.map((source) => (
            <div
              key={source.chunk_id}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs"
            >
              <p className="font-medium text-gray-700 truncate max-w-[200px]">
                {source.document_title}
              </p>
              <p className="text-gray-400 mt-0.5">
                Relevancia: {Math.round(source.score * 100)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
