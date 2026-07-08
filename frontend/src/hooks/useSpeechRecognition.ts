"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// How long to wait after the last interim result before treating the
// utterance as finished. Browsers don't reliably fire "speech ended", so a
// silence timer is the only practical signal — it's the one place in the
// whole voice flow where a timer is used instead of a real event, and it
// only decides *when to stop listening*, never the avatar's visual state.
const SILENCE_TIMEOUT_MS = 1300;

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

    const finalizeSession = (reason?: string) => {
      if (sessionEndedRef.current) return; // already finalized (onerror already ran)
      sessionEndedRef.current = true;
      clearSilenceTimer();
      setMicStatus("idle");
      setInterimTranscript("");

      const text = finalPartsRef.current.join(" ").trim();
      finalPartsRef.current = [];
      if (text) onFinalRef.current(text);
      else onCancelledRef.current(reason);
    };

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
      silenceTimerRef.current = setTimeout(() => {
        recognitionRef.current?.stop();
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(`Error de reconocimiento: ${event.error}`);
      finalizeSession(event.error);
    };

    recognition.onend = () => {
      finalizeSession();
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimer();
      recognition.abort();
    };
  }, [useNativeApi]);

  const startListening = useCallback(async () => {
    setError(null);
    setInterimTranscript("");
    finalPartsRef.current = [];
    sessionEndedRef.current = false;

    if (useNativeApi && recognitionRef.current) {
      setMicStatus("recording");
      try {
        recognitionRef.current.start();
      } catch {
        // start() throws if already started — ignore, a session is already active
      }
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
  }, [useNativeApi]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (useNativeApi && recognitionRef.current) {
      recognitionRef.current.stop();
    } else if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, [useNativeApi]);

  return {
    interimTranscript,
    micStatus,
    startListening,
    stopListening,
    error,
    isSupported,
  };
}
