import { describe, expect, it } from 'vitest';

import { voiceSessionPhaseReducer } from './voiceSessionState';

describe('voiceSessionPhaseReducer', () => {
  it('runs the normal call lifecycle', () => {
    let phase = voiceSessionPhaseReducer('idle', { type: 'start' });
    phase = voiceSessionPhaseReducer(phase, { type: 'activity', phase: 'listening' });
    phase = voiceSessionPhaseReducer(phase, { type: 'activity', phase: 'thinking' });
    phase = voiceSessionPhaseReducer(phase, { type: 'activity', phase: 'speaking' });
    phase = voiceSessionPhaseReducer(phase, { type: 'activity', phase: 'reconnecting' });
    phase = voiceSessionPhaseReducer(phase, { type: 'activity', phase: 'listening' });
    phase = voiceSessionPhaseReducer(phase, { type: 'begin_end' });
    phase = voiceSessionPhaseReducer(phase, { type: 'end_success' });
    expect(phase).toBe('ended');
  });

  it('ignores late socket activity after ending starts', () => {
    expect(voiceSessionPhaseReducer('ending', { type: 'activity', phase: 'speaking' })).toBe(
      'ending'
    );
    expect(voiceSessionPhaseReducer('ended', { type: 'activity', phase: 'listening' })).toBe(
      'ended'
    );
  });

  it('allows an ended or failed call to restart', () => {
    expect(voiceSessionPhaseReducer('ended', { type: 'start' })).toBe('connecting');
    expect(voiceSessionPhaseReducer('error', { type: 'start' })).toBe('connecting');
  });

  it('rejects socket activity before a call starts', () => {
    expect(voiceSessionPhaseReducer('idle', { type: 'activity', phase: 'speaking' })).toBe('idle');
  });
});
