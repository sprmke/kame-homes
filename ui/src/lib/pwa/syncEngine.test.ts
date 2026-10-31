import { describe, expect, it } from 'vitest';

import { initSyncEngine, outboxErrorMessageFromResponseBody } from '@/lib/pwa/syncEngine';

describe('initSyncEngine', () => {
  it('initSyncEngine is exported', () => {
    expect(typeof initSyncEngine).toBe('function');
  });
});

describe('outboxErrorMessageFromResponseBody', () => {
  it('uses server error text from JSON (503 FEATURE_UNAVAILABLE)', () => {
    const message = outboxErrorMessageFromResponseBody(
      JSON.stringify({ success: false, code: 'FEATURE_UNAVAILABLE', error: 'Under maintenance' }),
      'HTTP 503'
    );
    expect(message).toBe('Under maintenance');
  });

  it('falls back when body is not JSON', () => {
    expect(outboxErrorMessageFromResponseBody('not json', 'HTTP 503')).toBe('HTTP 503');
  });
});
