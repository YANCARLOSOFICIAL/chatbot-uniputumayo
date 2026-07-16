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
const BATCH_MIN_CHARS = 110;

interface QueueItem {
  blobPromise: Promise<Blob | null>;
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
      audio.play().catch(() => {
        cleanup();
        resolve();
      });
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
  }, [playItem]);

  const enqueueSentence = useCallback(
    (text: string) => {
      if (!activeRef.current) return;
      const blobPromise = fetch(`${API_BASE}/api/v1/audio/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: TTS_VOICE }),
      })
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => {
          onErrorRef.current?.("Error generando audio de voz.");
          return null;
        });

      queueRef.current.push({ blobPromise });
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
    stopAmplitudeLoop();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, amplitude, beginResponse, enqueueDelta, flush, stop };
}
