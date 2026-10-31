import {
  GUEST_DOC_STORAGE_BUCKETS,
  isPrivateStorageBucket,
  parseStorageObjectUrl,
  PRIVATE_STORAGE_BUCKETS,
} from './storageSignedUrl.ts';
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

Deno.test('parseStorageObjectUrl decodes public storage paths', () => {
  const url =
    'https://example.supabase.co/storage/v1/object/public/valid-ids/prop-1/guest%20id.jpg';
  const loc = parseStorageObjectUrl(url);
  assertEquals(loc, { bucket: 'valid-ids', path: 'prop-1/guest id.jpg' });
});

Deno.test('parseStorageObjectUrl accepts signed path segment', () => {
  const url =
    'https://example.supabase.co/storage/v1/object/sign/payment-receipts/receipt.pdf?token=abc';
  const loc = parseStorageObjectUrl(url);
  assertEquals(loc, { bucket: 'payment-receipts', path: 'receipt.pdf' });
});

Deno.test('parseStorageObjectUrl returns null for non-storage URLs', () => {
  assertEquals(parseStorageObjectUrl('https://cdn.example.com/image.png'), null);
});

Deno.test('guest doc buckets are private', () => {
  for (const bucket of GUEST_DOC_STORAGE_BUCKETS) {
    assertEquals(isPrivateStorageBucket(bucket), true);
    assertEquals(PRIVATE_STORAGE_BUCKETS.has(bucket), true);
  }
});
