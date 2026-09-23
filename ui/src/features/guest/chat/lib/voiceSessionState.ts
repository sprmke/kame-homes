export type VoiceSessionPhase =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'reconnecting'
  | 'ending'
  | 'ended'
  | 'error';

export type VoiceSessionPhaseEvent =
  | { type: 'start' }
  | {
      type: 'activity';
      phase: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'reconnecting';
    }
  | { type: 'begin_end' }
  | { type: 'end_success' }
  | { type: 'fail' };

const ACTIVITY_TRANSITIONS: Partial<Record<VoiceSessionPhase, VoiceSessionPhase[]>> = {
  connecting: ['connecting', 'listening', 'reconnecting'],
  listening: ['listening', 'thinking', 'speaking', 'reconnecting'],
  thinking: ['listening', 'thinking', 'speaking', 'reconnecting'],
  speaking: ['listening', 'thinking', 'speaking', 'reconnecting'],
  reconnecting: ['reconnecting', 'listening'],
};

export function voiceSessionPhaseReducer(
  phase: VoiceSessionPhase,
  event: VoiceSessionPhaseEvent
): VoiceSessionPhase {
  if (event.type === 'start') {
    return phase === 'idle' || phase === 'ended' || phase === 'error' ? 'connecting' : phase;
  }
  if (event.type === 'begin_end') {
    return phase === 'ended' || phase === 'error' ? phase : 'ending';
  }
  if (event.type === 'end_success') {
    return phase === 'ending' ? 'ended' : phase;
  }
  if (event.type === 'fail') {
    return phase === 'ended' ? phase : 'error';
  }
  if (phase === 'ending' || phase === 'ended' || phase === 'error') return phase;
  return ACTIVITY_TRANSITIONS[phase]?.includes(event.phase) ? event.phase : phase;
}
