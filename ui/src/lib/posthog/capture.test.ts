import { describe, expect, it } from 'vitest';

import { captureAppEvent, captureAppException } from '@/lib/posthog/capture';

describe('captureAppEvent', () => {

  it('captureAppEvent is exported', () => {
    expect(typeof captureAppEvent).toBe('function');
  });

});

describe('captureAppException', () => {

  it('captureAppException is exported', () => {
    expect(typeof captureAppException).toBe('function');
  });

});
