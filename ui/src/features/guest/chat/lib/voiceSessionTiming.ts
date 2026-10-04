export const VOICE_IDLE_TIMEOUT_MS = 45_000;
/** Warn the guest this long into silence, before the idle timeout ends the call. */
export const VOICE_IDLE_WARNING_MS = 30_000;
/** How long the browser may stay offline mid-call before the call ends. */
export const VOICE_OFFLINE_GRACE_MS = 10_000;
/**
 * Mic packets queued on the socket beyond this (~1.5 s of 16 kHz PCM as base64 JSON) are dropped:
 * on a slow uplink, stale speech only adds lag and the provider's VAD recovers from a gap.
 */
export const VOICE_SEND_BUFFER_LIMIT_BYTES = 64 * 1024;

export function voiceReconnectDelayMs(randomValue: number): number {
  const normalized = Math.min(1, Math.max(0, randomValue));
  return 250 + Math.floor(normalized * 500);
}

export function voiceRemainingSeconds(input: {
  startedAtMs: number;
  maxSessionSeconds: number;
  nowMs: number;
}): number {
  const elapsedSeconds = Math.max(0, (input.nowMs - input.startedAtMs) / 1000);
  return Math.max(0, Math.ceil(input.maxSessionSeconds - elapsedSeconds));
}

export function hasVoiceSessionIdled(input: {
  phase: string;
  lastActivityMs: number;
  nowMs: number;
}): boolean {
  return voiceIdleStage(input) === 'idle';
}

/** `warning` after 30 s without speech, `idle` (end the call) after 45 s. */
export function voiceIdleStage(input: {
  phase: string;
  lastActivityMs: number;
  nowMs: number;
}): 'active' | 'warning' | 'idle' {
  if (input.phase !== 'listening' && input.phase !== 'thinking' && input.phase !== 'speaking') {
    return 'active';
  }
  const silentMs = input.nowMs - input.lastActivityMs;
  if (silentMs > VOICE_IDLE_TIMEOUT_MS) return 'idle';
  if (silentMs > VOICE_IDLE_WARNING_MS) return 'warning';
  return 'active';
}

export function shouldKeepInterruptedAssistantCaption(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed.split(/\s+/).length > 3 || /[.!?]$/.test(trimmed);
}
