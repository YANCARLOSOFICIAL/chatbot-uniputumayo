import type { AvatarState } from "@/types/avatar";

/**
 * Every event the voice/chat flow can emit. The machine is intentionally
 * event-driven (no timers deciding avatarState) so the avatar can never end
 * up in an inconsistent state: whatever happens (success, error, cancel,
 * unmount), there is always an event that routes back to "idle".
 */
export type AvatarEvent =
  | "MIC_STARTED"
  | "SPEECH_FINAL"
  | "REQUEST_SENT"
  | "RESPONSE_DONE_NO_TTS"
  | "TTS_CHUNK_PLAYBACK_STARTED"
  | "TTS_QUEUE_DRAINED"
  | "ERROR"
  | "CANCEL"
  | "RESET";

/**
 * Pure transition table. Terminal/reset events (ERROR, CANCEL, RESET) always
 * win regardless of current state — that's what guarantees the avatar never
 * gets stuck (e.g. mic permission denied while "listening", or unmount mid
 * "speaking").
 */
export function nextAvatarState(current: AvatarState, event: AvatarEvent): AvatarState {
  switch (event) {
    case "ERROR":
    case "CANCEL":
    case "RESET":
      return "idle";

    case "MIC_STARTED":
      return "listening";

    case "SPEECH_FINAL":
    case "REQUEST_SENT":
      return "thinking";

    case "RESPONSE_DONE_NO_TTS":
      // Text-only round trip (no audio will ever play for this response) —
      // go straight back to idle instead of a fake "speaking" flash.
      return current === "thinking" ? "idle" : current;

    case "TTS_CHUNK_PLAYBACK_STARTED":
      // Only the real <audio> "playing" event may enter "speaking" —
      // this is what keeps speaking in sync with actual sound.
      return "speaking";

    case "TTS_QUEUE_DRAINED":
      return current === "speaking" ? "idle" : current;

    default:
      return current;
  }
}
