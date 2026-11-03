import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getSwRegistration,
  setSwRegistration,
  whenSwReady,
} from '@/lib/pwa/swRegistration';

const fakeRegistration = { scope: '/' } as unknown as ServiceWorkerRegistration;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('swRegistration store', () => {
  it('publishes and returns the registration', () => {
    setSwRegistration(fakeRegistration);
    expect(getSwRegistration()).toBe(fakeRegistration);
    setSwRegistration(null);
    expect(getSwRegistration()).toBeNull();
  });

  it('resolves immediately when a registration already exists', async () => {
    setSwRegistration(fakeRegistration);
    await expect(whenSwReady()).resolves.toBe(fakeRegistration);
    setSwRegistration(null);
  });

  it('resolves as soon as the provider publishes one', async () => {
    vi.stubGlobal('navigator', { serviceWorker: {} });
    setSwRegistration(null);
    const pending = whenSwReady(1000);
    setSwRegistration(fakeRegistration);
    await expect(pending).resolves.toBe(fakeRegistration);
    setSwRegistration(null);
  });
});
