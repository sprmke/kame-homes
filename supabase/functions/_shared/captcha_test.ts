/**
 * Deno tests for _shared/captcha.ts — run with `deno test --allow-env` (not Bun's runner).
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 6)
 *
 * `siteverify` is stubbed via `globalThis.fetch` so no network is hit.
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { readCaptchaToken, resolveCaptchaMode, verifyCaptchaToken } from './captcha.ts';

const realFetch = globalThis.fetch;

function stubFetch(body: unknown, ok = true, status = 200) {
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as ReturnType<typeof realFetch>;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

function withEnv(vars: Record<string, string | undefined>, run: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  const done = () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  };
  const r = run();
  return r instanceof Promise ? r.finally(done) : (done(), r);
}

Deno.test('readCaptchaToken: from object, FormData, URLSearchParams', () => {
  assertEquals(readCaptchaToken({ captchaToken: 'abc' }), 'abc');
  assertEquals(readCaptchaToken({ 'cf-turnstile-response': 'xyz' }), 'xyz');
  const fd = new FormData();
  fd.set('captchaToken', 'ff');
  assertEquals(readCaptchaToken(fd), 'ff');
  assertEquals(readCaptchaToken(new URLSearchParams({ captchaToken: 'qq' })), 'qq');
  assertEquals(readCaptchaToken({}), '');
});

Deno.test('resolveCaptchaMode: explicit env wins', () =>
  withEnv({ CAPTCHA_MODE: 'monitor', TURNSTILE_SECRET_KEY: undefined }, () => {
    assertEquals(resolveCaptchaMode(), 'monitor');
  })
);

Deno.test('resolveCaptchaMode: derives disabled without a secret', () =>
  withEnv({ CAPTCHA_MODE: undefined, TURNSTILE_SECRET_KEY: undefined }, () => {
    assertEquals(resolveCaptchaMode(), 'disabled');
  })
);

Deno.test('resolveCaptchaMode: derives enforce with a secret', () =>
  withEnv({ CAPTCHA_MODE: undefined, TURNSTILE_SECRET_KEY: 'sekret' }, () => {
    assertEquals(resolveCaptchaMode(), 'enforce');
  })
);

Deno.test('verifyCaptchaToken: disabled mode always ok', async () => {
  const r = await verifyCaptchaToken('anything', { mode: 'disabled' });
  assertEquals(r.ok, true);
  assertEquals(r.outcome, 'disabled');
});

Deno.test('verifyCaptchaToken: enforce + missing token rejects', async () => {
  const r = await verifyCaptchaToken('', { mode: 'enforce' });
  assertEquals(r.ok, false);
  assertEquals(r.outcome, 'missing_token');
});

Deno.test('verifyCaptchaToken: monitor + missing token passes but flags fail', async () => {
  const r = await verifyCaptchaToken('', { mode: 'monitor' });
  assertEquals(r.ok, true);
  assertEquals(r.outcome, 'monitored_fail');
});

Deno.test(
  'verifyCaptchaToken: monitor + siteverify success → monitored_pass (never blocks)',
  async () => {
    await withEnv({ TURNSTILE_SECRET_KEY: 'sekret' }, async () => {
      stubFetch({ success: true });
      try {
        const r = await verifyCaptchaToken('tok-monitor-pass-1', {
          mode: 'monitor',
          expectedAction: 'submit-form',
        });
        assertEquals(r.ok, true);
        assertEquals(r.outcome, 'monitored_pass');
      } finally {
        restoreFetch();
      }
    });
  }
);

Deno.test(
  'verifyCaptchaToken: monitor + definitive negative → monitored_fail (still ok:true)',
  async () => {
    await withEnv({ TURNSTILE_SECRET_KEY: 'sekret' }, async () => {
      stubFetch({ success: false, 'error-codes': ['invalid-input-response'] });
      try {
        const r = await verifyCaptchaToken('tok-monitor-fail-1', { mode: 'monitor' });
        assertEquals(r.ok, true);
        assertEquals(r.outcome, 'monitored_fail');
        assertEquals(r.reason, 'siteverify_failed');
      } finally {
        restoreFetch();
      }
    });
  }
);

Deno.test('verifyCaptchaToken: enforce + siteverify success', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'sekret' }, async () => {
    stubFetch({ success: true });
    try {
      const r = await verifyCaptchaToken('tok-success-1', { mode: 'enforce' });
      assertEquals(r.ok, true);
      assertEquals(r.outcome, 'success');
    } finally {
      restoreFetch();
    }
  });
});

Deno.test('verifyCaptchaToken: enforce + definitive negative rejects', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'sekret' }, async () => {
    stubFetch({ success: false, 'error-codes': ['invalid-input-response'] });
    try {
      const r = await verifyCaptchaToken('tok-bad-1', { mode: 'enforce' });
      assertEquals(r.ok, false);
      assertEquals(r.outcome, 'rejected');
    } finally {
      restoreFetch();
    }
  });
});

Deno.test('verifyCaptchaToken: enforce + action mismatch rejects', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'sekret' }, async () => {
    stubFetch({ success: true, action: 'other-form' });
    try {
      const r = await verifyCaptchaToken('tok-action-1', {
        mode: 'enforce',
        expectedAction: 'submit-form',
      });
      assertEquals(r.ok, false);
      assertEquals(r.outcome, 'rejected');
    } finally {
      restoreFetch();
    }
  });
});

Deno.test('verifyCaptchaToken: enforce fails OPEN on siteverify 5xx', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'sekret' }, async () => {
    stubFetch({}, false, 502);
    try {
      const r = await verifyCaptchaToken('tok-5xx-1', { mode: 'enforce' });
      assertEquals(r.ok, true);
      assertEquals(r.outcome, 'provider_error');
    } finally {
      restoreFetch();
    }
  });
});

Deno.test('verifyCaptchaToken: replayed token rejected in enforce', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'sekret' }, async () => {
    stubFetch({ success: true });
    try {
      const first = await verifyCaptchaToken('tok-replay-1', { mode: 'enforce' });
      assertEquals(first.ok, true);
      const second = await verifyCaptchaToken('tok-replay-1', { mode: 'enforce' });
      assertEquals(second.ok, false);
      assertEquals(second.outcome, 'rejected');
    } finally {
      restoreFetch();
    }
  });
});
