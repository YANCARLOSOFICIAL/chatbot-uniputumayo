"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// "[1]", "[2]"… → citas clickeables. El lookahead evita romper links markdown
// reales "[texto](url)" (que siempre llevan un "(" justo después del "]").
const CITATION_PATTERN = /\[(\d{1,2})\](?!\()/g;

function withCitationLinks(content: string): string {
  return content.replace(CITATION_PATTERN, (_match, n) => `[[${n}]](citation:${n})`);
}

interface MarkdownContentProps {
  content: string;
  onCitationClick?: (n: number) => void;
}

export function MarkdownContent({ content, onCitationClick }: MarkdownContentProps) {
  const components: Components = useMemo(() => ({
    a: ({ href, children }) => {
      if (href?.startsWith("citation:")) {
        const n = parseInt(href.slice("citation:".length), 10);
        return (
          <sup>
            <a
              href={`#source-${n}`}
              onClick={(e) => { e.preventDefault(); onCitationClick?.(n); }}
              style={{
                fontSize: 10, fontWeight: 700, color: "var(--brand-primary)",
                background: "var(--brand-dim)", borderRadius: 4,
                padding: "0 4px", marginLeft: 1, textDecoration: "none",
                cursor: "pointer",
              }}
            >
              {n}
            </a>
          </sup>
        );
      }
      return (
        <a
          href={href}
          target={href?.startsWith("http") ? "_blank" : undefined}
          rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },
  }), [onCitationClick]);

  const linked = useMemo(() => withCitationLinks(content), [content]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {linked}
    </ReactMarkdown>
  );
}
