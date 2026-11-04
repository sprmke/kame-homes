import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  failedRetentionCutoffIso,
  groupPathsByBucket,
  pendingExpiryCutoffIso,
  shouldRunOrphanScan,
} from './marketingMediaSweeper.ts';

Deno.test('pending reservations expire after three hours', () => {
  const now = new Date('2026-11-01T12:00:00.000Z');
  assertEquals(pendingExpiryCutoffIso(now), '2026-11-01T09:00:00.000Z');
});

Deno.test('orphan scan runs once a day in the 03:00 Manila half hour', () => {
  assertEquals(shouldRunOrphanScan(new Date('2026-11-01T19:00:00Z')), true);
  assertEquals(shouldRunOrphanScan(new Date('2026-11-01T19:29:59Z')), true);
  assertEquals(shouldRunOrphanScan(new Date('2026-11-01T19:30:00Z')), false);
  assertEquals(shouldRunOrphanScan(new Date('2026-11-01T07:00:00Z')), false);
});

Deno.test('groupPathsByBucket keeps legacy buckets separate and includes posters', () => {
  const groups = groupPathsByBucket([
    { bucket: 'marketing-media', storage_path: 'p/a/original.mp4', poster_path: 'p/a/poster.jpg' },
    { bucket: 'property-media', storage_path: 'marketing-uploads/p/x.jpg', poster_path: null },
    { bucket: 'marketing-media', storage_path: 'p/b/original.png', poster_path: null },
  ]);
  assertEquals(groups.get('marketing-media'), [
    'p/a/original.mp4',
    'p/a/poster.jpg',
    'p/b/original.png',
  ]);
  assertEquals(groups.get('property-media'), ['marketing-uploads/p/x.jpg']);
});

Deno.test('failed rows are kept for a week', () => {
  assertEquals(
    failedRetentionCutoffIso(new Date('2026-11-08T00:00:00.000Z')),
    '2026-11-01T00:00:00.000Z'
  );
});
