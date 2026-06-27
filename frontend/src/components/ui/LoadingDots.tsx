"use client";

const DEFAULT_DELAYS = [0, 0.12, 0.24];

interface LoadingDotsProps {
  size?: number;
  color?: string;
  delays?: number[];
}

export function LoadingDots({
  size = 5,
  color = "var(--brand-primary)",
  delays = DEFAULT_DELAYS,
}: LoadingDotsProps) {
  return (
    <>
      {delays.map((d) => (
        <span
          key={d}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            display: "inline-block",
            animation: `pulse-soft 1.2s ${d}s ease-in-out infinite`,
          }}
        />
      ))}
    </>
  );
}
