import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  bookingRowReferencesStorageObject,
  buildStoragePathCandidates,
  resolveMatchingStorageLocFromBookingRow,
  storedUrlReferencesStorageObject,
} from './bookingAssetUrlScope.ts';

Deno.test('storedUrlReferencesStorageObject matches full path and encoded host rewrite', () => {
  const target = { bucket: 'valid-ids', path: 'prop/booking/id.jpg' };
  const stored =
    'https://fworvijbrwpyngycotbz.supabase.co/storage/v1/object/public/valid-ids/prop/booking/id.jpg';
  assertEquals(storedUrlReferencesStorageObject(stored, target), true);
});

Deno.test('storedUrlReferencesStorageObject matches by filename when folder differs', () => {
  const target = { bucket: 'payment-receipts', path: 'new/path/receipt.png' };
  const stored =
    'https://example.supabase.co/storage/v1/object/public/payment-receipts/legacy/receipt.png';
  assertEquals(storedUrlReferencesStorageObject(stored, target), true);
});

Deno.test('resolveMatchingStorageLocFromBookingRow returns stored path not request path', () => {
  const row = {
    valid_id_url:
      'https://x.supabase.co/storage/v1/object/public/valid-ids/prop-1/booking-1/id.jpg',
  };
  const requestTarget = { bucket: 'valid-ids', path: 'id.jpg' };
  const resolved = resolveMatchingStorageLocFromBookingRow(row, requestTarget);
  assertEquals(resolved?.path, 'prop-1/booking-1/id.jpg');
});

Deno.test('buildStoragePathCandidates includes property and booking prefixes', () => {
  const paths = buildStoragePathCandidates('id.jpg', {
    propertyId: 'prop-1',
    bookingId: 'book-1',
  });
  assertEquals(paths.includes('prop-1/book-1/id.jpg'), true);
  assertEquals(paths.includes('prop-1/id.jpg'), true);
});

Deno.test('bookingRowReferencesStorageObject finds guest2 valid id column', () => {
  const target = { bucket: 'valid-ids', path: 'a/guest2.png' };
  const row = {
    valid_id_url: 'https://x.supabase.co/storage/v1/object/public/valid-ids/a/primary.png',
    guest2_valid_id_url: 'https://x.supabase.co/storage/v1/object/public/valid-ids/a/guest2.png',
  };
  assertEquals(bookingRowReferencesStorageObject(row, target), true);
});
