"use client";

import { useEffect } from "react";
import { X, Square, Mic, AlertCircle } from "lucide-react";
import { GuacamayaAvatar, type GuacamayaState } from "./GuacamayaAvatar";
import type { MicStatus } from "@/hooks/useSpeechRecognition";

interface VoiceModeOverlayProps {
  isOpen: boolean;
  avatarState: GuacamayaState;
  interimTranscript: string;
  micStatus: MicStatus;
  amplitude: number;
  error: string | null;
  onCancel: () => void;
  /** Cuts Guaca off mid-sentence and starts listening right away — a real
   *  conversation lets you interrupt instead of waiting out the whole reply. */
  onBargeIn: () => void;
}

const STATUS_LABEL: Record<GuacamayaState, string> = {
  idle: "Listo",
  listening: "Escuchando…",
  thinking: "Pensando…",
  speaking: "Respondiendo…",
};

/** Small bar-visualizer. In "speaking" it's driven by real playback amplitude;
 *  in "listening" the native SpeechRecognition API gives no raw audio access,
 *  so bars run a gentle CSS-only pulse instead of faking a waveform. */
function AudioBars({ mode, amplitude }: { mode: "listening" | "thinking" | "speaking"; amplitude: number }) {
  const bars = 9;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, height: 36 }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const mid = (bars - 1) / 2;
        const falloff = 1 - Math.abs(i - mid) / (mid + 1);
        const height =
          mode === "speaking"
            ? 6 + Math.min(1, amplitude * 1.8) * 26 * falloff
            : mode === "thinking"
            ? 6
            : undefined;
        return (
          <span
            key={i}
            className={mode !== "speaking" ? `voice-bar voice-bar-${mode}` : undefined}
            style={{
              width: 4,
              height: height ?? undefined,
              borderRadius: 2,
              background: "var(--brand-accent)",
              display: "inline-block",
              transition: mode === "speaking" ? "height 60ms linear" : undefined,
              animationDelay: mode !== "speaking" ? `${i * 70}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function VoiceModeOverlay({
  isOpen, avatarState, interimTranscript, micStatus, amplitude, error, onCancel, onBargeIn,
}: VoiceModeOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const showTranscribing = micStatus === "transcribing";
  const label = showTranscribing ? "Transcribiendo tu voz…" : STATUS_LABEL[avatarState];
  const barsMode: "listening" | "thinking" | "speaking" =
    avatarState === "speaking" ? "speaking" : avatarState === "thinking" ? "thinking" : "listening";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo de voz"
      className="voice-overlay animate-fade-in"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        // Dramatic full-screen glass: the chat behind this overlay is visible
        // but heavily blurred, instead of a near-opaque scrim — a real "glass
        // modal over the app" moment, the best candidate on the whole site
        // for a strong Liquid Glass treatment (see redesign plan).
        background: "radial-gradient(circle at 50% 35%, rgba(11,52,71,0.62), rgba(7,24,36,0.72))",
        backdropFilter: "blur(var(--glass-blur-lg))",
        WebkitBackdropFilter: "blur(var(--glass-blur-lg))",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <button
        onClick={onCancel}
        aria-label="Cerrar modo de voz"
        className="glass-navy"
        style={{
          position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        <X size={18} strokeWidth={1.75} />
      </button>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, maxWidth: 480, width: "100%" }}>
        <GuacamayaAvatar state={avatarState} size={140} amplitude={amplitude} glow />

        <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.92)", letterSpacing: "0.01em" }}>
          {label}
        </div>

        <AudioBars mode={barsMode} amplitude={amplitude} />

        <div style={{ minHeight: 52, textAlign: "center", padding: "0 12px" }}>
          {error ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fca5a5", fontSize: 13.5 }}>
              <AlertCircle size={15} /> {error}
            </div>
          ) : (
            !showTranscribing && interimTranscript && (
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
                “{interimTranscript}”
              </p>
            )
          )}
        </div>

        {avatarState === "speaking" ? (
          <button
            onClick={onBargeIn}
            className="glass-navy"
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999,
              color: "#fff", fontSize: 13.5, fontWeight: 500, cursor: "pointer",
            }}
          >
            <Mic size={13} /> Interrumpir
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="glass-navy"
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 999,
              color: "#fff", fontSize: 13.5, fontWeight: 500, cursor: "pointer",
            }}
          >
            <Square size={12} fill="currentColor" /> Detener
          </button>
        )}
      </div>
    </div>
  );
}
