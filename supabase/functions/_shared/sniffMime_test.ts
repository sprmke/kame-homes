import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { assertMimeMatchesBytes, sniffDocumentMime } from './sniffMime.ts';

function jpeg(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

function pdf(): Uint8Array {
  const head = new TextEncoder().encode('%PDF-1.4\n....');
  return head;
}

Deno.test('sniffDocumentMime: JPEG / PDF', () => {
  assertEquals(sniffDocumentMime(jpeg()), 'image/jpeg');
  assertEquals(sniffDocumentMime(pdf()), 'application/pdf');
});

Deno.test('assertMimeMatchesBytes: rejects spoofed Content-Type', () => {
  assertEquals(assertMimeMatchesBytes(jpeg(), 'image/jpeg'), 'image/jpeg');
  assertThrows(() => assertMimeMatchesBytes(jpeg(), 'application/pdf'), Error, 'image/jpeg');
  assertThrows(
    () => assertMimeMatchesBytes(new Uint8Array(12), 'image/jpeg'),
    Error,
    'not recognized'
  );
});
