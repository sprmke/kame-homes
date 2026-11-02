/**
 * Edge Sentry client tests. No network: `fetch` is stubbed so the envelope is inspected
 * rather than delivered, and a missing DSN means every path must no-op.
 */

import {
  assert,
  assertEquals,
  assertNotEquals,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  captureSentryException,
  captureSentryMessage,
  resetSentryDsnCacheForTests,
} from './sentry.ts';

const DSN = 'https://publickey@o1.ingest.us.sentry.io/4512354438021120';

type Captured = { url: string; body: string };

let captured: Captured[] = [];
const originalFetch = globalThis.fetch;

function stubEnv(vars: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
}

function stubFetch(impl?: () => Promise<Response>): void {
  globalThis.fetch = ((
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    captured.push({ url: String(input), body: String(init?.body ?? '') });
    return impl ? impl() : Promise.resolve(new Response('{"id":"e"}', { status: 200 }));
  }) as typeof fetch;
}

function parseEvent(body: string): Record<string, unknown> {
  const lines = body.split('\n').filter((line) => line.trim());
  // envelope header, item header, payload
  return JSON.parse(lines[2]!) as Record<string, unknown>;
}

function resetCaptureEnv(): void {
  captured = [];
  stubFetch();
  stubEnv({
    SENTRY_DSN: DSN,
    APP_RELEASE: 'abc123',
    ENVIRONMENT: 'preview',
    SENTRY_SAMPLE_RATE_WARNING: '1',
  });
  resetSentryDsnCacheForTests();
}

function restoreEnv(): void {
  globalThis.fetch = originalFetch;
  stubEnv({ SENTRY_DSN: undefined, APP_RELEASE: undefined, ENVIRONMENT: undefined });
  resetSentryDsnCacheForTests();
}

Deno.test('posts an envelope with release, environment and fn tag', async () => {
  resetCaptureEnv();
  try {
    await captureSentryException(new Error('booking exploded'), {
      logPrefix: 'submit-form',
      requestId: 'req-1',
      url: 'https://x.test/submit-form?token=secret&tab=1',
      method: 'POST',
      userAgent: 'Mozilla/5.0',
    });

    assertEquals(captured.length, 1);
    assertEquals(
      captured[0]!.url,
      'https://o1.ingest.us.sentry.io/api/4512354438021120/envelope/'
    );

    const event = parseEvent(captured[0]!.body);
    assertEquals(event.release, 'abc123');
    assertEquals(event.environment, 'preview');
    assertEquals(event.level, 'error');
    assertEquals(event.logger, 'submit-form');
    const tags = event.tags as Record<string, string>;
    assertEquals(tags.fn, 'submit-form');
    assertEquals(tags.request_id, 'req-1');
  } finally {
    restoreEnv();
  }
});

Deno.test('scrubs capability-token query values out of the request url', async () => {
  resetCaptureEnv();
  try {
    await captureSentryException(new Error('nope'), {
      logPrefix: 'get-form',
      url: 'https://x.test/form?access=aaa&complete=bbb&tab=dates',
    });

    const url = (parseEvent(captured[0]!.body).request as { url: string }).url;
    assertEquals(url.includes('access='), false);
    assertEquals(url.includes('complete='), false);
    assert(url.includes('tab=dates'));
  } finally {
    restoreEnv();
  }
});

Deno.test('carries the user id and no email', async () => {
  resetCaptureEnv();
  try {
    await captureSentryException(new Error('nope'), { logPrefix: 'fn', userId: 'user-1' });
    assertEquals(parseEvent(captured[0]!.body).user, { id: 'user-1' });
  } finally {
    restoreEnv();
  }
});

Deno.test('links a browser trace when the header is well formed', async () => {
  resetCaptureEnv();
  try {
    const traceId = 'a'.repeat(32);
    const spanId = 'b'.repeat(16);
    await captureSentryException(new Error('nope'), {
      logPrefix: 'fn',
      traceHeader: `${traceId}-${spanId}-1`,
    });

    const trace = (parseEvent(captured[0]!.body).contexts as { trace: Record<string, string> })
      .trace;
    assertEquals(trace.trace_id, traceId);
    assertEquals(trace.span_id, spanId);
  } finally {
    restoreEnv();
  }
});

Deno.test('ignores a malformed trace header instead of guessing', async () => {
  resetCaptureEnv();
  try {
    await captureSentryException(new Error('nope'), { logPrefix: 'fn', traceHeader: 'garbage' });
    assertEquals(parseEvent(captured[0]!.body).contexts, undefined);
  } finally {
    restoreEnv();
  }
});

Deno.test('drops denied keys from extra', async () => {
  resetCaptureEnv();
  try {
    await captureSentryException(new Error('nope'), {
      logPrefix: 'fn',
      extra: { email: 'a@b.com', orgId: 'org-1', token: 'secret' },
    });
    assertEquals(parseEvent(captured[0]!.body).extra, { orgId: 'org-1' });
  } finally {
    restoreEnv();
  }
});

Deno.test('dedupes the same fingerprint and message inside the window', async () => {
  resetCaptureEnv();
  try {
    const options = { logPrefix: 'fn', fingerprint: ['edge', 'x'] };
    await captureSentryException(new Error('same'), options);
    await captureSentryException(new Error('same'), options);
    assertEquals(captured.length, 1);
  } finally {
    restoreEnv();
  }
});

Deno.test('caps events per isolate per minute', async () => {
  resetCaptureEnv();
  try {
    for (let i = 0; i < 40; i += 1) {
      // Distinct messages so dedupe does not mask the cap.
      await captureSentryException(new Error(`distinct-${i}`), { logPrefix: 'fn' });
    }
    assertEquals(captured.length, 30);
  } finally {
    restoreEnv();
  }
});

Deno.test('samples warnings at the configured rate', async () => {
  resetCaptureEnv();
  try {
    stubEnv({ SENTRY_SAMPLE_RATE_WARNING: '0' });
    resetSentryDsnCacheForTests();
    await captureSentryMessage('degraded', { logPrefix: 'fn', fingerprint: ['w'] });
    assertEquals(captured.length, 0);

    stubEnv({ SENTRY_SAMPLE_RATE_WARNING: '1' });
    resetSentryDsnCacheForTests();
    await captureSentryMessage('degraded', { logPrefix: 'fn', fingerprint: ['w'] });
    assertEquals(captured.length, 1);
    assertEquals(parseEvent(captured[0]!.body).level, 'warning');
  } finally {
    restoreEnv();
  }
});

Deno.test('never sends info-level events', async () => {
  resetCaptureEnv();
  try {
    await captureSentryMessage('just info', { logPrefix: 'fn', level: 'info' });
    assertEquals(captured.length, 0);
  } finally {
    restoreEnv();
  }
});

Deno.test('no-ops without a DSN', async () => {
  resetCaptureEnv();
  try {
    stubEnv({ SENTRY_DSN: undefined });
    resetSentryDsnCacheForTests();
    await captureSentryException(new Error('ignored'), { logPrefix: 'fn' });
    assertEquals(captured.length, 0);
  } finally {
    restoreEnv();
  }
});

Deno.test('swallows a network failure', async () => {
  resetCaptureEnv();
  try {
    stubFetch(() => Promise.reject(new Error('offline')));
    await captureSentryException(new Error('boom'), { logPrefix: 'fn' });
  } finally {
    restoreEnv();
  }
});

Deno.test('swallows a non-ok response', async () => {
  resetCaptureEnv();
  try {
    stubFetch(() => Promise.resolve(new Response('nope', { status: 500 })));
    await captureSentryException(new Error('boom'), { logPrefix: 'fn' });
  } finally {
    restoreEnv();
  }
});

Deno.test('accepts a non-Error throw', async () => {
  resetCaptureEnv();
  try {
    await captureSentryException('a string', { logPrefix: 'fn' });
    assertNotEquals(parseEvent(captured[0]!.body).exception, undefined);
  } finally {
    restoreEnv();
  }
});

// ─────────────── environment resolution ───────────────
// A deployed dev project used to report `local`, which made a laptop and the server
// indistinguishable and hid every edge event from an environment-scoped alert rule.

function captureEnvironment(): Promise<string | undefined> {
  return captureSentryException(new Error('env probe'), { logPrefix: 'env-probe' }).then(() => {
    const event = parseEvent(captured[captured.length - 1]!.body);
    return event.environment as string | undefined;
  });
}

Deno.test('ENVIRONMENT=development on a deployed project reports preview', async () => {
  resetCaptureEnv();
  try {
    stubEnv({
      ENVIRONMENT: 'development',
      SUPABASE_URL: 'https://fworvijbrwpyngycotbz.supabase.co',
      DENO_DEPLOYMENT_ID: undefined,
    });
    resetSentryDsnCacheForTests();
    assertEquals(await captureEnvironment(), 'preview');
  } finally {
    restoreEnv();
  }
});

Deno.test('ENVIRONMENT=development locally still reports local', async () => {
  resetCaptureEnv();
  try {
    stubEnv({
      ENVIRONMENT: 'development',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      DENO_DEPLOYMENT_ID: undefined,
    });
    resetSentryDsnCacheForTests();
    assertEquals(await captureEnvironment(), 'local');
  } finally {
    restoreEnv();
  }
});

Deno.test('ENVIRONMENT=production wins regardless of runtime', async () => {
  resetCaptureEnv();
  try {
    stubEnv({ ENVIRONMENT: 'production', SUPABASE_URL: 'http://127.0.0.1:54321' });
    resetSentryDsnCacheForTests();
    assertEquals(await captureEnvironment(), 'production');
  } finally {
    restoreEnv();
  }
});
