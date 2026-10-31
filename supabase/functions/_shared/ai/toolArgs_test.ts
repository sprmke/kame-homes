import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import { validateToolArgs } from './toolArgs.ts';

const schema = {
  type: 'object',
  properties: {
    bookingId: { type: 'string' },
    amount: { type: 'number' },
    kinds: { type: 'array', items: { type: 'string', enum: ['gaf', 'pet'] } },
    confirm: { type: 'boolean' },
  },
  required: ['bookingId'],
};

Deno.test('validateToolArgs — accepts well-typed args and numeric strings', () => {
  const r = validateToolArgs(schema, { bookingId: 'b1', amount: '1500', kinds: ['gaf'] });
  assertEquals(r, { ok: true, args: { bookingId: 'b1', amount: 1500, kinds: ['gaf'] } });
});

Deno.test('validateToolArgs — rejects junk numbers instead of coercing to 0', () => {
  const r = validateToolArgs(schema, { bookingId: 'b1', amount: 'lots' });
  assertEquals(r.ok, false);
});

Deno.test('validateToolArgs — rejects values outside the declared enum', () => {
  assertEquals(validateToolArgs(schema, { kinds: ['gaf', 'passport'] }).ok, false);
});

Deno.test('validateToolArgs — rejects wrong primitive types', () => {
  assertEquals(validateToolArgs(schema, { bookingId: 42 }).ok, false);
  assertEquals(validateToolArgs(schema, { confirm: 'yes' }).ok, false);
  assertEquals(validateToolArgs(schema, ['not', 'an', 'object']).ok, false);
});

Deno.test('validateToolArgs — oversized strings are rejected', () => {
  assertEquals(validateToolArgs(schema, { bookingId: 'x'.repeat(9000) }).ok, false);
});

Deno.test('validateToolArgs — missing ids pass through (tools fall back to page context)', () => {
  assertEquals(validateToolArgs(schema, {}), { ok: true, args: {} });
});

Deno.test('validateToolArgs — undeclared legacy aliases pass through unchanged', () => {
  assertEquals(validateToolArgs(schema, { occurred_on: '2026-09-01' }), {
    ok: true,
    args: { occurred_on: '2026-09-01' },
  });
});
