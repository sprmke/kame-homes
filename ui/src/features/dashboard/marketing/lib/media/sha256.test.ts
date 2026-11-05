import { describe, expect, it } from 'vitest';

import {
  Sha256,
  sha256HexOfBlob,
  sha256HexOfBytes,
} from '@/features/dashboard/marketing/lib/media/sha256';

async function reference(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('sha256', () => {
  it('matches known vectors', () => {
    expect(sha256HexOfBytes(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(sha256HexOfBytes(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(
      sha256HexOfBytes(
        new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')
      )
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('matches SubtleCrypto for every length around the block boundaries', async () => {
    for (const length of [
      1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 4096, 100_003,
    ]) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) bytes[i] = (i * 31 + length) & 255;
      expect(sha256HexOfBytes(bytes), `length ${length}`).toBe(await reference(bytes));
    }
  });

  it('gives the same digest regardless of how the input is chunked', async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 7) & 255);
    const expected = await reference(bytes);
    for (const size of [1, 3, 63, 64, 65, 1000, 69_999]) {
      const hash = new Sha256();
      for (let o = 0; o < bytes.length; o += size) hash.update(bytes.subarray(o, o + size));
      expect(hash.digestHex(), `chunk ${size}`).toBe(expected);
    }
  });

  it('refuses reuse after finalizing and is idempotent on digest', () => {
    const hash = new Sha256().update(new Uint8Array([1, 2, 3]));
    const first = hash.digestHex();
    expect(hash.digestHex()).toBe(first);
    expect(() => hash.update(new Uint8Array([4]))).toThrow();
  });

  it('hashes blobs in slices, reports progress and aborts', async () => {
    const bytes = new Uint8Array(9 * 1024 * 1024).map((_, i) => (i * 13) & 255);
    const progress: number[] = [];
    const digest = await sha256HexOfBlob(new Blob([bytes]), {
      onProgress: (p) => progress.push(p),
    });
    expect(digest).toBe(await reference(bytes));
    expect(progress.at(-1)).toBe(1);
    expect(progress.length).toBeGreaterThanOrEqual(3);

    const controller = new AbortController();
    controller.abort();
    await expect(sha256HexOfBlob(new Blob([bytes]), { signal: controller.signal })).rejects.toThrow(
      'Aborted'
    );
    expect(await sha256HexOfBlob(new Blob([]))).toBe(sha256HexOfBytes(new Uint8Array(0)));
  });
});
