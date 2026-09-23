import { describe, expect, it } from 'vitest';

import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';

describe('pwaTelemetry', () => {

  it('pwaTelemetry is exported', () => {
    expect(typeof pwaTelemetry).toBe('function');
  });

});
