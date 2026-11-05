/**
 * One end-to-end library upload: prepare (optimize, poster, peaks) → hash → reserve quota →
 * upload straight to Storage → finalize. Pure orchestration; every side effect is injected so the
 * failure paths are unit-testable.
 *
 * Guarantees:
 *  - A file that breaks a plan limit is rejected locally, before any CPU or network is spent.
 *  - Anything that fails after the server reserved quota calls `abandon`, so retries are not
 *    blocked by a phantom reservation.
 *  - Identical bytes already in the library never upload again (server dedupe).
 *  - Aborting stops hashing, transcoding and uploading promptly.
 */

import {
  MarketingMediaApiError,
  finalizeMarketingMediaUpload,
  putToSignedUrl,
  reserveMarketingMediaUpload,
  abandonMarketingMediaUpload,
} from '@/features/dashboard/marketing/lib/media/marketingMediaApi';
import { limitErrorFor } from '@/features/dashboard/marketing/lib/media/marketingMediaRules';
import type {
  MarketingMediaAsset,
  MarketingMediaUsage,
} from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';
import {
  PrepareError,
  prepareMarketingMedia,
  type PreparedMedia,
  type PrepareStage,
} from '@/features/dashboard/marketing/lib/media/prepareMarketingMedia';
import { sha256HexOfBlob } from '@/features/dashboard/marketing/lib/media/sha256';

export type UploadStage = 'preparing' | 'hashing' | 'reserving' | 'uploading' | 'finishing';

export type UploadProgress = { stage: UploadStage; fraction: number };

export type UploadResult = { asset: MarketingMediaAsset; deduped: boolean };

export type UploadDeps = {
  prepare: typeof prepareMarketingMedia;
  hash: typeof sha256HexOfBlob;
  reserve: typeof reserveMarketingMediaUpload;
  put: typeof putToSignedUrl;
  finalize: typeof finalizeMarketingMediaUpload;
  abandon: typeof abandonMarketingMediaUpload;
  sleep: (ms: number) => Promise<void>;
};

const defaultUploadDeps: UploadDeps = {
  prepare: prepareMarketingMedia,
  hash: sha256HexOfBlob,
  reserve: reserveMarketingMediaUpload,
  put: putToSignedUrl,
  finalize: finalizeMarketingMediaUpload,
  abandon: abandonMarketingMediaUpload,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export type UploadArgs = {
  propertyId: string;
  file: File;
  /** Latest usage snapshot (limits + counters). Required for the local pre-check. */
  usage: MarketingMediaUsage;
  /** Bytes/files of other uploads already queued ahead of this one in the same batch. */
  pending?: { bytes: number; files: number };
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  deps?: Partial<UploadDeps>;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [800, 2400];

export function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof PrepareError && error.code === 'cancelled')
  );
}

/** Retry only what can succeed on a second try: network drops, 408/429 and 5xx. */
export function isRetryableUploadError(error: unknown): boolean {
  if (isAbort(error)) return false;
  if (!(error instanceof MarketingMediaApiError)) return true;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

/** Encode 0..1 peaks as one byte each, base64. At most 1000 peaks (server limit). */
export function encodePeaks(peaks: number[] | null): string | undefined {
  if (!peaks || peaks.length === 0) return undefined;
  const bytes = new Uint8Array(Math.min(1000, peaks.length));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.round(Math.min(1, Math.max(0, peaks[i]!)) * 255);
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function limitError(
  prepared: Pick<PreparedMedia, 'kind' | 'file' | 'durationMs'>,
  usage: MarketingMediaUsage,
  pending: { bytes: number; files: number }
): MarketingMediaApiError | null {
  const found = limitErrorFor(
    { kind: prepared.kind, bytes: prepared.file.size, durationMs: prepared.durationMs },
    usage,
    pending
  );
  return found ? new MarketingMediaApiError(found.message, 403, found.code, true) : null;
}

async function putWithRetry(
  deps: UploadDeps,
  url: string,
  blob: Blob,
  signal: AbortSignal | undefined,
  onProgress: (fraction: number) => void
): Promise<void> {
  let attempt = 0;
  for (;;) {
    try {
      await deps.put(url, blob, { signal, onProgress });
      return;
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_ATTEMPTS || !isRetryableUploadError(error)) throw error;
      await deps.sleep(RETRY_DELAYS_MS[attempt - 1] ?? 2400);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    }
  }
}

export async function runMarketingMediaUpload(args: UploadArgs): Promise<UploadResult> {
  const deps = { ...defaultUploadDeps, ...args.deps };
  const { propertyId, file, usage, signal } = args;
  const pending = args.pending ?? { bytes: 0, files: 0 };
  const report = (stage: UploadStage, fraction: number) => args.onProgress?.({ stage, fraction });

  // Cheap checks first: daily count, file count and storage room (bytes = 0).
  const early = limitErrorFor({ kind: 'image', bytes: 0 }, usage, pending);
  if (early && early.code !== 'storage_full') {
    throw new MarketingMediaApiError(early.message, 403, early.code, true);
  }

  report('preparing', 0);
  const prepared = await deps.prepare(file, {
    limits: usage.limits,
    signal,
    onProgress: (_stage: PrepareStage, fraction: number) => report('preparing', fraction),
  });
  const tooBig = limitError(prepared, usage, pending);
  if (tooBig) throw tooBig;

  report('hashing', 0);
  const hash = await deps.hash(prepared.file, { signal, onProgress: (f) => report('hashing', f) });

  report('reserving', 0);
  const reserved = await deps.reserve(
    propertyId,
    {
      kind: prepared.kind,
      mime: prepared.mime,
      bytes: prepared.file.size,
      durationMs: prepared.durationMs,
      width: prepared.width,
      height: prepared.height,
      hash,
      fileName: file.name,
    },
    signal
  );
  if (reserved.deduped) return { asset: reserved.asset, deduped: true };

  const assetId = reserved.assetId;
  try {
    // The poster is best effort and small: upload it first so a failed original never leaves it.
    if (prepared.poster && reserved.poster) {
      try {
        await putWithRetry(
          deps,
          reserved.poster.uploadUrl,
          prepared.poster,
          signal,
          () => undefined
        );
      } catch (error) {
        if (isAbort(error)) throw error;
      }
    }

    report('uploading', 0);
    await putWithRetry(deps, reserved.uploadUrl, prepared.file, signal, (f) =>
      report('uploading', f)
    );

    report('finishing', 0);
    const finalized = await deps.finalize(propertyId, assetId, encodePeaks(prepared.peaks), signal);
    return { asset: finalized.asset, deduped: finalized.deduped === true };
  } catch (error) {
    // Free the reservation now (best effort, never masks the original error).
    await deps.abandon(propertyId, assetId).catch(() => undefined);
    throw error;
  }
}
