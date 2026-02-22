"use client";

import type { SourceInfo } from "@/types/chat";

interface SourceCardProps {
  sources: SourceInfo[];
}

export function SourceCard({ sources }: SourceCardProps) {
  if (!sources.length) return null;

  return (
    <div className="flex justify-start mb-3 sm:mb-4 pl-8 sm:pl-9">
      <div className="max-w-full sm:max-w-[80%]">
        <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Fuentes consultadas
        </p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {sources.map((source) => (
            <div
              key={source.chunk_id}
              className="bg-white border border-gray-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs hover:border-[var(--primary-300)] transition-colors"
            >
              <p className="font-medium text-gray-700 truncate max-w-[160px] sm:max-w-[200px]">
                {source.document_title}
              </p>
              {source.program && (
                <p className="text-gray-500 mt-0.5 truncate max-w-[160px] sm:max-w-[200px]">
                  {source.program}
                </p>
              )}
              <p className="text-gray-400 mt-0.5 flex items-center gap-1">
                <span
                  className="inline-block w-8 h-1 rounded-full"
                  style={{
                    background: `linear-gradient(to right, var(--primary-500) ${Math.round(source.score * 100)}%, #e5e7eb ${Math.round(source.score * 100)}%)`,
                  }}
                />
                {Math.round(source.score * 100)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
