import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildNewBookingsPoints, resolveActivityWindow } from './bookingPace.ts';

Deno.test('resolveActivityWindow: caps at today', () => {
  assertEquals(resolveActivityWindow('2026-09-01', '2026-09-30', '2026-09-15'), {
    rangeFrom: '2026-09-01',
    rangeTo: '2026-09-15',
  });
});

Deno.test('buildNewBookingsPoints: daily non-cumulative created_at counts', () => {
  const current = [
    { createdAtIso: '2026-09-01', revenue: 1000 },
    { createdAtIso: '2026-09-01', revenue: 500 },
    { createdAtIso: '2026-09-05', revenue: 2000 },
  ];
  const points = buildNewBookingsPoints(current, [], '2026-09-01', '2026-09-05');
  const byDay = new Map(points.map((p) => [p.monthStart, p]));

  assertEquals(byDay.get('2026-09-01')?.reservations, 2);
  assertEquals(byDay.get('2026-09-01')?.revenue, 1500);
  assertEquals(byDay.get('2026-09-02')?.reservations, 0);
  assertEquals(byDay.get('2026-09-05')?.reservations, 1);
  // Not cumulative — Sep 5 is only that day's bookings
  assertEquals(byDay.get('2026-09-05')?.revenue, 2000);
});

Deno.test('buildNewBookingsPoints: last-year aligned by calendar shift', () => {
  const current = [{ createdAtIso: '2026-09-05', revenue: 100 }];
  const lastYear = [
    { createdAtIso: '2025-09-05', revenue: 80 },
    { createdAtIso: '2025-09-05', revenue: 20 },
  ];
  const points = buildNewBookingsPoints(current, lastYear, '2026-09-05', '2026-09-05');
  assertEquals(points[0]?.reservations, 1);
  assertEquals(points[0]?.reservationsLastYear, 2);
  assertEquals(points[0]?.revenueLastYear, 100);
});
