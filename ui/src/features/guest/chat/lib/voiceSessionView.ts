import type { ReceptionistAvatarState } from '@/features/guest/chat/components/voice/receptionistAvatarTypes';

import type { VoiceSessionPhase } from './voiceSessionState';

/** What the booth shows. Derived from phase + local VAD + tool state, then held by a dwell. */
export type VoiceSessionView =
  | 'idle'
  | 'connecting'
  | 'reconnecting'
  | 'listening'
  | 'user_speaking'
  | 'thinking'
  | 'looking_up'
  | 'speaking'
  | 'ending'
  | 'ended'
  | 'error';

/** Shortest time a view stays on screen, so one-frame flips never reach the guest. */
export const VOICE_VIEW_MIN_DWELL_MS = 320;

export function deriveVoiceSessionView(input: {
  phase: VoiceSessionPhase;
  userSpeaking: boolean;
  toolPending: boolean;
}): VoiceSessionView {
  const { phase, userSpeaking, toolPending } = input;
  switch (phase) {
    case 'idle':
    case 'connecting':
    case 'reconnecting':
    case 'ending':
    case 'ended':
    case 'error':
      return phase;
    case 'speaking':
      return userSpeaking ? 'user_speaking' : 'speaking';
    case 'thinking':
      if (toolPending) return 'looking_up';
      return userSpeaking ? 'user_speaking' : 'thinking';
    case 'listening':
      return userSpeaking ? 'user_speaking' : 'listening';
  }
}

/** Views that must show immediately: the avatar mouth tracks audio, and call end is final. */
export function isUrgentVoiceView(view: VoiceSessionView): boolean {
  return view === 'speaking' || view === 'ending' || view === 'ended' || view === 'error';
}

export const VOICE_VIEW_LABEL: Record<VoiceSessionView, string> = {
  idle: '',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  listening: 'Listening',
  user_speaking: "You're speaking",
  thinking: 'Thinking…',
  looking_up: 'Looking that up…',
  speaking: 'Speaking',
  ending: 'Ending call…',
  ended: 'Call ended',
  error: 'Connection issue',
};

export function voiceViewAvatarState(view: VoiceSessionView): ReceptionistAvatarState {
  switch (view) {
    case 'connecting':
    case 'reconnecting':
      return 'connecting';
    case 'listening':
    case 'user_speaking':
      return 'listening';
    case 'thinking':
    case 'looking_up':
      return 'thinking';
    case 'speaking':
      return 'speaking';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

/** Orbiting ring arc while the guest is waiting on something. */
export function isBusyVoiceView(view: VoiceSessionView): boolean {
  return (
    view === 'connecting' ||
    view === 'reconnecting' ||
    view === 'thinking' ||
    view === 'looking_up' ||
    view === 'ending'
  );
}

/** Level bars are visible while there is live audio to show. */
export function showsVoiceLevel(view: VoiceSessionView): boolean {
  return view === 'listening' || view === 'user_speaking' || view === 'speaking';
}
