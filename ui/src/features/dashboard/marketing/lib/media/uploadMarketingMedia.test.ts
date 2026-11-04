import { describe, expect, it, vi } from 'vitest';

import { MarketingMediaApiError } from '@/features/dashboard/marketing/lib/media/marketingMediaApi';
import type {
  MarketingMediaAsset,
  MarketingMediaUsage,
} from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import { PrepareError } from '@/features/dashboard/marketing/lib/media/prepareMarketingMedia';
import {
  encodePeaks,
  isAbort,
  isRetryableUploadError,
  runMarketingMediaUpload,
  type UploadDeps,
} from '@/features/dashboard/marketing/lib/media/uploadMarketingMedia';
import { DEFAULT_PLAN_FEATURES } from '@/features/dashboard/plans/lib/planFeatures';

const MB = 1024 * 1024;
const limits = { ...DEFAULT_PLAN_FEATURES.marketingMediaLibrary, maxFiles: 5, dailyUploads: 5 };
const usage = (over: Partial<MarketingMediaUsage> = {}): MarketingMediaUsage => ({
  usedBytes: 0,
  files: 0,
  uploadsToday: 0,
  limits,
  ...over,
});

const asset = (id = 'a1'): MarketingMediaAsset => ({
  id,
  kind: 'image',
  source: 'upload',
  fileName: 'a.png',
  mimeType: 'image/png',
  url: 'https://x/a.png',
  posterUrl: null,
  sizeBytes: 10,
  width: 1,
  height: 1,
  durationMs: null,
  peaks: null,
  createdAt: '2026-11-01T00:00:00Z',
});

const prepared = (over: Record<string, unknown> = {}) => ({
  kind: 'image' as const,
  file: new File([new Uint8Array(1000)], 'a.png', { type: 'image/png' }),
  mime: 'image/png',
  width: 10,
  height: 10,
  durationMs: null,
  poster: null,
  peaks: null,
  optimized: false,
  originalBytes: 1000,
  ...over,
});

function makeDeps(
  over: Partial<UploadDeps> = {}
): UploadDeps & Record<string, ReturnType<typeof vi.fn>> {
  const deps = {
    prepare: vi.fn(async () => prepared()),
    hash: vi.fn(async () => 'h'.repeat(64)),
    reserve: vi.fn(async () => ({
      deduped: false as const,
      assetId: 'a1',
      uploadUrl: 'https://up/original',
      token: 't',
      path: 'p',
      poster: null,
    })),
    put: vi.fn(async () => undefined),
    finalize: vi.fn(async () => ({ asset: asset(), deduped: false })),
    abandon: vi.fn(async () => ({ abandoned: true })),
    sleep: vi.fn(async () => undefined),
    ...over,
  };
  return deps as never;
}

const file = new File([new Uint8Array(2000)], 'photo.png', { type: 'image/png' });
const base = { propertyId: 'prop-1', file, usage: usage() };

describe('runMarketingMediaUpload happy path', () => {
  it('prepares, hashes, reserves, uploads and finalizes in order, reporting progress', async () => {
    const deps = makeDeps();
    const stages: string[] = [];
    const result = await runMarketingMediaUpload({
      ...base,
      deps,
      onProgress: ({ stage }) => {
        if (stages.at(-1) !== stage) stages.push(stage);
      },
    });
    expect(result).toEqual({ asset: asset(), deduped: false });
    expect(stages).toEqual(['preparing', 'hashing', 'reserving', 'uploading', 'finishing']);
    expect(deps.reserve).toHaveBeenCalledWith(
      'prop-1',
      expect.objectContaining({
        kind: 'image',
        bytes: 1000,
        hash: 'h'.repeat(64),
        fileName: 'photo.png',
      }),
      undefined
    );
    expect(deps.put).toHaveBeenCalledTimes(1);
    expect(deps.abandon).not.toHaveBeenCalled();
  });

  it('returns the existing asset without uploading when the server dedupes', async () => {
    const deps = makeDeps({
      reserve: vi.fn(async () => ({ deduped: true as const, asset: asset('old') })),
    });
    const result = await runMarketingMediaUpload({ ...base, deps });
    expect(result).toEqual({ asset: asset('old'), deduped: true });
    expect(deps.put).not.toHaveBeenCalled();
    expect(deps.finalize).not.toHaveBeenCalled();
    expect(deps.abandon).not.toHaveBeenCalled();
  });

  it('uploads the poster first and sends audio peaks at finalize', async () => {
    const calls: string[] = [];
    const deps = makeDeps({
      prepare: vi.fn(async () =>
        prepared({ kind: 'video', poster: new Blob(['p']), peaks: null, durationMs: 5000 })
      ),
      reserve: vi.fn(async () => ({
        deduped: false as const,
        assetId: 'v1',
        uploadUrl: 'https://up/original',
        token: 't',
        path: 'p',
        poster: { uploadUrl: 'https://up/poster', token: 't', path: 'pp' },
      })),
      put: vi.fn(async (url: string) => void calls.push(url)),
    });
    await runMarketingMediaUpload({ ...base, deps });
    expect(calls).toEqual(['https://up/poster', 'https://up/original']);

    const audio = makeDeps({
      prepare: vi.fn(async () => prepared({ kind: 'audio', peaks: [0, 0.5, 1] })),
    });
    await runMarketingMediaUpload({ ...base, deps: audio });
    expect(audio.finalize).toHaveBeenCalledWith(
      'prop-1',
      'a1',
      btoa(String.fromCharCode(0, 128, 255)),
      undefined
    );
  });

  it('a failed poster upload does not fail the upload', async () => {
    const deps = makeDeps({
      prepare: vi.fn(async () =>
        prepared({ kind: 'video', poster: new Blob(['p']), durationMs: 1000 })
      ),
      reserve: vi.fn(async () => ({
        deduped: false as const,
        assetId: 'v1',
        uploadUrl: 'https://up/original',
        token: 't',
        path: 'p',
        poster: { uploadUrl: 'https://up/poster', token: 't', path: 'pp' },
      })),
      put: vi.fn(async (url: string) => {
        if (url.endsWith('poster')) throw new MarketingMediaApiError('nope', 400);
      }),
    });
    await expect(runMarketingMediaUpload({ ...base, deps })).resolves.toBeTruthy();
  });
});

describe('local plan limits', () => {
  it('rejects before any work when the daily or file allowance is used up', async () => {
    const deps = makeDeps();
    await expect(
      runMarketingMediaUpload({ ...base, usage: usage({ uploadsToday: 5 }), deps })
    ).rejects.toMatchObject({ code: 'daily_limit', upgradeHook: true, status: 403 });
    await expect(
      runMarketingMediaUpload({ ...base, usage: usage({ files: 5 }), deps })
    ).rejects.toMatchObject({ code: 'too_many_files' });
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(deps.reserve).not.toHaveBeenCalled();
  });

  it('counts the batch queue in the daily check', async () => {
    const deps = makeDeps();
    await expect(
      runMarketingMediaUpload({
        ...base,
        usage: usage({ uploadsToday: 3 }),
        pending: { bytes: 0, files: 2 },
        deps,
      })
    ).rejects.toMatchObject({ code: 'daily_limit' });
  });

  it('checks the optimized size, not the original, and never reserves when it still does not fit', async () => {
    // 11 MB reported through a spoofed size getter to avoid allocating it.
    const big = new File([new Uint8Array(1)], 'big.png');
    Object.defineProperty(big, 'size', { value: 11 * MB });
    const deps = makeDeps({ prepare: vi.fn(async () => prepared({ file: big })) });
    await expect(runMarketingMediaUpload({ ...base, deps })).rejects.toMatchObject({
      code: 'file_too_large',
    });
    expect(deps.reserve).not.toHaveBeenCalled();

    const longVideo = makeDeps({
      prepare: vi.fn(async () => prepared({ kind: 'video', durationMs: 31_000 })),
    });
    await expect(runMarketingMediaUpload({ ...base, deps: longVideo })).rejects.toMatchObject({
      code: 'video_too_long',
    });

    const full = makeDeps();
    await expect(
      runMarketingMediaUpload({ ...base, usage: usage({ usedBytes: 100 * MB - 500 }), deps: full })
    ).rejects.toMatchObject({ code: 'storage_full' });
    expect(full.reserve).not.toHaveBeenCalled();
  });

  it('lets a file through when only the original, not the optimized result, would not fit', async () => {
    const deps = makeDeps();
    const huge = new File([new Uint8Array(1)], 'huge.png');
    Object.defineProperty(huge, 'size', { value: 40 * MB });
    await expect(runMarketingMediaUpload({ ...base, file: huge, deps })).resolves.toBeTruthy();
  });
});

describe('failure handling', () => {
  it('propagates preparation errors without reserving', async () => {
    const deps = makeDeps({
      prepare: vi.fn(async () => {
        throw new PrepareError('unreadable', "We couldn't read this file.");
      }),
    });
    await expect(runMarketingMediaUpload({ ...base, deps })).rejects.toMatchObject({
      code: 'unreadable',
    });
    expect(deps.reserve).not.toHaveBeenCalled();
    expect(deps.abandon).not.toHaveBeenCalled();
  });

  it('does not abandon when reserve itself fails (nothing was reserved)', async () => {
    const deps = makeDeps({
      reserve: vi.fn(async () => {
        throw new MarketingMediaApiError('Storage is full', 403, 'storage_full', true);
      }),
    });
    await expect(runMarketingMediaUpload({ ...base, deps })).rejects.toMatchObject({
      code: 'storage_full',
    });
    expect(deps.abandon).not.toHaveBeenCalled();
  });

  it('retries transient upload failures with backoff, then succeeds', async () => {
    let attempts = 0;
    const deps = makeDeps({
      put: vi.fn(async () => {
        attempts += 1;
        if (attempts < 3) throw new MarketingMediaApiError('Network error', 0, 'network');
      }),
    });
    await runMarketingMediaUpload({ ...base, deps });
    expect(attempts).toBe(3);
    expect(deps.sleep).toHaveBeenCalledTimes(2);
    expect(deps.abandon).not.toHaveBeenCalled();
  });

  it('gives up after three tries and frees the reservation', async () => {
    const deps = makeDeps({
      put: vi.fn(async () => {
        throw new MarketingMediaApiError('Upload failed', 503);
      }),
    });
    await expect(runMarketingMediaUpload({ ...base, deps })).rejects.toMatchObject({ status: 503 });
    expect(deps.put).toHaveBeenCalledTimes(3);
    expect(deps.abandon).toHaveBeenCalledWith('prop-1', 'a1');
    expect(deps.finalize).not.toHaveBeenCalled();
  });

  it('does not retry client errors (bad signature, expired URL)', async () => {
    const deps = makeDeps({
      put: vi.fn(async () => {
        throw new MarketingMediaApiError('Forbidden', 403);
      }),
    });
    await expect(runMarketingMediaUpload({ ...base, deps })).rejects.toMatchObject({ status: 403 });
    expect(deps.put).toHaveBeenCalledTimes(1);
    expect(deps.abandon).toHaveBeenCalled();
  });

  it('abandons when finalize fails and keeps the original error', async () => {
    const deps = makeDeps({
      finalize: vi.fn(async () => {
        throw new MarketingMediaApiError('File contents do not match its type', 400);
      }),
      abandon: vi.fn(async () => {
        throw new Error('abandon also failed');
      }),
    });
    await expect(runMarketingMediaUpload({ ...base, deps })).rejects.toMatchObject({
      message: 'File contents do not match its type',
    });
    expect(deps.abandon).toHaveBeenCalled();
  });

  it('cancelling mid-upload aborts, frees the reservation and is recognized as an abort', async () => {
    const controller = new AbortController();
    const deps = makeDeps({
      put: vi.fn(async () => {
        controller.abort();
        throw new DOMException('Aborted', 'AbortError');
      }),
    });
    const error = await runMarketingMediaUpload({ ...base, deps, signal: controller.signal }).catch(
      (e) => e
    );
    expect(isAbort(error)).toBe(true);
    expect(deps.put).toHaveBeenCalledTimes(1);
    expect(deps.sleep).not.toHaveBeenCalled();
    expect(deps.abandon).toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('classifies retryable errors', () => {
    expect(isRetryableUploadError(new MarketingMediaApiError('x', 0, 'network'))).toBe(true);
    expect(isRetryableUploadError(new MarketingMediaApiError('x', 429))).toBe(true);
    expect(isRetryableUploadError(new MarketingMediaApiError('x', 502))).toBe(true);
    expect(isRetryableUploadError(new MarketingMediaApiError('x', 400))).toBe(false);
    expect(isRetryableUploadError(new DOMException('x', 'AbortError'))).toBe(false);
    expect(isRetryableUploadError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('encodes peaks as base64 bytes, capped at 1000', () => {
    expect(encodePeaks(null)).toBeUndefined();
    expect(encodePeaks([])).toBeUndefined();
    expect(encodePeaks([0, 1, 2, -1])).toBe(btoa(String.fromCharCode(0, 255, 255, 0)));
    expect(atob(encodePeaks(new Array(1500).fill(0.5))!).length).toBe(1000);
  });
});
