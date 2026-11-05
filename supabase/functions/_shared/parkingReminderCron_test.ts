import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { isParkingReminderDue } from './parkingReminderEligibility.ts';

const TODAY = '2026-11-03';

Deno.test('parking reminder: past check-ins are never due', () => {
  for (const past of ['04-19-2025', '11-08-2025', '12-17-2025', '11-02-2026', '2024-01-01']) {
    assertEquals(isParkingReminderDue(past, TODAY, 'READY_FOR_CHECKIN', false), false, past);
  }
});

Deno.test('parking reminder: today and the lead window are due', () => {
  assertEquals(isParkingReminderDue('11-03-2026', TODAY, 'READY_FOR_CHECKIN', false), true);
  assertEquals(isParkingReminderDue('11-06-2026', TODAY, 'READY_FOR_CHECKIN', false), true);
  assertEquals(isParkingReminderDue('2026-11-06', TODAY, 'READY_FOR_CHECKIN', false), true);
});

Deno.test('parking reminder: beyond the lead window, linked, or unlinkable status are not due', () => {
  assertEquals(isParkingReminderDue('11-07-2026', TODAY, 'READY_FOR_CHECKIN', false), false);
  assertEquals(isParkingReminderDue('11-04-2026', TODAY, 'READY_FOR_CHECKIN', true), false);
  assertEquals(isParkingReminderDue('11-04-2026', TODAY, 'CANCELLED', false), false);
});
