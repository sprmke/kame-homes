import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  bookingRowReferencesStorageObject,
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

Deno.test('bookingRowReferencesStorageObject finds guest2 valid id column', () => {
  const target = { bucket: 'valid-ids', path: 'a/guest2.png' };
  const row = {
    valid_id_url: 'https://x.supabase.co/storage/v1/object/public/valid-ids/a/primary.png',
    guest2_valid_id_url: 'https://x.supabase.co/storage/v1/object/public/valid-ids/a/guest2.png',
  };
  assertEquals(bookingRowReferencesStorageObject(row, target), true);
});
