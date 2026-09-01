"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// How long a continuous silence has to last, after the user has started
// talking, before the turn is treated as finished and sent — this is what
// makes the mic behave like a real back-and-forth conversation (Claude/
// ChatGPT voice mode) instead of requiring a manual "Detener" tap every time.
const VAD_SILENCE_MS = 1300;

// If the user never starts talking at all within this long after the mic
// opens, give up instead of listening forever.
const VAD_NO_SPEECH_TIMEOUT_MS = 6000;

// How often to sample the microphone's audio level.
const VAD_SAMPLE_INTERVAL_MS = 100;

// Ambient noise is measured for this long right when the mic opens, before
// any speech threshold is applied — makes the "is this speech?" cutoff
// adapt to the room instead of one fixed number that's wrong half the time
// (too sensitive in a noisy room, too strict in a quiet one).
const VAD_CALIBRATION_MS = 300;

// Speech must be at least this many times louder than the measured ambient
// floor to count — plus an absolute floor so a near-silent room doesn't end
// up with a threshold near zero that picks up any tiny sound.
const VAD_SPEECH_MULTIPLIER = 2.5;
const VAD_MIN_ABSOLUTE_THRESHOLD = 0.01;

export type MicStatus = "idle" | "recording" | "transcribing";

interface UseSpeechRecognitionOptions {
  /** Called once per session with the final transcript (non-empty). */
  onFinal: (transcript: string) => void;
  /** Called once per session when it ends with nothing to send (silence, error, permission denied). */
  onCancelled: (reason?: string) => void;
}

interface UseSpeechRecognitionReturn {
  /** Always empty in this implementation — see the module docstring below
   *  for why there's no live word-by-word preview anymore. Kept in the
   *  return shape so existing consumers (VoiceModeOverlay) don't need
   *  changes; they already handle an empty string as "nothing to show". */
  interimTranscript: string;
  micStatus: MicStatus;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  isSupported: boolean;
}

/**
 * Records the user's turn with MediaRecorder and transcribes it server-side
 * (Whisper, via /api/v1/audio/stt) once they stop talking.
 *
 * Deliberately NOT built on the browser's native SpeechRecognition API,
 * unlike an earlier version of this hook. Diagnosed live 2026-08-31:
 * Chrome's implementation fires start/audiostart/soundstart/speechstart
 * normally (mic capture and its own internal voice-activity detection both
 * work) but then silently never returns a result — the channel it uses to
 * reach Google's speech backend can stall with no error event, completely
 * indistinguishable from the user for "it just does nothing". Two real,
 * reported symptoms traced back to relying on it:
 *
 * 1. Auto-stop-on-silence only existed for that native path (it reset a
 *    timer on every recognition result). Once a session silently stalled
 *    and fell back to a plain recorder, the user had to tap "Detener"
 *    manually every single time — no more auto-send.
 * 2. That fallback only started recording AFTER the ~7.5s stall was
 *    detected, so whatever the user said in that window was never
 *    captured at all — an incomplete transcript by construction, not a
 *    transcription-quality issue.
 *
 * This version records locally from the first instant the mic opens (so
 * nothing said is ever lost) and uses simple energy-based voice-activity
 * detection (Web Audio API AnalyserNode, see `startVad` below) to decide
 * when the user has stopped talking and auto-send — the same idea
 * production voice assistants use for turn-taking, just a much lighter
 * energy-threshold version, not a trained VAD model. The trade-off: no more
 * live word-by-word preview while talking (`interimTranscript` needs an
 * actual speech-to-text stream to populate, which this hook no longer
 * keeps open) — only the final transcript, once Whisper returns it. A
 * working, complete transcript that sends itself beats a live preview that
 * silently drops what you said.
 */
export function useSpeechRecognition(
  { onFinal, onCancelled }: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn {
  const [interimTranscript, setInterimTranscript] = useState("");
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Starts false for both the server render and the client's first render
  // (matching them is what hydration requires — see React 19/Next.js
  // hydration-safety convention already used elsewhere in this codebase),
  // then flips true after mount once we can actually check `window`/
  // `navigator`.
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("MediaRecorder" in window && !!navigator.mediaDevices);
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionEndedRef = useRef(true); // guards against double onFinal/onCancelled per session
  const stopVadRef = useRef<(() => void) | null>(null);
  const stopReasonRef = useRef<string | undefined>(undefined);

  // Keep latest callbacks without re-subscribing anything
  const onFinalRef = useRef(onFinal);
  const onCancelledRef = useRef(onCancelled);
  onFinalRef.current = onFinal;
  onCancelledRef.current = onCancelled;

  // Single entry point for ending the current recording, whether triggered
  // by VAD silence detection, the no-speech timeout, or the user tapping
  // "Detener" — idempotent (recorder.state check) so it's safe to call from
  // more than one of those at once.
  const stopRecorder = useCallback((reason?: string) => {
    stopVadRef.current?.();
    stopVadRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      stopReasonRef.current = reason;
      recorder.stop();
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!sessionEndedRef.current) return; // a session is already active
    setError(null);
    setInterimTranscript("");
    sessionEndedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const reason = stopReasonRef.current;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setMicStatus("idle");
          sessionEndedRef.current = true;
          onCancelledRef.current(reason ?? "empty-recording");
          return;
        }

        setMicStatus("transcribing");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const response = await fetch(`${API_BASE}/api/v1/audio/stt`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) throw new Error(`STT error: ${response.status}`);

          const data = await response.json();
          const text = (data.transcript || "").trim();
          sessionEndedRef.current = true;
          if (text) onFinalRef.current(text);
          else onCancelledRef.current(reason ?? "no-speech");
        } catch (err) {
          console.error("Error en STT:", err);
          setError("Error transcribiendo audio. Intenta de nuevo.");
          sessionEndedRef.current = true;
          onCancelledRef.current("stt-error");
        } finally {
          setMicStatus("idle");
        }
      };

      recorder.start();
      setMicStatus("recording");

      stopVadRef.current = startVad(stream, {
        onSilenceAfterSpeech: () => stopRecorder(),
        onNoSpeechTimeout: () => stopRecorder("no-speech"),
      });
    } catch (err) {
      console.error("Error accediendo al micrófono:", err);
      setError("No se pudo acceder al micrófono. Verifica los permisos.");
      setMicStatus("idle");
      sessionEndedRef.current = true;
      onCancelledRef.current("permission-denied");
    }
  }, [stopRecorder]);

  const stopListening = useCallback(() => {
    stopRecorder();
  }, [stopRecorder]);

  return {
    interimTranscript,
    micStatus,
    startListening,
    stopListening,
    error,
    isSupported,
  };
}

/**
 * Lightweight energy-based voice-activity detection over a MediaStream.
 * Calibrates a per-session noise floor from the first VAD_CALIBRATION_MS of
 * audio, then watches for: (a) the level crossing well above that floor —
 * `onSilenceAfterSpeech` can only fire after this has happened at least
 * once — and (b) VAD_SILENCE_MS of continuous quiet afterward.
 *
 * This is a simple RMS energy threshold, not a trained voice/noise
 * classifier — it can't reliably tell "the user talking" apart from other
 * sustained loud sound (music, a TV, someone else talking nearby). That's a
 * real, known limitation of this lightweight approach, not a bug; a proper
 * fix would mean a real VAD model (e.g. Silero VAD via WASM), which is a
 * meaningfully bigger dependency than this file currently has any of.
 *
 * Returns a cleanup function that tears down the audio graph and all
 * timers — always call it once the session ends, whichever way it ends.
 */
function startVad(
  stream: MediaStream,
  callbacks: { onSilenceAfterSpeech: () => void; onNoSpeechTimeout: () => void }
): () => void {
  const { onSilenceAfterSpeech, onNoSpeechTimeout } = callbacks;
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  let calibrating = true;
  const calibrationSamples: number[] = [];
  let threshold = VAD_MIN_ABSOLUTE_THRESHOLD;
  let hasSpoken = false;
  let silenceStartedAt: number | null = null;
  let done = false;

  const calibrationTimer = setTimeout(() => {
    calibrating = false;
    const floor = calibrationSamples.length
      ? calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length
      : 0;
    threshold = Math.max(floor * VAD_SPEECH_MULTIPLIER, VAD_MIN_ABSOLUTE_THRESHOLD);
  }, VAD_CALIBRATION_MS);

  const noSpeechTimer = setTimeout(() => {
    if (done) return;
    done = true;
    cleanup();
    onNoSpeechTimeout();
  }, VAD_NO_SPEECH_TIMEOUT_MS);

  const sampleInterval = setInterval(() => {
    if (done) return;
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    if (calibrating) {
      calibrationSamples.push(rms);
      return;
    }

    if (rms > threshold) {
      if (!hasSpoken) {
        hasSpoken = true;
        clearTimeout(noSpeechTimer);
      }
      silenceStartedAt = null;
    } else if (hasSpoken) {
      if (silenceStartedAt === null) {
        silenceStartedAt = Date.now();
      } else if (Date.now() - silenceStartedAt >= VAD_SILENCE_MS) {
        done = true;
        cleanup();
        onSilenceAfterSpeech();
      }
    }
  }, VAD_SAMPLE_INTERVAL_MS);

  function cleanup() {
    clearTimeout(calibrationTimer);
    clearTimeout(noSpeechTimer);
    clearInterval(sampleInterval);
    source.disconnect();
    audioContext.close().catch(() => {});
  }

  return cleanup;
}
