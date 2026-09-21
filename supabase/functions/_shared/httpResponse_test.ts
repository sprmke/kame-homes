import {
  badRequest,
  EdgeError,
  errorMessageFromThrown,
  internalError,
  statusConflict,
} from './httpResponse.ts';

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
