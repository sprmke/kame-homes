import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { countStayNights, occupiedStayNights } from './utils.ts';

Deno.test('countStayNights - whole nights between the two dates', () => {
  assertEquals(countStayNights('2026-01-10', '2026-01-12'), 2);
  assertEquals(countStayNights('01-10-2026', '01-12-2026'), 2);
  assertEquals(countStayNights('2026-01-10', '2026-01-10'), 0);
});

Deno.test('occupiedStayNights - a same-day stay occupies one night', () => {
  assertEquals(occupiedStayNights('2026-01-10', '2026-01-10'), 1);
  assertEquals(occupiedStayNights('01-10-2026', '01-10-2026'), 1);
  assertEquals(occupiedStayNights('2026-01-10', '2026-01-12'), 2);
  assertEquals(occupiedStayNights('2026-01-12', '2026-01-10'), 0);
  assertEquals(occupiedStayNights('', '2026-01-10'), 0);
});
