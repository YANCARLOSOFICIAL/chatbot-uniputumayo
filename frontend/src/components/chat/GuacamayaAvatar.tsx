"use client";

import { useId, useMemo } from "react";

export type GuacamayaState = "idle" | "listening" | "thinking" | "speaking";

interface GuacamayaAvatarProps {
  state?: GuacamayaState;
  size?: number;
  className?: string;
  /** 0..1 real playback amplitude (from useVoicePlayback). When provided and
   *  state === "speaking", the beak opens in sync with actual audio volume
   *  instead of a fixed-interval CSS animation. */
  amplitude?: number;
  /** Soft ambient glow behind the avatar — used by the full-screen voice overlay. */
  glow?: boolean;
}

const STATE_CLASS: Record<GuacamayaState, string> = {
  idle:      "guacamaya-idle",
  listening: "guacamaya-listen",
  thinking:  "guacamaya-think",
  speaking:  "guacamaya-speak",
};

export function GuacamayaAvatar({
  state = "idle",
  size = 80,
  className = "",
  amplitude,
  glow = false,
}: GuacamayaAvatarProps) {
  // Per-instance blink offset so the header avatar and the overlay avatar
  // don't blink in perfect unison. Derived deterministically from useId()
  // (instead of Math.random()) to keep render pure.
  const uid = useId();
  const blinkDelay = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
    return `${(hash % 300) / 100}s`;
  }, [uid]);

  const isAudioReactive = state === "speaking" && typeof amplitude === "number";
  const beakScale = isAudioReactive ? 1 + Math.min(Math.max(amplitude ?? 0, 0), 1) * 1.6 : undefined;

  return (
    <div
      className={`guacamaya-avatar-wrap ${glow ? "guacamaya-glow" : ""} ${className}`}
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}
    >
      <div
        className={`guacamaya-avatar ${STATE_CLASS[state]}`}
        style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg
          viewBox="0 0 80 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          {/* ── Crest feathers ── */}
          <g className="guacamaya-crest">
            {/* Left blue feather */}
            <path d="M26 18 C22 8 23 2 27 1 C31 0 31 7 30 17" fill="#1d4ed8" />
            {/* Center yellow feather */}
            <path d="M38 15 C36 5 38 0 40 0 C42 0 44 5 42 15" fill="#F7BF00" />
            {/* Right red feather (darker tip) */}
            <path d="M50 18 C54 8 53 2 49 1 C45 0 45 7 46 17" fill="#b91c1c" />
          </g>

          {/* ── Neck / body ── */}
          <path
            d="M16 58 Q10 68 12 78 Q16 86 40 87 Q64 86 68 78 Q70 68 64 58"
            fill="#dc2626"
          />

          {/* ── Wing accent — blue ── */}
          <path d="M12 66 Q6 74 8 80 Q14 86 22 84 Q17 78 16 70 Z" fill="#1d4ed8" />
          <path d="M68 66 Q74 74 72 80 Q66 86 58 84 Q63 78 64 70 Z" fill="#1d4ed8" />

          {/* ── Wing accent — yellow band ── */}
          <path d="M12 63 Q7 70 9 75 Q16 79 22 75 Q18 70 17 64 Z" fill="#F7BF00" />
          <path d="M68 63 Q73 70 71 75 Q64 79 58 75 Q62 70 63 64 Z" fill="#F7BF00" />

          {/* ── Main head (red oval) ── */}
          <ellipse cx="40" cy="38" rx="24" ry="26" fill="#dc2626" />

          {/* ── Yellow face patch (right/beak side) ── */}
          <path
            d="M48 30 C57 31 64 36 65 43 C66 50 61 54 54 54 C48 54 43 51 42 47 C40 42 43 34 48 30 Z"
            fill="#fef9c3"
          />
          {/* Fine lines on face patch — characteristic of macaws */}
          <path d="M46 34 Q53 32 61 36" stroke="#ca8a04" strokeWidth="0.75" fill="none" opacity="0.55" />
          <path d="M45 38 Q53 36 62 39" stroke="#ca8a04" strokeWidth="0.75" fill="none" opacity="0.55" />
          <path d="M46 42 Q53 40 62 43" stroke="#ca8a04" strokeWidth="0.75" fill="none" opacity="0.55" />
          <path d="M47 46 Q53 44 60 47" stroke="#ca8a04" strokeWidth="0.75" fill="none" opacity="0.55" />

          {/* ── Eye (left side when front-facing) — blinks on a randomized loop ── */}
          <g className="guacamaya-eye" style={{ transformOrigin: "30px 36px", animationDelay: blinkDelay }}>
            {/* Sclera */}
            <circle cx="30" cy="36" r="7.5" fill="white" />
            {/* Iris */}
            <circle cx="30" cy="36" r="5.8" fill="#1c1917" />
            {/* Main shine */}
            <circle cx="27.5" cy="33.5" r="2.2" fill="white" />
            {/* Micro shine */}
            <circle cx="31" cy="35" r="0.9" fill="rgba(255,255,255,0.55)" />
          </g>

          {/* ── Upper beak (hooked, fixed) ── */}
          <path
            d="M44 43 Q49 40 56 43 Q62 46 60 54 Q58 60 51 61 Q45 61 42 56 Q40 51 44 43 Z"
            fill="#ca8a04"
          />
          {/* Beak ridge */}
          <path d="M44 43 Q51 41 59 46" stroke="#92400e" strokeWidth="0.85" fill="none" />
          {/* Nostril */}
          <circle cx="51" cy="44.5" r="1.6" fill="#92400e" opacity="0.4" />

          {/* ── Lower beak (animated for speaking) ── */}
          <g
            className={isAudioReactive ? "guacamaya-lower-beak" : "guacamaya-lower-beak guacamaya-lower-beak-cssdriven"}
            style={{
              transformOrigin: "51px 60px",
              transform: isAudioReactive ? `scaleY(${beakScale})` : undefined,
            }}
          >
            <path
              d="M43 57 Q51 58 58 55 Q59 61 55 65 Q51 68 45 64 Q42 61 43 57 Z"
              fill="#a16207"
            />
          </g>

          {/* ── Green accent on wing body ── */}
          <path d="M14 72 Q11 77 13 81 Q17 84 21 82 Q18 78 17 74 Z" fill="#65a30d" />
          <path d="M66 72 Q69 77 67 81 Q63 84 59 82 Q62 78 63 74 Z" fill="#65a30d" />
        </svg>
      </div>
    </div>
  );
}
