import { captureSentryException, resetSentryDsnCacheForTests } from './sentry.ts';

const DSN = 'https://abc123@o1.ingest.sentry.io/456';

type Captured = { url: string; init: RequestInit };

/** Swaps globalThis.fetch, returning what was sent plus a restore fn. */
function stubFetch(status = 200): { sent: Captured[]; restore: () => void } {
  const sent: Captured[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(new Response('', { status }));
  }) as typeof fetch;
  return {
    sent,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function withDsn(value: string | null, run: () => Promise<void>): Promise<void> {
  const previous = Deno.env.get('SENTRY_DSN');
  if (value === null) Deno.env.delete('SENTRY_DSN');
  else Deno.env.set('SENTRY_DSN', value);
  resetSentryDsnCacheForTests();
  return run().finally(() => {
    if (previous === undefined) Deno.env.delete('SENTRY_DSN');
    else Deno.env.set('SENTRY_DSN', previous);
    resetSentryDsnCacheForTests();
  });
}

// The state this ships in: no DSN set. It must cost nothing and reach nobody.
Deno.test('no DSN configured sends nothing', async () => {
  await withDsn(null, async () => {
    const { sent, restore } = stubFetch();
    try {
      await captureSentryException(new Error('boom'), { logPrefix: 'test-fn' });
      if (sent.length !== 0) throw new Error(`expected no request, got ${sent.length}`);
    } finally {
      restore();
    }
  });
});

Deno.test('a malformed DSN disables Sentry rather than throwing', async () => {
  await withDsn('not-a-url', async () => {
    const { sent, restore } = stubFetch();
    try {
      await captureSentryException(new Error('boom'), { logPrefix: 'test-fn' });
      if (sent.length !== 0) throw new Error('expected no request for malformed DSN');
    } finally {
      restore();
    }
  });
});

Deno.test('a DSN without a project id is rejected', async () => {
  await withDsn('https://key@o1.ingest.sentry.io/', async () => {
    const { sent, restore } = stubFetch();
    try {
      await captureSentryException(new Error('boom'), { logPrefix: 'test-fn' });
      if (sent.length !== 0) throw new Error('expected no request without project id');
    } finally {
      restore();
    }
  });
});

Deno.test('posts an envelope to the derived ingest URL with auth', async () => {
  await withDsn(DSN, async () => {
    const { sent, restore } = stubFetch();
    try {
      await captureSentryException(new Error('boom'), { logPrefix: 'test-fn' });
      if (sent.length !== 1) throw new Error(`expected 1 request, got ${sent.length}`);
      const [{ url, init }] = sent;
      if (url !== 'https://o1.ingest.sentry.io/api/456/envelope/') {
        throw new Error(`unexpected ingest url: ${url}`);
      }
      const auth = (init.headers as Record<string, string>)['X-Sentry-Auth'] ?? '';
      if (!auth.includes('sentry_key=abc123')) {
        throw new Error(`auth header missing key: ${auth}`);
      }
    } finally {
      restore();
    }
  });
});

Deno.test('envelope declares the payload byte length, not String.length', async () => {
  await withDsn(DSN, async () => {
    const { sent, restore } = stubFetch();
    try {
      // Non-ASCII: byte length exceeds String.length, so a naive count desyncs.
      await captureSentryException(new Error('naïve café 日本'), { logPrefix: 'test-fn' });
      const body = String(sent[0].init.body);
      const [, itemHeader, payload] = body.split('\n');
      const declared = JSON.parse(itemHeader).length as number;
      const actual = new TextEncoder().encode(payload).length;
      if (declared !== actual) {
        throw new Error(`declared ${declared} bytes, payload is ${actual}`);
      }
    } finally {
      restore();
    }
  });
});

Deno.test('PII in extra is stripped by the shared denylist', async () => {
  await withDsn(DSN, async () => {
    const { sent, restore } = stubFetch();
    try {
      await captureSentryException(new Error('boom'), {
        logPrefix: 'test-fn',
        extra: {
          status: 500,
          email: 'guest@example.com',
          phone: '+639171234567',
          access_token: 'secret-value',
          bookingId: 'abc-123',
        },
      });
      const body = String(sent[0].init.body);
      for (const leaked of ['guest@example.com', '+639171234567', 'secret-value']) {
        if (body.includes(leaked)) throw new Error(`leaked PII: ${leaked}`);
      }
      // Identifiers are what makes the alert actionable — they must survive.
      if (!body.includes('abc-123')) throw new Error('bookingId was stripped');
    } finally {
      restore();
    }
  });
});

Deno.test('a non-Error throw is still reported', async () => {
  await withDsn(DSN, async () => {
    const { sent, restore } = stubFetch();
    try {
      await captureSentryException('plain string failure', { logPrefix: 'test-fn' });
      if (sent.length !== 1) throw new Error('expected non-Error throw to be captured');
      const payload = String(sent[0].init.body).split('\n')[2];
      if (!payload.includes('plain string failure')) {
        throw new Error('message missing from payload');
      }
    } finally {
      restore();
    }
  });
});

// Telemetry must never turn a working request into a failed one.
Deno.test('a failing transport does not throw to the caller', async () => {
  await withDsn(DSN, async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;
    try {
      await captureSentryException(new Error('boom'), { logPrefix: 'test-fn' });
    } finally {
      globalThis.fetch = original;
    }
  });
});

Deno.test('a non-2xx ingest response does not throw to the caller', async () => {
  await withDsn(DSN, async () => {
    const { restore } = stubFetch(429);
    try {
      await captureSentryException(new Error('boom'), { logPrefix: 'test-fn' });
    } finally {
      restore();
    }
  });
});
