"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// How long to wait after the last interim result before treating the
// utterance as finished. Browsers don't reliably fire "speech ended", so a
// silence timer is the only practical signal — it's the one place in the
// whole voice flow where a timer is used instead of a real event, and it
// only decides *when to stop listening*, never the avatar's visual state.
const SILENCE_TIMEOUT_MS = 1300;

// Grace period to start talking after the mic opens (e.g. right after Guaca
// finishes speaking, in hands-free mode). Reuses the same timer ref as
// SILENCE_TIMEOUT_MS: onresult below shortens it the moment real speech
// shows up. Without this, silent air time (user walked away, decided not to
// reply) would leave the mic open forever — "continuous" is not the same as
// "never" listening.
const NO_SPEECH_TIMEOUT_MS = 6000;

export type MicStatus = "idle" | "recording" | "transcribing";

interface UseSpeechRecognitionOptions {
  /** Called once per session with the final transcript (non-empty). */
  onFinal: (transcript: string) => void;
  /** Called once per session when it ends with nothing to send (silence, error, permission denied). */
  onCancelled: (reason?: string) => void;
}

interface UseSpeechRecognitionReturn {
  /** Live text-so-far while the user is talking (native API only). */
  interimTranscript: string;
  micStatus: MicStatus;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  isSupported: boolean;
}

export function useSpeechRecognition(
  { onFinal, onCancelled }: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn {
  const [interimTranscript, setInterimTranscript] = useState("");
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [useNativeApi, setUseNativeApi] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalPartsRef = useRef<string[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionEndedRef = useRef(true); // guards against double onFinal/onCancelled per session

  // Keep latest callbacks without re-subscribing recognition listeners
  const onFinalRef = useRef(onFinal);
  const onCancelledRef = useRef(onCancelled);
  onFinalRef.current = onFinal;
  onCancelledRef.current = onCancelled;

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // Single source of truth for "this session is over" — called from the real
  // recognition.onend/onerror events, but also directly by the watchdog below
  // for when those events never fire at all (observed in practice: a stalled
  // network path to the browser's speech-recognition backend can leave a
  // continuous session running with no further events, ever — .stop() alone
  // doesn't guarantee onend fires). Idempotent via sessionEndedRef.
  const forceFinalize = useCallback((reason?: string) => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    clearSilenceTimer();
    setMicStatus("idle");
    setInterimTranscript("");

    const text = finalPartsRef.current.join(" ").trim();
    finalPartsRef.current = [];
    if (text) onFinalRef.current(text);
    else onCancelledRef.current(reason);
  }, []);

  // Asks the recognizer to stop and guarantees the session actually ends
  // within a bounded time even if the underlying browser API hangs and never
  // fires onend/onerror — without this, a stuck session leaves the mic
  // button permanently stuck on "Detener" with no way to recover.
  const requestStop = useCallback(
    (reason?: string) => {
      recognitionRef.current?.stop();
      setTimeout(() => forceFinalize(reason), 1500);
    },
    [forceFinalize]
  );

  // Detect capabilities once mounted (SSR-safe)
  useEffect(() => {
    const hasNativeApi =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    const hasMediaRecorder =
      "MediaRecorder" in window && "mediaDevices" in navigator;

    setUseNativeApi(hasNativeApi);
    setIsSupported(hasNativeApi || hasMediaRecorder);
  }, []);

  // Setup native Web Speech API (Chrome / Edge / Safari)
  useEffect(() => {
    if (!useNativeApi) return;

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "es-CO";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalPartsRef.current.push(result[0].transcript.trim());
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimTranscript([...finalPartsRef.current, interim].join(" ").trim());

      // Any new speech resets the "did the user stop talking?" timer.
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => requestStop(), SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(`Error de reconocimiento: ${event.error}`);
      forceFinalize(event.error);
    };

    recognition.onend = () => {
      forceFinalize();
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      recognition.abort();
    };
  }, [useNativeApi, requestStop, forceFinalize]);

  const startListening = useCallback(async () => {
    setError(null);
    setInterimTranscript("");
    finalPartsRef.current = [];
    sessionEndedRef.current = false;

    if (useNativeApi && recognitionRef.current) {
      setMicStatus("recording");
      try {
        recognitionRef.current.start();
      } catch (err) {
        // start() throws InvalidStateError if a session is already active —
        // harmless, one is already running so the timer below still applies.
        // Anything else is a real failure (e.g. no capture device): surface
        // it and bail instead of leaving the UI stuck in "recording" forever
        // with no listener ever going to fire onend/onerror to unstick it.
        if (!(err instanceof DOMException && err.name === "InvalidStateError")) {
          setMicStatus("idle");
          setError("No se pudo iniciar el reconocimiento de voz.");
          sessionEndedRef.current = true;
          onCancelledRef.current("start-failed");
          return;
        }
      }
      // Grace period to start talking, whether this call just started a
      // fresh session or one was already active — always reachable so a
      // session can never be left listening with no way out.
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => requestStop("no-speech"), NO_SPEECH_TIMEOUT_MS);
    } else {
      // ── MediaRecorder fallback (Firefox and others) ──────────────────────
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

          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size === 0) {
            setMicStatus("idle");
            sessionEndedRef.current = true;
            onCancelledRef.current("empty-recording");
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
            else onCancelledRef.current("no-speech");
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
      } catch (err) {
        console.error("Error accediendo al micrófono:", err);
        setError("No se pudo acceder al micrófono. Verifica los permisos.");
        setMicStatus("idle");
        sessionEndedRef.current = true;
        onCancelledRef.current("permission-denied");
      }
    }
  }, [useNativeApi, requestStop]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (useNativeApi && recognitionRef.current) {
      requestStop();
    } else if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, [useNativeApi, requestStop]);

  return {
    interimTranscript,
    micStatus,
    startListening,
    stopListening,
    error,
    isSupported,
  };
}
