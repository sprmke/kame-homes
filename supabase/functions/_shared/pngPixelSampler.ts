/**
 * Minimal PNG pixel sampler for Phase 4b of the marketing-AI-image-quality-hardening
 * plan (docs/workflow/in-progress/marketing-ai-image-quality-hardening.md).
 *
 * Deno's edge runtime has no image-decoding library wired up, and adding a real one
 * (sharp/jimp-equivalent) is a dependency decision this module deliberately avoids.
 * Instead it decodes just enough of a PNG — using only Web-standard APIs already
 * available in every Deno function (`DecompressionStream('deflate')` for the zlib
 * payload) — to sample luminance across the frame and catch a blank or
 * near-uniform generation, which the byte-size/aspect-ratio checks in
 * `marketingGenerationStorage.ts` cannot see.
 *
 * Scope is intentionally narrow: 8-bit, non-interlaced, non-palette PNG (grayscale,
 * grayscale+alpha, RGB, or RGBA) — the shape Gemini's image endpoint actually
 * returns. Anything outside that (16-bit, palette, interlaced, or a decode error)
 * reports `supported: false` rather than guessing, and the caller must treat that
 * as "cannot judge this one," never as "reject this one."
 */

type PngHeader = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
};

export type PngLuminanceSample =
  { supported: true; variance: number; meanLuminance: number } | { supported: false };

function readPngChunks(bytes: Uint8Array): Array<{ type: string; data: Uint8Array }> {
  const chunks: Array<{ type: string; data: Uint8Array }> = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8; // past the 8-byte PNG signature
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.byteLength) break; // truncated chunk — stop, don't guess
    chunks.push({ type, data: bytes.subarray(dataStart, dataEnd) });
    offset = dataEnd + 4; // skip the trailing CRC32
    if (type === 'IEND') break;
  }
  return chunks;
}

function parseIhdr(data: Uint8Array): PngHeader {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    width: view.getUint32(0),
    height: view.getUint32(4),
    bitDepth: data[8]!,
    colorType: data[9]!,
    interlace: data[12]!,
  };
}

/** PNG's IDAT payload is zlib (RFC 1950), which wraps a raw deflate stream —
 *  `DecompressionStream('deflate')` inflates the deflate body directly.
 *  `Blob` requires an `ArrayBuffer`-backed view (not the wider `ArrayBufferLike`
 *  a `Uint8Array`'s `.buffer` types to), so this copies onto a fresh one first. */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const owned = new Uint8Array(data); // copy onto a plain, non-shared ArrayBuffer
  const stream = new Blob([owned]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Channels per pixel for the PNG color types this sampler supports. Palette (3) is
 *  deliberately excluded — its bytes are indices into a color table, not luminance. */
function channelsForColorType(colorType: number): number {
  switch (colorType) {
    case 0:
      return 1; // grayscale
    case 2:
      return 3; // RGB
    case 4:
      return 2; // grayscale + alpha
    case 6:
      return 4; // RGBA
    default:
      return 0; // palette (3) or unknown
  }
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Reverses PNG's per-scanline filtering (RFC 2083 §6). Returns null on anything
 *  that doesn't fit the expected byte layout rather than producing garbage pixels. */
function unfilterScanlines(
  raw: Uint8Array,
  header: PngHeader,
  channels: number
): Uint8Array | null {
  const bytesPerPixel = Math.ceil((channels * header.bitDepth) / 8);
  const bytesPerScanline = Math.ceil((channels * header.bitDepth * header.width) / 8);
  const stride = bytesPerScanline + 1; // +1 leading filter-type byte per row
  if (header.height <= 0 || raw.byteLength < stride * header.height) return null;

  const out = new Uint8Array(bytesPerScanline * header.height);
  let prevRow = new Uint8Array(bytesPerScanline);

  for (let y = 0; y < header.height; y += 1) {
    const rowStart = y * stride;
    const filterType = raw[rowStart]!;
    const rowData = raw.subarray(rowStart + 1, rowStart + 1 + bytesPerScanline);
    const outRow = out.subarray(y * bytesPerScanline, (y + 1) * bytesPerScanline);

    for (let i = 0; i < bytesPerScanline; i += 1) {
      const x = rowData[i]!;
      const a = i >= bytesPerPixel ? outRow[i - bytesPerPixel]! : 0;
      const b = prevRow[i]!;
      const c = i >= bytesPerPixel ? prevRow[i - bytesPerPixel]! : 0;
      let value: number;
      switch (filterType) {
        case 0:
          value = x;
          break;
        case 1:
          value = (x + a) & 0xff;
          break;
        case 2:
          value = (x + b) & 0xff;
          break;
        case 3:
          value = (x + ((a + b) >> 1)) & 0xff;
          break;
        case 4:
          value = (x + paethPredictor(a, b, c)) & 0xff;
          break;
        default:
          return null; // unrecognized filter type — bail rather than misdecode
      }
      outRow[i] = value;
    }
    prevRow = outRow;
  }
  return out;
}

/** Grid step so a large image is sampled at up to ~64x64 points rather than every
 *  pixel — plenty of signal for "is this frame blank" without decoding cost that
 *  matters on a request already waiting on a multi-second provider call. */
function sampleStep(dimension: number): number {
  return Math.max(1, Math.floor(dimension / 64));
}

/**
 * Samples luminance across a PNG's pixels and reports its variance — near-zero
 * variance means a flat/blank frame (a common "the model returned garbage but the
 * HTTP call succeeded" failure mode that byte-size and dimension checks miss).
 *
 * Never throws. `supported: false` covers every case this narrow decoder can't
 * confidently handle (non-PNG, palette, interlaced, 16-bit, truncated, or any
 * unexpected byte layout) — callers must treat that as "no signal," not "reject."
 */
export async function samplePngLuminanceVariance(bytes: Uint8Array): Promise<PngLuminanceSample> {
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return { supported: false };
  }

  let chunks: Array<{ type: string; data: Uint8Array }>;
  try {
    chunks = readPngChunks(bytes);
  } catch {
    return { supported: false };
  }

  const ihdrChunk = chunks.find((c) => c.type === 'IHDR');
  if (!ihdrChunk || ihdrChunk.data.byteLength < 13) return { supported: false };
  const header = parseIhdr(ihdrChunk.data);

  // Scope guard: only the shape Gemini actually returns is supported.
  if (header.bitDepth !== 8 || header.interlace !== 0) return { supported: false };
  const channels = channelsForColorType(header.colorType);
  if (channels === 0) return { supported: false };
  if (header.width <= 0 || header.height <= 0) return { supported: false };

  const idatChunks = chunks.filter((c) => c.type === 'IDAT');
  if (idatChunks.length === 0) return { supported: false };
  const totalLen = idatChunks.reduce((sum, c) => sum + c.data.byteLength, 0);
  const compressed = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of idatChunks) {
    compressed.set(c.data, pos);
    pos += c.data.byteLength;
  }

  let raw: Uint8Array;
  try {
    raw = await inflate(compressed);
  } catch {
    return { supported: false };
  }

  const pixels = unfilterScanlines(raw, header, channels);
  if (!pixels) return { supported: false };

  const bytesPerPixel = Math.ceil((channels * header.bitDepth) / 8);
  const bytesPerScanline = Math.ceil((channels * header.bitDepth * header.width) / 8);
  const stepX = sampleStep(header.width);
  const stepY = sampleStep(header.height);

  let count = 0;
  let sum = 0;
  let sumSquares = 0;

  for (let y = 0; y < header.height; y += stepY) {
    const rowOffset = y * bytesPerScanline;
    for (let x = 0; x < header.width; x += stepX) {
      const pixelOffset = rowOffset + x * bytesPerPixel;
      let luminance: number;
      if (channels === 1 || channels === 2) {
        luminance = pixels[pixelOffset]!;
      } else {
        const r = pixels[pixelOffset]!;
        const g = pixels[pixelOffset + 1]!;
        const b = pixels[pixelOffset + 2]!;
        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      sum += luminance;
      sumSquares += luminance * luminance;
      count += 1;
    }
  }

  if (count === 0) return { supported: false };
  const mean = sum / count;
  const variance = sumSquares / count - mean * mean;

  return { supported: true, variance: Math.max(0, variance), meanLuminance: mean };
}
