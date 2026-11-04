/**
 * Incremental SHA-256 for large files. `crypto.subtle.digest` needs the whole buffer in memory,
 * which is too much for a 150 MB video on a phone; this hashes in chunks.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export class Sha256 {
  private readonly h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly block = new Uint8Array(64);
  private readonly w = new Uint32Array(64);
  private blockLength = 0;
  private totalLength = 0;
  private finished = false;

  update(data: Uint8Array): this {
    if (this.finished) throw new Error('Sha256: already finalized');
    this.totalLength += data.length;
    let offset = 0;
    if (this.blockLength > 0) {
      const take = Math.min(64 - this.blockLength, data.length);
      this.block.set(data.subarray(0, take), this.blockLength);
      this.blockLength += take;
      offset = take;
      if (this.blockLength === 64) {
        this.compress(this.block, 0);
        this.blockLength = 0;
      }
    }
    while (offset + 64 <= data.length) {
      this.compress(data, offset);
      offset += 64;
    }
    if (offset < data.length) {
      this.block.set(data.subarray(offset), 0);
      this.blockLength = data.length - offset;
    }
    return this;
  }

  /** Lowercase hex digest. The instance cannot be reused afterwards. */
  digestHex(): string {
    if (!this.finished) {
      const bitsHigh = Math.floor((this.totalLength * 8) / 0x100000000);
      const bitsLow = (this.totalLength * 8) >>> 0;
      const pad = new Uint8Array(
        this.blockLength < 56 ? 64 - this.blockLength : 128 - this.blockLength
      );
      pad[0] = 0x80;
      const view = new DataView(pad.buffer);
      view.setUint32(pad.length - 8, bitsHigh);
      view.setUint32(pad.length - 4, bitsLow);
      const total = this.totalLength;
      this.update(pad);
      this.totalLength = total;
      this.finished = true;
    }
    return Array.from(this.h, (word) => word.toString(16).padStart(8, '0')).join('');
  }

  private compress(data: Uint8Array, offset: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = (data[j]! << 24) | (data[j + 1]! << 16) | (data[j + 2]! << 8) | data[j + 3]!;
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = this.h as unknown as number[] as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + K[i]! + w[i]!) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    const s = this.h;
    s[0] = (s[0]! + a) | 0;
    s[1] = (s[1]! + b) | 0;
    s[2] = (s[2]! + c) | 0;
    s[3] = (s[3]! + d) | 0;
    s[4] = (s[4]! + e) | 0;
    s[5] = (s[5]! + f) | 0;
    s[6] = (s[6]! + g) | 0;
    s[7] = (s[7]! + h) | 0;
  }
}

export function sha256HexOfBytes(bytes: Uint8Array): string {
  return new Sha256().update(bytes).digestHex();
}

const CHUNK = 4 * 1024 * 1024;

/** SHA-256 of a Blob/File, read in 4 MB slices. Aborts promptly and reports 0..1 progress. */
export async function sha256HexOfBlob(
  blob: Blob,
  options: { signal?: AbortSignal; onProgress?: (progress: number) => void } = {}
): Promise<string> {
  const hash = new Sha256();
  for (let offset = 0; offset < blob.size; offset += CHUNK) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const chunk = new Uint8Array(await blob.slice(offset, offset + CHUNK).arrayBuffer());
    hash.update(chunk);
    options.onProgress?.(Math.min(1, (offset + chunk.length) / Math.max(1, blob.size)));
  }
  return hash.digestHex();
}
