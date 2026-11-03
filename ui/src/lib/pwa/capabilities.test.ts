import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPwaCapabilities, isIos, isSafari, isStandalone } from '@/lib/pwa/capabilities';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isStandalone', () => {
  it('is false in a browser tab', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      navigator: { userAgent: '', standalone: false },
    });
    expect(isStandalone()).toBe(false);
  });

  it('detects display-mode standalone', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query === '(display-mode: standalone)' }),
      navigator: {},
    });
    expect(isStandalone()).toBe(true);
  });

  it('detects iOS navigator.standalone', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true },
    });
    expect(isStandalone()).toBe(true);
  });

  it('is false without a window (SSR / node)', () => {
    vi.stubGlobal('window', undefined);
    expect(isStandalone()).toBe(false);
  });
});

describe('isIos', () => {
  it('detects iPhone', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    expect(isIos()).toBe(true);
  });

  it('detects iPadOS reporting as macOS', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(isIos()).toBe(true);
  });

  it('is false on a real Mac', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    expect(isIos()).toBe(false);
  });
});

describe('isSafari', () => {
  it('accepts iOS Safari', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    expect(isSafari()).toBe(true);
  });

  it('rejects iOS Chrome', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
    });
    expect(isSafari()).toBe(false);
  });
});

describe('getPwaCapabilities', () => {
  it('reports what the runtime actually supports', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      onbeforeinstallprompt: undefined,
      Notification: {},
      PushManager: class {},
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0',
      serviceWorker: {},
      setAppBadge: () => {},
      share: () => {},
      canShare: () => true,
      storage: { persist: () => {}, estimate: () => {} },
    });
    vi.stubGlobal('ServiceWorkerRegistration', class {});

    const caps = getPwaCapabilities();
    expect(caps.serviceWorker).toBe(true);
    expect(caps.push).toBe(true);
    expect(caps.notifications).toBe(true);
    expect(caps.badging).toBe(true);
    expect(caps.share).toBe(true);
    expect(caps.shareFiles).toBe(true);
    expect(caps.persistentStorage).toBe(true);
    expect(caps.storageEstimate).toBe(true);
    expect(caps.backgroundSync).toBe(false);
    expect(caps.periodicSync).toBe(false);
  });

  it('reports nothing supported without a service worker', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' });
    const caps = getPwaCapabilities();
    expect(caps.serviceWorker).toBe(false);
    expect(caps.push).toBe(false);
    expect(caps.badging).toBe(false);
  });
});
