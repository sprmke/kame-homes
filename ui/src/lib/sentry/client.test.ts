import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `client.ts` reads `VITE_SENTRY_DSN` at module scope, so each case needs a fresh
 * module instance with the env already stubbed — hence `resetModules` + dynamic import
 * rather than a top-level import.
 */
async function loadWithDsn(dsn: string | undefined) {
  vi.resetModules();
  vi.stubEnv('VITE_SENTRY_DSN', dsn ?? '');
  return await import('./client');
}

function stubFetch(): { calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(new Response('', { status: 200 }));
  });
  return { calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('browser sentry client', () => {
  // The state this ships in until the DSN is configured.
  it('is disabled and sends nothing when no DSN is set', async () => {
    const { calls } = stubFetch();
    const { captureSentryException, isSentryEnabled } = await loadWithDsn(undefined);
    expect(isSentryEnabled).toBe(false);
    captureSentryException(new Error('boom'));
    expect(calls).toHaveLength(0);
  });

  it('stays disabled on a malformed DSN instead of throwing', async () => {
    const { calls } = stubFetch();
    const { captureSentryException, isSentryEnabled } = await loadWithDsn('not-a-url');
    expect(isSentryEnabled).toBe(false);
    expect(() => captureSentryException(new Error('boom'))).not.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('posts an envelope to the derived ingest URL with auth', async () => {
    const { calls } = stubFetch();
    const { captureSentryException, isSentryEnabled } = await loadWithDsn(
      'https://pubkey@o9.ingest.sentry.io/1234'
    );
    expect(isSentryEnabled).toBe(true);

    captureSentryException(new Error('boom'));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://o9.ingest.sentry.io/api/1234/envelope/');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-Sentry-Auth']).toContain('sentry_key=pubkey');
    expect(calls[0].init.keepalive).toBe(true);
  });

  it('declares payload byte length, not String.length', async () => {
    const { calls } = stubFetch();
    const { captureSentryException } = await loadWithDsn('https://k@o1.ingest.sentry.io/1');

    captureSentryException(new Error('naïve café 日本'));

    const [, itemHeader, payload] = String(calls[0].init.body).split('\n');
    const declared = JSON.parse(itemHeader).length as number;
    expect(declared).toBe(new TextEncoder().encode(payload).length);
  });

  it('never throws when the transport fails', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const { captureSentryException } = await loadWithDsn('https://k@o1.ingest.sentry.io/1');
    expect(() => captureSentryException(new Error('boom'))).not.toThrow();
  });

  it('reports a non-Error throw', async () => {
    const { calls } = stubFetch();
    const { captureSentryException } = await loadWithDsn('https://k@o1.ingest.sentry.io/1');

    captureSentryException('plain string failure');

    expect(String(calls[0].init.body)).toContain('plain string failure');
  });
});
