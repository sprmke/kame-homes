import { describe, expect, it } from 'vitest';

import { resolvePushSupport } from '@/lib/pwa/push';

const ready = {
  browserPush: true,
  browserServiceWorker: true,
  hasVapidKey: true,
  workerActive: true,
};

describe('resolvePushSupport', () => {
  it('is supported only when the browser can push, the key exists and the worker is active', () => {
    expect(resolvePushSupport(ready)).toEqual({ supported: true, reason: null });
  });

  it('reports the browser when PushManager or service workers are missing', () => {
    expect(resolvePushSupport({ ...ready, browserPush: false })).toEqual({
      supported: false,
      reason: 'unsupported',
    });
    expect(resolvePushSupport({ ...ready, browserServiceWorker: false })).toEqual({
      supported: false,
      reason: 'unsupported',
    });
  });

  it('reports a build without a VAPID key instead of blaming the browser', () => {
    expect(resolvePushSupport({ ...ready, hasVapidKey: false })).toEqual({
      supported: false,
      reason: 'not-configured',
    });
  });

  it('is not ready while the worker is still installing or missing', () => {
    /* The regression: this used to report supported and let the switch be clicked. */
    expect(resolvePushSupport({ ...ready, workerActive: false })).toEqual({
      supported: false,
      reason: 'not-ready',
    });
  });
});
