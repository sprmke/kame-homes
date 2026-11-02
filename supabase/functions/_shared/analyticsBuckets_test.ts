import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { amountBucketPhp, recipientCountBucket } from './analyticsBuckets.ts';

Deno.test('amountBucketPhp buckets at 1k / 5k / 20k', () => {
  assertEquals(amountBucketPhp(0), '<1k');
  assertEquals(amountBucketPhp(999), '<1k');
  assertEquals(amountBucketPhp(1000), '1k-5k');
  assertEquals(amountBucketPhp(4999), '1k-5k');
  assertEquals(amountBucketPhp(5000), '5k-20k');
  assertEquals(amountBucketPhp(19999), '5k-20k');
  assertEquals(amountBucketPhp(20000), '20k+');
});

Deno.test('amountBucketPhp never throws on a bad amount', () => {
  assertEquals(amountBucketPhp(Number.NaN), '<1k');
  assertEquals(amountBucketPhp(-5), '<1k');
});

Deno.test('recipientCountBucket buckets at 5 and 20', () => {
  assertEquals(recipientCountBucket(0), '1-5');
  assertEquals(recipientCountBucket(5), '1-5');
  assertEquals(recipientCountBucket(6), '6-20');
  assertEquals(recipientCountBucket(20), '6-20');
  assertEquals(recipientCountBucket(21), '21+');
});
