/**
 * Pure ranking / date helpers for owner-default parking (no Supabase imports).
 * Run: deno test supabase/functions/_shared/ownerDefaultParkingRank_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  ownerDefaultDateToYmd,
  rankOwnerDefaultParkingSlots,
  type OwnerDefaultParkingSlot,
} from './ownerDefaultParkingRank.ts';

Deno.test('ownerDefaultDateToYmd — ISO passthrough and MM-DD-YYYY', () => {
  assertEquals(ownerDefaultDateToYmd('2026-09-01'), '2026-09-01');
  assertEquals(ownerDefaultDateToYmd('09-01-2026'), '2026-09-01');
  assertEquals(ownerDefaultDateToYmd('9-1-2026'), '2026-09-01');
  assertEquals(ownerDefaultDateToYmd(''), '');
  assertEquals(ownerDefaultDateToYmd('bad'), '');
});

Deno.test('rankOwnerDefaultParkingSlots — residence match first, then created_at', () => {
  const slots: OwnerDefaultParkingSlot[] = [
    {
      id: 'b',
      slug: 'slot-b',
      name: 'B',
      residenceName: 'Other Place',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'a',
      slug: 'slot-a',
      name: 'A',
      residenceName: 'Solea Mactan',
      createdAt: '2026-06-01T00:00:00Z',
    },
    {
      id: 'c',
      slug: 'slot-c',
      name: 'C',
      residenceName: 'solea mactan',
      createdAt: '2026-02-01T00:00:00Z',
    },
  ];
  const ranked = rankOwnerDefaultParkingSlots(slots, 'Solea Mactan');
  assertEquals(
    ranked.map((s) => s.id),
    ['c', 'a', 'b']
  );
});

Deno.test('rankOwnerDefaultParkingSlots — preferred id wins when available', () => {
  const slots: OwnerDefaultParkingSlot[] = [
    {
      id: 'early',
      slug: 'early',
      name: 'Early',
      residenceName: 'Solea Mactan',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'pref',
      slug: 'pref',
      name: 'Preferred',
      residenceName: 'Other',
      createdAt: '2026-06-01T00:00:00Z',
    },
  ];
  const ranked = rankOwnerDefaultParkingSlots(slots, 'Solea Mactan', 'pref');
  assertEquals(
    ranked.map((s) => s.id),
    ['pref', 'early']
  );
});

Deno.test('rankOwnerDefaultParkingSlots — no residence → created_at then name', () => {
  const slots: OwnerDefaultParkingSlot[] = [
    {
      id: 'z',
      slug: 'z',
      name: 'Z',
      residenceName: null,
      createdAt: '2026-03-01T00:00:00Z',
    },
    {
      id: 'a',
      slug: 'a',
      name: 'A',
      residenceName: null,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];
  const ranked = rankOwnerDefaultParkingSlots(slots, null);
  assertEquals(
    ranked.map((s) => s.id),
    ['a', 'z']
  );
});
