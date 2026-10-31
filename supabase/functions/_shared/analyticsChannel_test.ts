import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { canonicalAnalyticsChannel } from './analyticsChannel.ts';

Deno.test('canonicalAnalyticsChannel: Direct aliases roll up', () => {
  assertEquals(canonicalAnalyticsChannel('Direct'), 'Direct');
  assertEquals(canonicalAnalyticsChannel('direct'), 'Direct');
  assertEquals(canonicalAnalyticsChannel('website'), 'Direct');
  assertEquals(canonicalAnalyticsChannel(' Website '), 'Direct');
});

Deno.test('canonicalAnalyticsChannel: known OTAs and social', () => {
  assertEquals(canonicalAnalyticsChannel('airbnb'), 'Airbnb');
  assertEquals(canonicalAnalyticsChannel('Airbnb'), 'Airbnb');
  assertEquals(canonicalAnalyticsChannel('booking'), 'Booking.com');
  assertEquals(canonicalAnalyticsChannel('tiktok'), 'TikTok');
});

Deno.test('canonicalAnalyticsChannel: empty / unknown', () => {
  assertEquals(canonicalAnalyticsChannel(null), 'Unknown');
  assertEquals(canonicalAnalyticsChannel(''), 'Unknown');
  assertEquals(canonicalAnalyticsChannel('marketing_review_seed'), 'Marketing Review Seed');
});
