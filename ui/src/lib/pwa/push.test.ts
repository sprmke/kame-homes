import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/dashboard/org/lib/edgeClient', () => ({
  callEdgeFunction: vi.fn(async () => ({ ok: true })),
}));

const { callEdgeFunction } = await import('@/features/dashboard/org/lib/edgeClient');

async function loadPush(options: { vapid?: string } = {}) {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', options.vapid ?? 'BFakeKeyForTests');
  vi.resetModules();
  return import('@/lib/pwa/push');
}

beforeEach(() => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36',
    onLine: true,
  });
  vi.stubGlobal('atob', (value: string) => Buffer.from(value, 'base64').toString('binary'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.mocked(callEdgeFunction).mockClear();
});

describe('push support detection', () => {
  it('is unsupported without a service worker', async () => {
    vi.stubGlobal('navigator', { userAgent: 'x' });
    const push = await loadPush();
    await expect(push.getPushState()).resolves.toMatchObject({ supported: false });
  });

  it('is unsupported without a VAPID key', async () => {
    vi.stubGlobal('ServiceWorkerRegistration', class {});
    vi.stubGlobal('Window', class {});
    const push = await loadPush({ vapid: '' });
    await expect(push.getPushState()).resolves.toMatchObject({ supported: false });
  });
});

describe('enablePush', () => {
  it('does nothing when permission is denied', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: async () => 'denied' });
    vi.stubGlobal('ServiceWorkerRegistration', class {});
    vi.stubGlobal('PushManager', class {});
    const push = await loadPush();
    const state = await push.enablePush();
    expect(state.subscribed).toBe(false);
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });
});

describe('disablePush', () => {
  it('unsubscribes locally and tells the server', async () => {
    const unsubscribe = vi.fn(async () => true);
    const sub = {
      endpoint: 'https://push.test/1',
      unsubscribe,
      toJSON: () => ({ endpoint: 'https://push.test/1' }),
    };
    const registration = {
      pushManager: { getSubscription: async () => sub, subscribe: async () => sub },
    };
    vi.stubGlobal('ServiceWorkerRegistration', class {});
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'granted' });

    const push = await loadPush();
    const swRegistration = await import('@/lib/pwa/swRegistration');
    swRegistration.setSwRegistration(registration as unknown as ServiceWorkerRegistration);

    await push.disablePush();
    expect(unsubscribe).toHaveBeenCalled();
    expect(callEdgeFunction).toHaveBeenCalledWith('push-unsubscribe', expect.anything());
    swRegistration.setSwRegistration(null);
  });
});
