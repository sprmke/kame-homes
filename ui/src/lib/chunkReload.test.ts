import { describe, expect, it, vi } from 'vitest';

import { isChunkLoadError, reloadForChunkError } from '@/lib/chunkReload';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe('isChunkLoadError', () => {
  it('matches Chromium, Safari, Firefox and HTML-for-chunk messages', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/a.js'))
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(
      isChunkLoadError(new TypeError('error loading dynamically imported module: /assets/b.js'))
    ).toBe(true);
    expect(
      isChunkLoadError(
        new TypeError("'text/html' is not a valid JavaScript MIME type for module script")
      )
    ).toBe(true);
    expect(isChunkLoadError('Unable to preload CSS for /assets/c.css')).toBe(true);
  });

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('reloadForChunkError', () => {
  it('reloads once, then refuses inside the window, then allows again after it', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadForChunkError({ storage, now: 1_000_000, reload })).toBe(true);
    expect(reloadForChunkError({ storage, now: 1_005_000, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForChunkError({ storage, now: 1_011_000, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('still reloads when storage is unavailable', () => {
    const reload = vi.fn();
    expect(reloadForChunkError({ storage: null, now: 1, reload })).toBe(true);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };
    expect(reloadForChunkError({ storage: throwing, now: 2, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe('chunk-load reporting', () => {
  it('warns once on the first failure and errors when the guard trips', async () => {
    vi.resetModules();
    const capture = vi.fn();
    vi.doMock('@/lib/sentry/capture', () => ({ captureError: capture }));

    const { reloadForChunkError: reload } = await import('@/lib/chunkReload');
    const storage = memoryStorage();
    const fn = vi.fn();

    // First failure: a stale tab, so a warning, and it reloads.
    expect(reload({ storage, now: 5_000, reload: fn })).toBe(true);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      level: 'warning',
      fingerprint: ['chunk_load', 'first_failure'],
    });

    // Second failure inside the window: the new build is broken. Error, no further reload.
    expect(reload({ storage, now: 6_000, reload: fn })).toBe(false);
    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[1]?.[1]).toMatchObject({
      level: 'error',
      fingerprint: ['chunk_load', 'repeat_failure'],
    });
    expect(fn).toHaveBeenCalledTimes(1);

    vi.doUnmock('@/lib/sentry/capture');
  });
});
