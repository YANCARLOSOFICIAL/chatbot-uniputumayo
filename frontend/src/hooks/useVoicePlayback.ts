"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractSentences, flushRemainder } from "@/lib/sentenceSplitter";
import { sanitizeForSpeech } from "@/lib/sanitizeForSpeech";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TTS_VOICE = "es-CO-SalomeNeural";
// Sentences after the first are batched into slightly bigger utterances —
// synthesizing one sentence at a time keeps latency low for the very first
// chunk, but sounds clipped/robotic sentence after sentence since the neural
// voice loses cross-sentence prosody. By the time a batch is needed, audio
// from the previous one is already playing, so the extra wait is hidden.
// Raised from 110 to 200 (2026-10-19): one-or-two-sentence utterances still
// sounded clipped between chunks; ~200 chars (two to three sentences) keeps
// prosody across sentences while the next batch synthesizes in the
// background. The first sentence still ships alone for a fast first word.
const BATCH_MIN_CHARS = 200;

interface QueueItem {
  /** Server-synthesized audio; null when the server could not produce it. */
  blobPromise: Promise<Blob | null>;
  /** The sentence itself — spoken with the browser's own voice
   *  (speechSynthesis) when the server audio is unavailable, so voice mode
   *  degrades to a local voice instead of going silent. */
  text: string;
}

/** Pick a Spanish voice for the browser fallback, preferring Colombian /
 *  Latin American ones; null when the browser has no Spanish voice at all. */
function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const score = (v: SpeechSynthesisVoice) => {
    const l = v.lang.toLowerCase();
    if (l === "es-co") return 5;
    if (l === "es-mx" || l === "es-us" || l === "es-419") return 4;
    if (l.startsWith("es")) return 3;
    return 0;
  };
  const best = voices.filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a))[0];
  return best ?? null;
}

/** A few milliseconds of silence as a WAV data URL — played inside the user's
 *  tap on the mic to "unlock" audio playback on browsers that block
 *  programmatic play() until the element has played once from a gesture
 *  (Safari/iOS, Brave with its default autoplay shield, some Android
 *  browsers). Without it the first real TTS chunk, which arrives seconds
 *  later outside any gesture, is rejected silently and voice mode stays mute. */
function silentWavUrl(): string {
  const sampleRate = 8000;
  const samples = 80; // 10 ms
  const buffer = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

interface UseVoicePlaybackOptions {
  /** Fires exactly once per response, when the first audio chunk actually starts playing. */
  onPlaybackStarted: () => void;
  /** Fires when the queue is empty AND the SSE stream has finished (nothing more coming). */
  onQueueDrained: () => void;
  /** Fires instead of onQueueDrained if every TTS chunk in the response failed —
   *  i.e. nothing ever played. Without this, a fully-failed response would leave
   *  the avatar stuck in "thinking" forever (TTS_QUEUE_DRAINED only transitions
   *  out of "speaking"). */
  onPlaybackFailed: () => void;
  onError?: (message: string) => void;
}

interface UseVoicePlaybackReturn {
  isSpeaking: boolean;
  /** 0..1 real playback amplitude, for driving beak/mouth animation. */
  amplitude: number;
  /** Call once when a new voice response starts streaming in. */
  beginResponse: () => void;
  /** Feed each SSE token delta in. */
  enqueueDelta: (token: string) => void;
  /** Call on SSE "done" to flush whatever text is left. */
  flush: () => void;
  /** Cancel everything immediately (new voice turn started, or user backed out). */
  stop: () => void;
  /** Call from inside a user gesture (the mic tap) so later programmatic
   *  playback is allowed by autoplay-restricting browsers. */
  unlock: () => void;
}

export function useVoicePlayback(
  { onPlaybackStarted, onQueueDrained, onPlaybackFailed, onError }: UseVoicePlaybackOptions
): UseVoicePlaybackReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  const onPlaybackStartedRef = useRef(onPlaybackStarted);
  const onQueueDrainedRef = useRef(onQueueDrained);
  const onPlaybackFailedRef = useRef(onPlaybackFailed);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onPlaybackStartedRef.current = onPlaybackStarted;
    onQueueDrainedRef.current = onQueueDrained;
    onPlaybackFailedRef.current = onPlaybackFailed;
    onErrorRef.current = onError;
  });

  const bufferRef = useRef("");
  const consumedRef = useRef(0);
  const streamEndedRef = useRef(false);
  const hasFiredStartRef = useRef(false);
  const pendingRef = useRef<string[]>([]);
  const firstChunkSentRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  const advancingRef = useRef(false);
  const genRef = useRef(0); // bumped by stop() to invalidate any in-flight advance() loop
  // Guards against tokens still arriving from an in-flight SSE stream after
  // stop() was called (e.g. user hit "Detener" mid-response) — without this,
  // enqueueDelta would keep queuing new TTS chunks and "revive" playback.
  const activeRef = useRef(false);
  // One "server voice unavailable" notice per response, not one per sentence.
  const serverFailedNotifiedRef = useRef(false);
  const unlockedRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceConnectedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const resolveCurrentRef = useRef<(() => void) | null>(null);
  // The object URL of whatever's currently loaded into <audio>, so stop()
  // (barge-in, cancel) can revoke it — pause() fires neither onended nor
  // onerror, so playItem's own cleanup() never runs on a forced stop.
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      audioRef.current?.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const ensureAnalyser = () => {
    if (sourceConnectedRef.current || !audioRef.current) return;
    try {
      const AudioContextCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceConnectedRef.current = true;
    } catch {
      // Web Audio unavailable — playback still works, just no amplitude-driven animation.
    }
  };

  const startAmplitudeLoop = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = (data[i] - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      setAmplitude(Math.min(1, rms * 4));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopAmplitudeLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAmplitude(0);
  };

  const playItem = useCallback((blob: Blob, myGen: number): Promise<void> =>
    new Promise((resolve) => {
      const audio = audioRef.current;
      if (!audio || myGen !== genRef.current) {
        resolve();
        return;
      }
      resolveCurrentRef.current = resolve;
      const url = URL.createObjectURL(blob);
      currentUrlRef.current = url;
      audio.src = url;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        if (currentUrlRef.current === url) currentUrlRef.current = null;
        stopAmplitudeLoop();
        resolveCurrentRef.current = null;
      };

      audio.onplay = () => {
        ensureAnalyser();
        setIsSpeaking(true);
        startAmplitudeLoop();
        if (!hasFiredStartRef.current) {
          hasFiredStartRef.current = true;
          onPlaybackStartedRef.current();
        }
      };
      audio.onended = () => {
        cleanup();
        resolve();
      };
      audio.onerror = () => {
        cleanup();
        resolve();
      };
      audio.play().catch((err: unknown) => {
        // NotAllowedError = autoplay blocked (no user gesture "unlocked" the
        // element). Say so instead of failing silently — this was invisible
        // before: the overlay just closed with no audio and no message.
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError") {
          onErrorRef.current?.("El navegador bloqueó la reproducción de voz. Toca el micrófono de nuevo para activarla.");
        }
        cleanup();
        resolve();
      });
    }), []);

  /** Browser-voice fallback for one sentence (speechSynthesis). */
  const speakWithBrowser = useCallback((text: string, myGen: number): Promise<void> =>
    new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis || myGen !== genRef.current) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickSpanishVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "es-CO";
      utterance.rate = 1.0;
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      utterance.onstart = () => {
        setIsSpeaking(true);
        if (!hasFiredStartRef.current) {
          hasFiredStartRef.current = true;
          onPlaybackStartedRef.current();
        }
      };
      utterance.onend = done;
      utterance.onerror = done;
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        done();
      }
      // Safety net: some engines never fire onend for a cancelled utterance.
      setTimeout(done, 1000 + text.length * 120);
    }), []);

  const advance = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const myGen = genRef.current;

    (async () => {
      while (queueRef.current.length > 0 && myGen === genRef.current) {
        const item = queueRef.current.shift()!;
        const blob = await item.blobPromise;
        if (myGen !== genRef.current) break;
        if (blob) await playItem(blob, myGen);
        else await speakWithBrowser(item.text, myGen);
      }
      advancingRef.current = false;
      if (myGen === genRef.current && streamEndedRef.current && queueRef.current.length === 0) {
        setIsSpeaking(false);
        if (hasFiredStartRef.current) {
          onQueueDrainedRef.current();
        } else {
          // Every chunk in this response failed to synthesize/play — nothing
          // ever started, so there's no "speaking" state to drain out of.
          onPlaybackFailedRef.current();
        }
      }
    })();
  }, [playItem, speakWithBrowser]);

  const enqueueSentence = useCallback(
    (text: string) => {
      if (!activeRef.current) return;
      const notifyServerFailure = () => {
        if (serverFailedNotifiedRef.current) return;
        serverFailedNotifiedRef.current = true;
        onErrorRef.current?.(
          typeof window !== "undefined" && window.speechSynthesis
            ? "La voz del servidor no está disponible; usando la voz del navegador."
            : "Error generando audio de voz."
        );
      };
      const blobPromise = fetch(`${API_BASE}/api/v1/audio/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: TTS_VOICE }),
      })
        .then((r) => {
          // A 5xx used to be swallowed here (r.ok false → null → nothing
          // played, no message). Now it is reported once and the sentence
          // falls back to the browser voice.
          if (!r.ok) { notifyServerFailure(); return null; }
          return r.blob();
        })
        .catch(() => {
          notifyServerFailure();
          return null;
        });

      queueRef.current.push({ blobPromise, text });
      advance();
    },
    [advance]
  );

  const flushPending = useCallback(() => {
    if (pendingRef.current.length === 0) return;
    const combined = pendingRef.current.join(" ");
    pendingRef.current = [];
    const cleaned = sanitizeForSpeech(combined);
    if (cleaned) enqueueSentence(cleaned);
  }, [enqueueSentence]);

  // The very first sentence of a response ships alone immediately (keeps
  // time-to-first-audio low); everything after that gets batched up to
  // BATCH_MIN_CHARS per TTS call so the voice doesn't sound choppy.
  const pushSentence = useCallback(
    (s: string) => {
      pendingRef.current.push(s);
      if (!firstChunkSentRef.current) {
        firstChunkSentRef.current = true;
        flushPending();
        return;
      }
      const combinedLen = pendingRef.current.reduce((n, x) => n + x.length, 0);
      if (combinedLen >= BATCH_MIN_CHARS) flushPending();
    },
    [flushPending]
  );

  const beginResponse = useCallback(() => {
    activeRef.current = true;
    bufferRef.current = "";
    consumedRef.current = 0;
    streamEndedRef.current = false;
    hasFiredStartRef.current = false;
    pendingRef.current = [];
    firstChunkSentRef.current = false;
    serverFailedNotifiedRef.current = false;
  }, []);

  const unlock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!unlockedRef.current) {
      try {
        const url = silentWavUrl();
        audio.src = url;
        audio.play()
          .then(() => { audio.pause(); unlockedRef.current = true; })
          .catch(() => {})
          .finally(() => URL.revokeObjectURL(url));
      } catch {
        // ignore — playback will simply be attempted later as before
      }
    }
    audioCtxRef.current?.resume().catch(() => {});
    // Warm the voice list: Chrome/Android return [] until voices are loaded.
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const enqueueDelta = useCallback(
    (token: string) => {
      if (!activeRef.current) return;
      bufferRef.current += token;
      const { sentences, consumed } = extractSentences(bufferRef.current, consumedRef.current);
      consumedRef.current = consumed;
      for (const s of sentences) pushSentence(s);
    },
    [pushSentence]
  );

  const flush = useCallback(() => {
    if (!activeRef.current) return;
    streamEndedRef.current = true;
    const rest = flushRemainder(bufferRef.current, consumedRef.current);
    if (rest) {
      consumedRef.current = bufferRef.current.length;
      pendingRef.current.push(rest);
    }
    if (pendingRef.current.length > 0) {
      flushPending();
    } else {
      advance();
    }
  }, [flushPending, advance]);

  const stop = useCallback(() => {
    activeRef.current = false;
    genRef.current += 1;
    queueRef.current = [];
    pendingRef.current = [];
    streamEndedRef.current = true;
    advancingRef.current = false;
    resolveCurrentRef.current?.();
    resolveCurrentRef.current = null;
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    audioRef.current?.pause();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
    stopAmplitudeLoop();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, amplitude, beginResponse, enqueueDelta, flush, stop, unlock };
}
