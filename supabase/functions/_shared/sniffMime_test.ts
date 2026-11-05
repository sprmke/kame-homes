import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  assertMimeMatchesBytes,
  assertUploadMatchesBytes,
  sniffDocumentMime,
  sniffUploadMime,
} from './sniffMime.ts';

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

function ascii(text: string, pad = 16): Uint8Array {
  const out = new Uint8Array(Math.max(pad, text.length));
  out.set(new TextEncoder().encode(text));
  return out;
}

function ftyp(brand: string): Uint8Array {
  return ascii(`\0\0\0\x18ftyp${brand}\0\0\0\0`, 24);
}

const html = ascii('<!doctype html><script>alert(1)</script>');
const IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MEDIA = new Set(['image/jpeg', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']);

Deno.test('sniffUploadMime: GIF, MP4, QuickTime, HEIC, WebM, Matroska, AVI, Ogg', () => {
  assertEquals(sniffUploadMime(ascii('GIF89a')), 'image/gif');
  assertEquals(sniffUploadMime(ftyp('isom')), 'video/mp4');
  assertEquals(sniffUploadMime(ftyp('qt  ')), 'video/quicktime');
  assertEquals(sniffUploadMime(ftyp('heic')), 'image/heic');
  assertEquals(sniffUploadMime(ftyp('M4A ')), 'audio/mp4');
  const ebml = new Uint8Array(32);
  ebml.set([0x1a, 0x45, 0xdf, 0xa3]);
  assertEquals(sniffUploadMime(ebml), 'video/x-matroska');
  ebml.set(new TextEncoder().encode('webm'), 20);
  assertEquals(sniffUploadMime(ebml), 'video/webm');
  assertEquals(sniffUploadMime(ascii('RIFF\0\0\0\0AVI LIST')), 'video/x-msvideo');
  assertEquals(sniffUploadMime(ascii('OggS')), 'video/ogg');
  assertEquals(sniffUploadMime(ascii('BM')), 'image/bmp');
  assertEquals(sniffUploadMime(ascii('II*\0')), 'image/tiff');
  assertEquals(sniffUploadMime(ascii('MM\0*')), 'image/tiff');
  assertEquals(sniffUploadMime(ftyp('avif')), 'image/avif');
  assertEquals(
    sniffUploadMime(new Uint8Array([0, 0, 1, 0xba, 0, 0, 0, 0, 0, 0, 0, 0])),
    'video/mpeg'
  );
  assertEquals(sniffUploadMime(html), null);
});

Deno.test('assertUploadMatchesBytes: bytes must be allowed and match the declared type', () => {
  assertEquals(assertUploadMatchesBytes(jpeg(), 'image/jpeg', IMAGES), 'image/jpeg');
  assertEquals(assertUploadMatchesBytes(jpeg(), 'image/jpg', IMAGES), 'image/jpeg');
  assertThrows(() => assertUploadMatchesBytes(html, 'image/png', IMAGES), Error, 'not recognized');
  assertThrows(() => assertUploadMatchesBytes(pdf(), 'image/png', IMAGES), Error, 'not allowed');
  assertThrows(
    () => assertUploadMatchesBytes(ascii('GIF89a'), 'image/gif', IMAGES),
    Error,
    'not allowed'
  );
  assertThrows(() => assertUploadMatchesBytes(jpeg(), 'image/png', IMAGES), Error, 'not image/png');
});

Deno.test('assertUploadMatchesBytes: MP4 vs QuickTime alias and generic declared type', () => {
  assertEquals(assertUploadMatchesBytes(ftyp('qt  '), 'video/mp4', MEDIA), 'video/quicktime');
  assertEquals(
    assertUploadMatchesBytes(ftyp('isom'), 'application/octet-stream', MEDIA),
    'video/mp4'
  );
  assertEquals(assertUploadMatchesBytes(jpeg(), '', MEDIA), 'image/jpeg');
  assertThrows(() => assertUploadMatchesBytes(html, 'application/octet-stream', MEDIA));
});
