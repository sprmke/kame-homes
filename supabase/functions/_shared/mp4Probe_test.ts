/**
 * Deno tests for _shared/mp4Probe.ts — run with `deno test`.
 *
 * Fixtures are built box by box so they stay tiny. The probe was also checked by hand
 * against real ffmpeg output (faststart, non-faststart, fragmented, with and without
 * an audio track).
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { isDegenerateGeneratedVideo, probeMp4 } from './mp4Probe.ts';

function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const size = 8 + payload.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(new TextEncoder().encode(type), 4);
  let offset = 8;
  for (const p of payload) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint32(i * 4, v));
  return out;
}

/** mvhd v0: version/flags, created, modified, timescale, duration, then padding. */
function mvhd(timescale: number, duration: number) {
  return box('mvhd', u32(0, 0, 0, timescale, duration), new Uint8Array(80));
}

/** tkhd: width/height are the last 8 bytes, 16.16 fixed point. */
function tkhd(width: number, height: number) {
  return box('tkhd', new Uint8Array(76), u32(width * 65536, height * 65536));
}

function trak(handler: 'vide' | 'soun', width = 0, height = 0) {
  const hdlr = box('hdlr', u32(0, 0), new TextEncoder().encode(handler), new Uint8Array(12));
  return box('trak', tkhd(width, height), box('mdia', hdlr));
}

function mp4(options: {
  duration?: number;
  video?: [number, number] | null;
  audio?: boolean;
  fragmented?: boolean;
  mdatBytes?: number;
}) {
  const traks: Uint8Array[] = [];
  if (options.video !== null) traks.push(trak('vide', ...(options.video ?? [720, 1280])));
  if (options.audio) traks.push(trak('soun'));
  if (options.fragmented) traks.push(box('mvex'));
  const moov = box('moov', mvhd(1000, (options.duration ?? 8) * 1000), ...traks);
  return new Uint8Array([
    ...box('ftyp', new TextEncoder().encode('isom'), u32(0)),
    ...moov,
    ...box('mdat', new Uint8Array(options.mdatBytes ?? 60_000)),
  ]);
}

function check(bytes: Uint8Array, aspectRatio = '9:16') {
  return isDegenerateGeneratedVideo({
    bytes,
    probe: probeMp4(bytes),
    requestedAspectRatio: aspectRatio,
    requestedDurationSeconds: 8,
  });
}

Deno.test('probeMp4 reads duration, size, tracks, and faststart', () => {
  const probe = probeMp4(mp4({ audio: true }));
  assertEquals(probe, {
    supported: true,
    durationSeconds: 8,
    width: 720,
    height: 1280,
    hasVideoTrack: true,
    hasAudioTrack: true,
    faststart: true,
  });
});

Deno.test('probeMp4: fragmented file has unknown duration, not zero', () => {
  const probe = probeMp4(mp4({ duration: 0, fragmented: true }));
  assert(probe.supported);
  assertEquals(probe.durationSeconds, null);
});

Deno.test('probeMp4: non-MP4 and truncated bytes are unsupported, never thrown', () => {
  assertEquals(probeMp4(new TextEncoder().encode('<html>error</html>')).supported, false);
  assertEquals(probeMp4(mp4({}).slice(0, 40)).supported, false);
  assertEquals(probeMp4(new Uint8Array()).supported, false);
});

Deno.test('a clean 9:16 8s clip passes', () => {
  assertEquals(check(mp4({ audio: true })), { degenerate: false });
});

Deno.test('rejects a tiny file, a missing video track, a short clip, and wrong orientation', () => {
  assert(check(mp4({ mdatBytes: 100 })).degenerate);
  assert(check(mp4({ video: null })).degenerate);
  assert(check(mp4({ duration: 4 })).degenerate);
  assert(check(mp4({ video: [1920, 1080] }), '9:16').degenerate);
});

Deno.test('small duration drift and unreadable layouts pass', () => {
  assertEquals(check(mp4({ duration: 7 })), { degenerate: false });
  assertEquals(check(mp4({ video: [1920, 1080] }), '16:9'), { degenerate: false });
  assertEquals(check(new Uint8Array(80_000)), { degenerate: false });
});
