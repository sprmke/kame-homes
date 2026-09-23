export const VOICE_IDLE_TIMEOUT_MS = 45_000;

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
  if (input.phase === 'connecting' || input.phase === 'reconnecting') return false;
  return input.nowMs - input.lastActivityMs > VOICE_IDLE_TIMEOUT_MS;
}

export function shouldKeepInterruptedAssistantCaption(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed.split(/\s+/).length > 3 || /[.!?]$/.test(trimmed);
}
