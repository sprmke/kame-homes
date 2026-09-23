import { describe, expect, it } from 'vitest';

import { bootstrapPostHogTelemetry } from '@/lib/posthog/bootstrapTelemetry';

describe('bootstrapPostHogTelemetry', () => {

  it('bootstrapPostHogTelemetry is exported', () => {
    expect(typeof bootstrapPostHogTelemetry).toBe('function');
  });

});
