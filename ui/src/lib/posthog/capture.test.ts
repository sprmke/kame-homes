import { describe, expect, it } from 'vitest';

import { captureAppEvent } from '@/lib/posthog/capture';
import * as posthogCapture from '@/lib/posthog/capture';

describe('captureAppEvent', () => {
  it('captureAppEvent is exported', () => {
    expect(typeof captureAppEvent).toBe('function');
  });
});

describe('PostHog error channel', () => {
  it('exports no exception helper — Sentry owns faults', () => {
    // Phase P1: the exception path is gone rather than merely unused, so nothing can
    // reach for it again and quietly recreate the double-reporting this plan removed.
    expect('captureAppException' in posthogCapture).toBe(false);
  });
});
