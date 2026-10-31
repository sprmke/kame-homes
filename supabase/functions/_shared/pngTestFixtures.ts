/**
 * Test-only PNG builder shared by `pngPixelSampler_test.ts` and
 * `marketingImageGenerationAi_test.ts` — both need a real, valid, non-interlaced
 * 8-bit RGB PNG with known pixel content to test against ground truth, and neither
 * should hand-roll its own CRC32/chunk-writing twice.
 *
 * Not imported by any non-test file. If that ever changes, move this out of the
 * `_test`-adjacent naming and give it a real doc comment about production use.
 */

function crc32(buf: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(crcInput));
  const out = new Uint8Array(4 + typeBytes.length + data.length + 4);
  out.set(len, 0);
  out.set(typeBytes, 4);
  out.set(data, 4 + typeBytes.length);
  out.set(crc, 4 + typeBytes.length + data.length);
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const owned = new Uint8Array(data); // Blob wants an ArrayBuffer-backed view
  const stream = new Blob([owned]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Builds a minimal, valid, non-interlaced 8-bit RGB PNG with known pixel content. */
export async function buildRgbPng(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number]
): Promise<Uint8Array> {
  const bytesPerScanline = width * 3;
  const raw = new Uint8Array((bytesPerScanline + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (bytesPerScanline + 1);
    raw[rowStart] = 0; // filter type: None
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelFn(x, y);
      raw[rowStart + 1 + x * 3] = r;
      raw[rowStart + 1 + x * 3 + 1] = g;
      raw[rowStart + 1 + x * 3 + 2] = b;
    }
  }
  const compressed = await deflate(raw);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0; // interlace: none

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', new Uint8Array(0));

  const total = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let offset = 0;
  total.set(signature, offset);
  offset += signature.length;
  total.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  total.set(idatChunk, offset);
  offset += idatChunk.length;
  total.set(iendChunk, offset);
  return total;
}

/** Convenience wrapper: a solid-color PNG, or (with `varied: true`) a
 *  deterministic pseudo-random pattern with real luminance variance. */
export async function buildSolidColorPng(
  width: number,
  height: number,
  color: [number, number, number],
  varied = false
): Promise<Uint8Array> {
  if (!varied) return buildRgbPng(width, height, () => color);
  return buildRgbPng(width, height, (x, y) => [
    (x * 37 + y * 91) % 256,
    (x * 13 + y * 5) % 256,
    (x * 71 + y * 17) % 256,
  ]);
}
