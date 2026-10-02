/**
 * Minimal MP4 (ISO-BMFF) reader for validating generated video before it is stored
 * and billed. Reads only box headers: `moov/mvhd` (duration), each `trak`'s `tkhd`
 * (display size) and `mdia/hdlr` (track kind). No decoding, no dependency.
 *
 * Returns `supported: false` when the layout is not understood (truncated file,
 * not an MP4). Callers treat that as "no signal", never as a rejection.
 */

export type Mp4ProbeResult =
  | {
      supported: true;
      /** Null for fragmented MP4, where the header does not carry the length. */
      durationSeconds: number | null;
      width: number | null;
      height: number | null;
      hasVideoTrack: boolean;
      hasAudioTrack: boolean;
      /** `moov` before `mdat`: playback can start before the whole file arrives. */
      faststart: boolean;
    }
  | { supported: false; reason: string };

type Box = { type: string; start: number; headerSize: number; end: number };

function readBoxes(view: DataView, start: number, end: number): Box[] | null {
  const boxes: Box[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) return null;
      const big = view.getBigUint64(offset + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) return null;
    boxes.push({ type, start: offset, headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
}

function child(view: DataView, parent: Box, type: string): Box | null {
  return (
    readBoxes(view, parent.start + parent.headerSize, parent.end)?.find((b) => b.type === type) ??
    null
  );
}

function readMvhdDuration(view: DataView, mvhd: Box): number | null {
  const p = mvhd.start + mvhd.headerSize;
  const version = view.getUint8(p);
  if (version === 1) {
    if (p + 32 > mvhd.end) return null;
    const timescale = view.getUint32(p + 20);
    const duration = Number(view.getBigUint64(p + 24));
    return timescale > 0 ? duration / timescale : null;
  }
  if (p + 20 > mvhd.end) return null;
  const timescale = view.getUint32(p + 12);
  const duration = view.getUint32(p + 16);
  return timescale > 0 ? duration / timescale : null;
}

/** tkhd width/height are 16.16 fixed point at the end of the box. */
function readTkhdSize(view: DataView, tkhd: Box): { width: number; height: number } | null {
  if (tkhd.end - 8 < tkhd.start + tkhd.headerSize) return null;
  return {
    width: view.getUint32(tkhd.end - 8) / 65536,
    height: view.getUint32(tkhd.end - 4) / 65536,
  };
}

function readHandler(view: DataView, hdlr: Box): string | null {
  const p = hdlr.start + hdlr.headerSize + 8;
  if (p + 4 > hdlr.end) return null;
  return String.fromCharCode(
    view.getUint8(p),
    view.getUint8(p + 1),
    view.getUint8(p + 2),
    view.getUint8(p + 3)
  );
}

export function probeMp4(bytes: Uint8Array): Mp4ProbeResult {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const top = readBoxes(view, 0, bytes.byteLength);
    if (!top || top[0]?.type !== 'ftyp') return { supported: false, reason: 'not an MP4' };

    const moovIndex = top.findIndex((b) => b.type === 'moov');
    if (moovIndex === -1) return { supported: false, reason: 'no moov box' };
    const moov = top[moovIndex]!;
    const mdatIndex = top.findIndex((b) => b.type === 'mdat');

    const mvhd = child(view, moov, 'mvhd');
    const headerDuration = mvhd ? readMvhdDuration(view, mvhd) : null;
    if (headerDuration === null) return { supported: false, reason: 'no readable duration' };
    // Fragmented files keep the real length in the fragments; mvhd says 0.
    const fragmented = child(view, moov, 'mvex') !== null || top.some((b) => b.type === 'moof');
    const durationSeconds = fragmented || headerDuration === 0 ? null : headerDuration;

    let width: number | null = null;
    let height: number | null = null;
    let hasVideoTrack = false;
    let hasAudioTrack = false;
    for (const trak of readBoxes(view, moov.start + moov.headerSize, moov.end) ?? []) {
      if (trak.type !== 'trak') continue;
      const mdia = child(view, trak, 'mdia');
      const hdlr = mdia ? child(view, mdia, 'hdlr') : null;
      const handler = hdlr ? readHandler(view, hdlr) : null;
      if (handler === 'soun') hasAudioTrack = true;
      if (handler !== 'vide') continue;
      hasVideoTrack = true;
      const tkhd = child(view, trak, 'tkhd');
      const size = tkhd ? readTkhdSize(view, tkhd) : null;
      if (size && size.width > 0 && size.height > 0) {
        width = Math.round(size.width);
        height = Math.round(size.height);
      }
    }

    return {
      supported: true,
      durationSeconds,
      width,
      height,
      hasVideoTrack,
      hasAudioTrack,
      faststart: mdatIndex === -1 || moovIndex < mdatIndex,
    };
  } catch (err) {
    return { supported: false, reason: (err as Error).message };
  }
}

const MIN_VIDEO_BYTES = 50_000;
/** Veo returns the requested length; this only catches a clip that is clearly cut short. */
const DURATION_TOLERANCE_SECONDS = 1.5;

/**
 * Rejects only on positive evidence that the clip is unusable. A layout the probe
 * cannot read passes, so a parser gap never blocks a real render.
 */
export function isDegenerateGeneratedVideo(input: {
  bytes: Uint8Array;
  probe: Mp4ProbeResult;
  requestedAspectRatio: string;
  requestedDurationSeconds: number;
}): { degenerate: true; reason: string } | { degenerate: false } {
  if (input.bytes.byteLength < MIN_VIDEO_BYTES) {
    return { degenerate: true, reason: 'Generated video is too small to be valid' };
  }
  const probe = input.probe;
  if (!probe.supported) return { degenerate: false };
  if (!probe.hasVideoTrack) {
    return { degenerate: true, reason: 'Generated video has no video track' };
  }
  if (
    probe.durationSeconds !== null &&
    probe.durationSeconds < input.requestedDurationSeconds - DURATION_TOLERANCE_SECONDS
  ) {
    return {
      degenerate: true,
      reason: `Generated video is ${probe.durationSeconds.toFixed(1)}s, expected ${input.requestedDurationSeconds}s`,
    };
  }
  const match = /^(\d+):(\d+)$/.exec(input.requestedAspectRatio);
  if (match && probe.width && probe.height) {
    const wantPortrait = Number(match[1]) < Number(match[2]);
    const isPortrait = probe.width < probe.height;
    if (wantPortrait !== isPortrait) {
      return {
        degenerate: true,
        reason: `Generated video is ${probe.width}x${probe.height}, expected ${input.requestedAspectRatio}`,
      };
    }
  }
  return { degenerate: false };
}
