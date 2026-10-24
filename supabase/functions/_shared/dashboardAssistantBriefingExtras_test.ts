import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  addDaysYmd,
  briefingDeltaHasSignal,
  forwardOccupancyPercent,
  holidaysInWindow,
  overnightNightsInWindow,
  unpricedHolidayNames,
} from './dashboardAssistantBriefingExtras.ts';

Deno.test('holidaysInWindow includes All Saints from mid-October 2026', () => {
  const names = holidaysInWindow('2026-10-19', 60).map((holiday) => holiday.name);
  assertEquals(names.includes("All Saints' Day"), true);
  assertEquals(names.includes('Christmas Season'), false);
});

Deno.test('unpricedHolidayNames drops holidays covered by a rate rule', () => {
  const upcoming = holidaysInWindow('2026-10-19', 60);
  assertEquals(
    unpricedHolidayNames(upcoming, [{ startDate: '2026-11-01', endDate: '2026-11-02' }]),
    []
  );
  assertEquals(unpricedHolidayNames(upcoming, []).includes("All Saints' Day"), true);
});

Deno.test('forwardOccupancyPercent is nights over capacity', () => {
  const pct = forwardOccupancyPercent(
    [{ checkIn: '2026-10-19', checkOut: '2026-10-29' }],
    '2026-10-19',
    1,
    30
  );
  assertEquals(pct, 33);
  assertEquals(forwardOccupancyPercent([], '2026-10-19', 0), null);
});

Deno.test('overnightNightsInWindow clips to the window', () => {
  assertEquals(
    overnightNightsInWindow(
      [{ checkIn: '2026-10-10', checkOut: '2026-10-22' }],
      '2026-10-19',
      '2026-11-18'
    ),
    3
  );
});

Deno.test('briefingDeltaHasSignal is false when every count is 0', () => {
  assertEquals(
    briefingDeltaHasSignal({ newBookings: 0, newMessages: 0, completedStays: 0 }),
    false
  );
  assertEquals(briefingDeltaHasSignal({ newBookings: 1, newMessages: 0, completedStays: 0 }), true);
  assertEquals(addDaysYmd('2026-10-19', 1), '2026-10-20');
});
