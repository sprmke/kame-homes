import { describe, expect, it } from 'vitest';

import {
  assistantSpring,
  messageEntranceDelay,
} from '@/features/dashboard/ai-assistant/lib/assistantMotion';

describe('assistant motion tokens', () => {
  it('keeps the spec spring values', () => {
    expect(assistantSpring.mode).toMatchObject({ stiffness: 380, damping: 36, mass: 0.9 });
    expect(assistantSpring.soft).toMatchObject({ stiffness: 260, damping: 30 });
  });

  it('staggers at most the last 4 messages by 30ms', () => {
    expect(messageEntranceDelay(0, 10)).toBe(0);
    expect(messageEntranceDelay(5, 10)).toBe(0);
    expect(messageEntranceDelay(6, 10)).toBe(0);
    expect(messageEntranceDelay(7, 10)).toBeCloseTo(0.03);
    expect(messageEntranceDelay(9, 10)).toBeCloseTo(0.09);
  });

  it('staggers small batches from the first message', () => {
    expect(messageEntranceDelay(0, 2)).toBe(0);
    expect(messageEntranceDelay(1, 2)).toBeCloseTo(0.03);
  });
});
