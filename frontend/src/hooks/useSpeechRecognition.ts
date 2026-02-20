"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
  isSupported: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [useNativeApi, setUseNativeApi] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        setTranscript(result[0].transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(`Error de reconocimiento: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [useNativeApi]);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript("");

    if (useNativeApi && recognitionRef.current) {
      // ── Native Web Speech API (Chrome / Edge / Safari) ──────────────────
      setIsListening(true);
      recognitionRef.current.start();
    } else {
      // ── MediaRecorder fallback (Firefox and others) ──────────────────────
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunksRef.current = [];

        // Pick the best supported MIME type
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
          // Release microphone
          stream.getTracks().forEach((t) => t.stop());

          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size === 0) {
            setIsListening(false);
            return;
          }

          try {
            const formData = new FormData();
            formData.append("audio", blob, "recording.webm");

            const response = await fetch(`${API_BASE}/api/v1/audio/stt`, {
              method: "POST",
              body: formData,
            });

            if (!response.ok) throw new Error(`STT error: ${response.status}`);

            const data = await response.json();
            // Set transcript first, then clear isListening so ChatContainer
            // detects both changes and sends the message
            setTranscript(data.transcript || "");
          } catch (err) {
            console.error("Error en STT:", err);
            setError("Error transcribiendo audio. Intenta de nuevo.");
          }

          setIsListening(false);
        };

        recorder.start();
        setIsListening(true);
      } catch (err) {
        console.error("Error accediendo al micrófono:", err);
        setError("No se pudo acceder al micrófono. Verifica los permisos.");
        setIsListening(false);
      }
    }
  }, [useNativeApi]);

  const stopListening = useCallback(() => {
    if (useNativeApi && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      // onstop handler will set isListening = false after transcription
      mediaRecorderRef.current.stop();
    }
  }, [useNativeApi]);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    error,
    isSupported,
  };
}
