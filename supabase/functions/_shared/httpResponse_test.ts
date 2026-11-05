import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  badRequest,
  EdgeError,
  errorMessageFromThrown,
  handleEdgeError,
  internalError,
  requireHttpMethod,
  statusConflict,
} from './httpResponse.ts';
import { resetSentryDsnCacheForTests } from './sentry.ts';

function assertStatus(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`expected ${expected}, got ${actual}`);
  }
}

function assertMessage(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error(`unexpected message: ${actual}`);
  }
}

Deno.test('STATUS_CONFLICT maps to 409 without prefix', async () => {
  const result = await errorMessageFromThrown(
    new Error('STATUS_CONFLICT: Booking status changed. Refresh and try again.')
  );
  assertStatus(result.status, 409);
  assertMessage(result.message, 'Booking status changed. Refresh and try again.');
});

Deno.test('plain Error stays 400', async () => {
  const result = await errorMessageFromThrown(new Error('property_id is required'));
  assertStatus(result.status, 400);
  assertMessage(result.message, 'property_id is required');
});

Deno.test('EdgeError carries its declared status, message and code', async () => {
  const result = await errorMessageFromThrown(new EdgeError(403, 'Not your booking', 'forbidden'));
  assertStatus(result.status, 403);
  assertMessage(result.message, 'Not your booking');
  if (result.code !== 'forbidden') {
    throw new Error(`unexpected code: ${result.code}`);
  }
});

Deno.test('EdgeError helpers produce their documented statuses', async () => {
  assertStatus((await errorMessageFromThrown(badRequest('missing field'))).status, 400);
  assertStatus((await errorMessageFromThrown(statusConflict('stale write'))).status, 409);
  assertStatus((await errorMessageFromThrown(internalError('invariant broken'))).status, 500);
});

Deno.test('statusConflict() matches the legacy STATUS_CONFLICT string path', async () => {
  const viaHelper = await errorMessageFromThrown(statusConflict('Booking status changed.'));
  const viaLegacyString = await errorMessageFromThrown(
    new Error('STATUS_CONFLICT: Booking status changed.')
  );
  assertStatus(viaHelper.status, viaLegacyString.status);
  assertMessage(viaHelper.message, viaLegacyString.message);
});

// The bug this suite was extended for: an unexpected runtime fault used to return 400,
// which also stripped its requestId (handleEdgeError attaches one on 5xx only), leaving
// a genuine crash both mislabelled and untraceable.
Deno.test('native runtime errors are 500, not 400', async () => {
  for (const error of [
    new TypeError("Cannot read properties of undefined (reading 'id')"),
    new RangeError('Invalid array length'),
    new ReferenceError('x is not defined'),
  ]) {
    const result = await errorMessageFromThrown(error);
    assertStatus(result.status, 500);
    if (result.code !== 'runtime_error') {
      throw new Error(`unexpected code: ${result.code}`);
    }
  }
});

Deno.test('runtime error internals are not leaked to the client', async () => {
  const result = await errorMessageFromThrown(
    new TypeError("Cannot read properties of undefined (reading 'secretColumn')")
  );
  assertMessage(result.message, 'Internal server error');
});

Deno.test('non-Error throws are 500, not 400', async () => {
  for (const thrown of ['oops', 42, null, undefined, { message: 'not an Error' }]) {
    const result = await errorMessageFromThrown(thrown);
    assertStatus(result.status, 500);
    if (result.code !== 'unexpected_throw') {
      throw new Error(`unexpected code for ${String(thrown)}: ${result.code}`);
    }
  }
});

Deno.test('an Error with an empty message still yields a message', async () => {
  const result = await errorMessageFromThrown(new Error(''));
  assertStatus(result.status, 400);
  assertMessage(result.message, 'Request failed');
});

Deno.test('Response throws keep their own status and body error', async () => {
  const result = await errorMessageFromThrown(
    new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  );
  assertStatus(result.status, 403);
  assertMessage(result.message, 'Forbidden');
});

Deno.test('Response throws without a JSON body fall back to the supplied message', async () => {
  const result = await errorMessageFromThrown(
    new Response('nope', { status: 401 }),
    'Unauthorized'
  );
  assertStatus(result.status, 401);
  assertMessage(result.message, 'Unauthorized');
});

Deno.test('requireHttpMethod reports 405, not 400', async () => {
  const result = await errorMessageFromThrown(
    (() => {
      try {
        requireHttpMethod(new Request('https://x.test/fn', { method: 'HEAD' }), 'POST');
      } catch (error) {
        return error;
      }
      throw new Error('requireHttpMethod did not throw');
    })()
  );
  assertStatus(result.status, 405);
  assertMessage(result.message, 'Method HEAD not allowed');
  assertEquals(result.code, 'method_not_allowed');
});

Deno.test('requireHttpMethod accepts HEAD for a GET endpoint', () => {
  // Uptime monitors probe read endpoints with HEAD; a 405 there reads as downtime.
  requireHttpMethod(new Request('https://x.test/fn', { method: 'HEAD' }), 'GET');
});

/** Points the Sentry client at a stubbed transport and returns the captured calls. */
function stubSentry(): { calls: string[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: string[] = [];
  Deno.env.set('SENTRY_DSN', 'https://publickey@o1.ingest.us.sentry.io/4512354438021120');
  Deno.env.set('SENTRY_SAMPLE_RATE_WARNING', '1');
  resetSentryDsnCacheForTests();
  globalThis.fetch = ((input: RequestInfo | URL) => {
    calls.push(String(input));
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
      Deno.env.delete('SENTRY_DSN');
      Deno.env.delete('SENTRY_SAMPLE_RATE_WARNING');
      resetSentryDsnCacheForTests();
    },
  };
}

Deno.test('handleEdgeError does not page Sentry for a client 4xx', async () => {
  const sentry = stubSentry();
  try {
    const response = await handleEdgeError(
      new Request('https://x.test/fn', { method: 'POST' }),
      new Error('property_id is required'),
      'test-fn'
    );
    assertEquals(response.status, 400);
    assertEquals(sentry.calls.length, 0);
  } finally {
    sentry.restore();
  }
});

Deno.test('handleEdgeError still reports a genuine 500', async () => {
  const sentry = stubSentry();
  try {
    const response = await handleEdgeError(
      new Request('https://x.test/fn', { method: 'POST' }),
      new TypeError('undefined is not a function'),
      'test-fn'
    );
    assertEquals(response.status, 500);
    assertEquals(sentry.calls.length, 1);
  } finally {
    sentry.restore();
  }
});
