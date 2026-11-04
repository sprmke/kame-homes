import { describe, expect, it, vi } from 'vitest';

import {
  decideChunkRecovery,
  isChunkLoadError,
  reloadForChunkError,
} from '@/lib/chunkReload';

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

  it('matches the strict MIME and mixed-build messages browsers actually throw', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".'
        )
      )
    ).toBe(true);
    expect(
      isChunkLoadError(new SyntaxError('The requested module does not provide an export named X'))
    ).toBe(true);
    expect(isChunkLoadError(new SyntaxError("Unexpected token '<'"))).toBe(true);
  });

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(new SyntaxError('Unexpected token } in JSON at position 3'))).toBe(
      false
    );
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('decideChunkRecovery', () => {
  it('reloads first, resets the worker on a repeat, then gives up', () => {
    const first = decideChunkRecovery(null, 1_000, 'page-a');
    expect(first.action).toBe('reload');

    const second = decideChunkRecovery(first.state, 5_000, 'page-b');
    expect(second.action).toBe('reset');

    const third = decideChunkRecovery(second.state, 9_000, 'page-c');
    expect(third.action).toBe('give-up');
  });

  it('does not escalate when the same document reports the failure twice', () => {
    const first = decideChunkRecovery(null, 1_000, 'page-a');
    expect(decideChunkRecovery(first.state, 1_050, 'page-a').action).toBe('handled');
  });

  it('starts over once the window has passed', () => {
    const first = decideChunkRecovery(null, 1_000, 'page-a');
    const second = decideChunkRecovery(first.state, 5_000, 'page-b');
    const later = decideChunkRecovery(second.state, 120_000, 'page-c');
    expect(later.action).toBe('reload');
    expect(later.state.attempts).toBe(1);
  });
});

describe('reloadForChunkError', () => {
  it('reloads once per incident, then resets, then refuses', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const reset = vi.fn();

    expect(reloadForChunkError({ storage, now: 1_000, pageId: 'a', reload, reset })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();

    // After the reload a new document reports the same failure: the worker is stale.
    expect(reloadForChunkError({ storage, now: 4_000, pageId: 'b', reload, reset })).toBe(true);
    expect(reset).toHaveBeenCalledTimes(1);

    // Second document after a reset still fails: the build is broken.
    expect(reloadForChunkError({ storage, now: 7_000, pageId: 'c', reload, reset })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('does nothing while offline: a reload cannot fetch the missing chunk', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const reset = vi.fn();
    expect(
      reloadForChunkError({ storage, now: 1_000, pageId: 'a', online: false, reload, reset })
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
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

  it('resets through the injectable path instead of a bare reload', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    const reset = vi.fn();
    expect(reloadForChunkError({ storage, now: 5_000, pageId: 'a', reload })).toBe(true);
    expect(reloadForChunkError({ storage, now: 6_000, pageId: 'b', reload, reset })).toBe(true);
    expect(reset).toHaveBeenCalledWith(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('chunk-load reporting', () => {
  it('warns through reload and reset, and errors only when recovery failed', async () => {
    vi.resetModules();
    const capture = vi.fn();
    vi.doMock('@/lib/sentry/capture', () => ({ captureError: capture }));

    const { reloadForChunkError: reload } = await import('@/lib/chunkReload');
    const storage = memoryStorage();
    const fn = vi.fn();

    expect(reload({ storage, now: 5_000, pageId: 'a', reload: fn })).toBe(true);
    expect(capture.mock.calls[0]?.[1]).toMatchObject({
      level: 'warning',
      fingerprint: ['chunk_load', 'first_failure'],
    });

    expect(reload({ storage, now: 6_000, pageId: 'b', reload: fn })).toBe(true);
    expect(capture.mock.calls[1]?.[1]).toMatchObject({
      level: 'warning',
      fingerprint: ['chunk_load', 'shell_reset'],
    });

    expect(reload({ storage, now: 7_000, pageId: 'c', reload: fn })).toBe(false);
    expect(capture.mock.calls[2]?.[1]).toMatchObject({
      level: 'error',
      fingerprint: ['chunk_load', 'repeat_failure'],
    });

    vi.doUnmock('@/lib/sentry/capture');
  });
});
