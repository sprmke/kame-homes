import { describe, expect, it } from 'vitest';

import { isAbortError, isInterruptedStreamError, humanizeAssistantStreamError, buildTurnProgressFromStreamEvent } from '@/features/dashboard/ai-assistant/lib/assistantStream';

describe('isAbortError', () => {

  it('isAbortError is exported', () => {
    expect(typeof isAbortError).toBe('function');
  });

});

describe('isInterruptedStreamError', () => {

  it('isInterruptedStreamError is exported', () => {
    expect(typeof isInterruptedStreamError).toBe('function');
  });

});

describe('humanizeAssistantStreamError', () => {

  it('humanizeAssistantStreamError is exported', () => {
    expect(typeof humanizeAssistantStreamError).toBe('function');
  });

});

describe('buildTurnProgressFromStreamEvent', () => {

  it('buildTurnProgressFromStreamEvent is exported', () => {
    expect(typeof buildTurnProgressFromStreamEvent).toBe('function');
  });

});
