import { describe, expect, it } from 'vitest';

import {
  hasVoiceSessionIdled,
  shouldKeepInterruptedAssistantCaption,
  voiceReconnectDelayMs,
  voiceRemainingSeconds,
} from './voiceSessionTiming';

describe('voice session timing', () => {
  it('bounds reconnect jitter', () => {
    expect(voiceReconnectDelayMs(-1)).toBe(250);
    expect(voiceReconnectDelayMs(0.5)).toBe(500);
    expect(voiceReconnectDelayMs(2)).toBe(750);
  });

  it('counts down without becoming negative', () => {
    expect(voiceRemainingSeconds({ startedAtMs: 1_000, maxSessionSeconds: 60, nowMs: 2_500 })).toBe(
      59
    );
    expect(
      voiceRemainingSeconds({ startedAtMs: 1_000, maxSessionSeconds: 60, nowMs: 70_000 })
    ).toBe(0);
  });

  it('does not idle while connecting or reconnecting', () => {
    expect(hasVoiceSessionIdled({ phase: 'reconnecting', lastActivityMs: 0, nowMs: 100_000 })).toBe(
      false
    );
    expect(hasVoiceSessionIdled({ phase: 'listening', lastActivityMs: 0, nowMs: 46_000 })).toBe(
      true
    );
  });

  it('drops short interrupted assistant fragments', () => {
    expect(shouldKeepInterruptedAssistantCaption('Is there')).toBe(false);
    expect(shouldKeepInterruptedAssistantCaption('Yes, the pool is open.')).toBe(true);
  });
});
