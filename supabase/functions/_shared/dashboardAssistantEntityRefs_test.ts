import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  capEntityRefs,
  dedupeEntityRefs,
  extractEntityRefs,
  formatKnownFactsSection,
  parseEntityRefs,
  type EntityRef,
} from './dashboardAssistantEntityRefs.ts';

Deno.test('extractEntityRefs — a single top-level entity object (get_booking shape)', () => {
  const refs = extractEntityRefs('get_booking', {
    bookingId: 'b1',
    hostLabel: 'Juan Dela Cruz · Pending Review',
    statusLabel: 'Pending Review',
    checkIn: '2026-11-10',
    checkOut: '2026-11-14',
  });
  assertEquals(refs, [
    {
      kind: 'booking',
      id: 'b1',
      label: 'Juan Dela Cruz · Pending Review',
      digest: 'Pending Review, check-in 2026-11-10, check-out 2026-11-14',
      toolName: 'get_booking',
    },
  ]);
});

Deno.test('extractEntityRefs — a wrapped array (list_bookings shape: {total, bookings})', () => {
  const refs = extractEntityRefs('list_bookings', {
    total: 2,
    bookings: [
      { bookingId: 'b1', hostLabel: 'Juan · Pending Review', statusLabel: 'Pending Review' },
      { bookingId: 'b2', hostLabel: 'Maria · Completed', statusLabel: 'Completed' },
    ],
  });
  assertEquals(refs.length, 2);
  assertEquals(refs[0]!.id, 'b1');
  assertEquals(refs[1]!.id, 'b2');
});

Deno.test(
  'extractEntityRefs — a plain array with generic id resolved via toolName (maintenance)',
  () => {
    const refs = extractEntityRefs('list_maintenance_items', [
      { id: 'm1', hostLabel: 'Pest control spray · Open', scheduledOn: '2026-11-05' },
    ]);
    assertEquals(refs, [
      {
        kind: 'maintenance_item',
        id: 'm1',
        label: 'Pest control spray · Open',
        digest: 'scheduled 2026-11-05',
        toolName: 'list_maintenance_items',
      },
    ]);
  }
);

Deno.test(
  'extractEntityRefs — generic id with an unmapped toolName yields nothing (no false kind guess)',
  () => {
    const refs = extractEntityRefs('some_unrelated_tool', [{ id: 'x1', hostLabel: 'Something' }]);
    assertEquals(refs, []);
  }
);

Deno.test('extractEntityRefs — a record missing hostLabel is not an entity', () => {
  const refs = extractEntityRefs('get_booking', { bookingId: 'b1', status: 'pending_review' });
  assertEquals(refs, []);
});

Deno.test(
  'extractEntityRefs — stops descending into a matched entity (no noise from nested statusHistory)',
  () => {
    const refs = extractEntityRefs('get_booking', {
      bookingId: 'b1',
      hostLabel: 'Juan · Pending Review',
      statusHistory: [{ id: 'h1', hostLabel: 'should not be picked up' }],
    });
    assertEquals(refs.length, 1);
    assertEquals(refs[0]!.id, 'b1');
  }
);

Deno.test('extractEntityRefs — dedupes within one call by kind:id, keeps first seen', () => {
  const refs = extractEntityRefs('list_bookings', {
    bookings: [
      { bookingId: 'b1', hostLabel: 'Juan (first)' },
      { bookingId: 'b1', hostLabel: 'Juan (second)' },
    ],
  });
  assertEquals(refs.length, 1);
  assertEquals(refs[0]!.label, 'Juan (first)');
});

Deno.test('extractEntityRefs — non-object/garbage data never throws, returns []', () => {
  assertEquals(extractEntityRefs('x', null), []);
  assertEquals(extractEntityRefs('x', 'a string'), []);
  assertEquals(extractEntityRefs('x', 42), []);
  assertEquals(extractEntityRefs('x', undefined), []);
});

Deno.test('dedupeEntityRefs — later ref for the same kind:id wins (freshest info)', () => {
  const a: EntityRef = { kind: 'booking', id: 'b1', label: 'old' };
  const b: EntityRef = { kind: 'booking', id: 'b1', label: 'new' };
  const result = dedupeEntityRefs([a, b]);
  assertEquals(result, [b]);
});

Deno.test('capEntityRefs — keeps the most recent N (end of array)', () => {
  const refs: EntityRef[] = Array.from({ length: 10 }, (_, i) => ({
    kind: 'booking',
    id: `b${i}`,
    label: `Booking ${i}`,
  }));
  const capped = capEntityRefs(refs, 3);
  assertEquals(
    capped.map((r) => r.id),
    ['b7', 'b8', 'b9']
  );
});

Deno.test('capEntityRefs — under the limit returns everything unchanged', () => {
  const refs: EntityRef[] = [{ kind: 'booking', id: 'b1', label: 'Booking 1' }];
  assertEquals(capEntityRefs(refs, 8), refs);
});

Deno.test('parseEntityRefs — round-trips a well-formed jsonb array', () => {
  const raw = [
    { kind: 'booking', id: 'b1', label: 'Juan', digest: 'Pending Review', toolName: 'get_booking' },
  ];
  assertEquals(parseEntityRefs(raw), raw);
});

Deno.test('parseEntityRefs — drops malformed entries instead of throwing', () => {
  const raw = [
    { kind: 'booking', id: 'b1', label: 'ok' },
    { kind: 'booking' }, // missing id/label
    'not an object',
    null,
    42,
  ];
  assertEquals(parseEntityRefs(raw), [
    { kind: 'booking', id: 'b1', label: 'ok', digest: undefined, toolName: undefined },
  ]);
});

Deno.test('parseEntityRefs — non-array input returns []', () => {
  assertEquals(parseEntityRefs(null), []);
  assertEquals(parseEntityRefs({}), []);
  assertEquals(parseEntityRefs('x'), []);
});

Deno.test('formatKnownFactsSection — empty input returns empty string', () => {
  assertEquals(formatKnownFactsSection([]), '');
});

Deno.test('formatKnownFactsSection — formats label, digest and the right id key per kind', () => {
  const refs: EntityRef[] = [
    { kind: 'booking', id: 'b1', label: 'Juan Dela Cruz', digest: 'Pending Review' },
    { kind: 'maintenance_item', id: 'm1', label: 'Pest control spray · Open' },
  ];
  const text = formatKnownFactsSection(refs);
  assertEquals(text.includes('- Juan Dela Cruz (Pending Review) [bookingId: b1]'), true);
  assertEquals(text.includes('- Pest control spray · Open [id: m1]'), true);
  assertEquals(text.startsWith('\n\nKnown from earlier in this chat'), true);
});
