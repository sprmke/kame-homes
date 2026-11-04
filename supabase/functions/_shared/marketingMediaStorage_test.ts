import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { DEFAULT_MARKETING_MEDIA_LIBRARY } from './planFeatures.ts';
import {
  assertUploadMatchesBytes,
  decodePeaks,
  parsePeaksBase64,
  extensionForMarketingMime,
  isAllowedMarketingMediaMime,
  kindForMime,
  limitMessage,
  marketingMediaOriginalPath,
  marketingMediaPosterPath,
  parseMp4DurationMs,
  reserveLimitsFor,
  routeFromPath,
  sniffMarketingMedia,
} from './marketingMediaStorage.ts';

function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}

function ftyp(brand: string): Uint8Array {
  const p = new Uint8Array(8);
  for (let i = 0; i < 4; i++) p[i] = brand.charCodeAt(i);
  return box('ftyp', p);
}

function mvhdV0(timescale: number, duration: number): Uint8Array {
  const p = new Uint8Array(100);
  const v = new DataView(p.buffer);
  v.setUint32(12, timescale);
  v.setUint32(16, duration);
  return box('mvhd', p);
}

function mvhdV1(timescale: number, duration: number): Uint8Array {
  const p = new Uint8Array(112);
  p[0] = 1;
  const v = new DataView(p.buffer);
  v.setUint32(20, timescale);
  v.setUint32(24, Math.floor(duration / 2 ** 32));
  v.setUint32(28, duration >>> 0);
  return box('mvhd', p);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

Deno.test('parseMp4DurationMs reads version 0 and 1 mvhd', () => {
  const v0 = concat(ftyp('isom'), box('moov', mvhdV0(1000, 12345)));
  assertEquals(parseMp4DurationMs(v0), 12345);
  const v1 = concat(ftyp('isom'), box('free', new Uint8Array(4)), box('moov', mvhdV1(600, 6000)));
  assertEquals(parseMp4DurationMs(v1), 10000);
});

Deno.test('parseMp4DurationMs returns null for missing moov, truncated or junk input', () => {
  assertEquals(parseMp4DurationMs(ftyp('isom')), null);
  assertEquals(parseMp4DurationMs(new Uint8Array(0)), null);
  assertEquals(parseMp4DurationMs(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])), null);
  const bad = concat(ftyp('isom'), box('moov', mvhdV0(0, 100)));
  assertEquals(parseMp4DurationMs(bad), null);
});

Deno.test('mime helpers classify and reject unsupported types (no SVG)', () => {
  assertEquals(kindForMime('image/webp'), 'image');
  assertEquals(kindForMime('video/quicktime'), 'video');
  assertEquals(kindForMime('audio/mp3'), 'audio');
  assertEquals(kindForMime('image/svg+xml'), null);
  assertEquals(isAllowedMarketingMediaMime('text/html'), false);
  assertEquals(extensionForMarketingMime('video/quicktime'), 'mov');
});

Deno.test('storage paths are content-addressed under the property', () => {
  assertEquals(marketingMediaOriginalPath('p1', 'a1', '.mp4'), 'p1/a1/original.mp4');
  assertEquals(marketingMediaPosterPath('p1', 'a1'), 'p1/a1/poster.jpg');
});

Deno.test('sniffMarketingMedia distinguishes m4a, mp4, jpeg and rejects junk', () => {
  assertEquals(sniffMarketingMedia(concat(ftyp('M4A '), new Uint8Array(8)))?.kind, 'audio');
  assertEquals(sniffMarketingMedia(concat(ftyp('isom'), new Uint8Array(8)))?.mime, 'video/mp4');
  const jpeg = new Uint8Array(16);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  assertEquals(sniffMarketingMedia(jpeg), { mime: 'image/jpeg', kind: 'image' });
  assertEquals(sniffMarketingMedia(new TextEncoder().encode('<svg xmlns="x"></svg>')), null);
});

Deno.test('assertUploadMatchesBytes enforces declared kind and mime', () => {
  const jpeg = new Uint8Array(16);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
  assertEquals(assertUploadMatchesBytes(jpeg, 'image', 'image/jpeg').mime, 'image/jpeg');
  assertThrows(() => assertUploadMatchesBytes(jpeg, 'video', 'video/mp4'));
  assertThrows(() => assertUploadMatchesBytes(jpeg, 'image', 'video/mp4'));
  assertThrows(() => assertUploadMatchesBytes(new Uint8Array(32), 'image', 'image/png'));
});

Deno.test('reserveLimitsFor maps plan MB to bytes per kind', () => {
  const lib = { ...DEFAULT_MARKETING_MEDIA_LIBRARY };
  const video = reserveLimitsFor('video', lib);
  assertEquals(video.storageBytes, 100 * 1024 * 1024);
  assertEquals(video.maxFileBytes, 50 * 1024 * 1024);
  assertEquals(video.maxVideoSec, 30);
  assertEquals(reserveLimitsFor('audio', lib).maxFileBytes, 15 * 1024 * 1024);
  assertEquals(reserveLimitsFor('image', lib).maxFileBytes, 10 * 1024 * 1024);
});

Deno.test('limit messages use human copy with plan numbers and no em dash', () => {
  const lib = { ...DEFAULT_MARKETING_MEDIA_LIBRARY, storageMb: 500, dailyUploads: 50 };
  assertEquals(
    limitMessage('storage_full', lib),
    "You've used all 500 MB of media storage. Delete files or upgrade."
  );
  assertEquals(
    limitMessage('daily_limit', lib),
    'You can upload 50 files a day on your plan. Try again tomorrow.'
  );
  for (const code of [
    'storage_full',
    'too_many_files',
    'file_too_large',
    'video_too_long',
    'daily_limit',
  ] as const) {
    assertEquals(limitMessage(code, lib).includes('—'), false);
  }
});

Deno.test('routeFromPath handles hosted, serve and direct-run paths', () => {
  assertEquals(routeFromPath('/marketing-media'), '');
  assertEquals(routeFromPath('/marketing-media/'), '');
  assertEquals(routeFromPath('/marketing-media/reserve'), 'reserve');
  assertEquals(routeFromPath('/functions/v1/marketing-media/usage'), 'usage');
  assertEquals(routeFromPath('/finalize'), 'finalize');
  assertEquals(routeFromPath('/'), '');
  assertEquals(routeFromPath('/marketing-media/other'), 'unknown:other');
});

Deno.test('peaks travel as compact base64 bytes and decode to 0..1', () => {
  const bytes = Uint8Array.from([0, 51, 255]);
  const b64 = btoa(String.fromCharCode(...bytes));
  assertEquals(parsePeaksBase64(b64), b64);
  assertEquals(decodePeaks(b64), [0, 0.2, 1]);
  assertEquals(decodePeaks(null), null);
  assertEquals(decodePeaks(123), null);
  assertEquals(decodePeaks('not base64!'), null);
  assertEquals(decodePeaks('abc'), null); // length not a multiple of 4
  assertEquals(parsePeaksBase64('A'.repeat(1404)), null); // more than 1000 peaks
  assertEquals(decodePeaks([0.1, 0.2]), null);
});

Deno.test('routeFromPath knows the abandon route', () => {
  assertEquals(routeFromPath('/marketing-media/abandon'), 'abandon');
});
