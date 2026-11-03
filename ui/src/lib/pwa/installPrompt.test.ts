import { afterEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: unknown) => void;

/**
 * `installPrompt.ts` attaches its listeners at import time, so each test creates a
 * fresh window stub and re-imports the module.
 */
async function loadModule(options: { installed?: boolean } = {}) {
  const listeners = new Map<string, Listener[]>();
  const win = {
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    sessionStorage: {
      getItem: () => (options.installed ? '1' : null),
      setItem: () => {},
    },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('localStorage', win.sessionStorage);
  vi.resetModules();
  const mod = await import('@/lib/pwa/installPrompt');
  return {
    ...mod,
    fire: (type: string, event: unknown) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('install prompt capture', () => {
  it('captures beforeinstallprompt and exposes it', async () => {
    const mod = await loadModule();
    expect(mod.canPromptInstall()).toBe(false);

    mod.fire('beforeinstallprompt', {
      preventDefault: () => {},
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });

    expect(mod.canPromptInstall()).toBe(true);
  });

  it('consumes the prompt once (no double prompt)', async () => {
    const mod = await loadModule();
    const prompt = vi.fn(async () => {});
    mod.fire('beforeinstallprompt', {
      preventDefault: () => {},
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });

    await expect(mod.promptInstall()).resolves.toBe('accepted');
    await expect(mod.promptInstall()).resolves.toBe('unavailable');
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('reports a dismissal', async () => {
    const mod = await loadModule();
    mod.fire('beforeinstallprompt', {
      preventDefault: () => {},
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    await expect(mod.promptInstall()).resolves.toBe('dismissed');
  });

  it('stops offering after appinstalled', async () => {
    const mod = await loadModule();
    mod.fire('beforeinstallprompt', {
      preventDefault: () => {},
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    mod.fire('appinstalled', {});
    expect(mod.wasAppInstalled()).toBe(true);
    expect(mod.canPromptInstall()).toBe(false);
  });

  it('remembers an install from earlier in the session', async () => {
    const mod = await loadModule({ installed: true });
    expect(mod.wasAppInstalled()).toBe(true);
  });

  it('notifies subscribers when the prompt becomes available', async () => {
    const mod = await loadModule();
    const listener = vi.fn();
    mod.subscribeInstallPrompt(listener);
    mod.fire('beforeinstallprompt', {
      preventDefault: () => {},
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribes cleanly', async () => {
    const mod = await loadModule();
    const listener = vi.fn();
    const unsubscribe = mod.subscribeInstallPrompt(listener);
    unsubscribe();
    mod.fire('appinstalled', {});
    expect(listener).not.toHaveBeenCalled();
  });
});
