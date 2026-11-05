/**
 * Thin client for the `marketing-media` edge function. Every call is property-scoped and
 * authenticated; failures become `MarketingMediaApiError` so callers can branch on `code` and
 * `upgradeHook` (plan limit) without parsing strings.
 */

import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import type {
  MarketingMediaAsset,
  MarketingMediaKind,
  MarketingMediaLimitCode,
  MarketingMediaListFilter,
  MarketingMediaPage,
  MarketingMediaUsage,
  ReserveResponse,
} from '@/features/dashboard/marketing/lib/media/marketingMediaTypes';

export class MarketingMediaApiError extends Error {
  readonly status: number;
  readonly code?: MarketingMediaLimitCode | string;
  readonly upgradeHook: boolean;

  constructor(message: string, status: number, code?: string, upgradeHook = false) {
    super(message);
    this.name = 'MarketingMediaApiError';
    this.status = status;
    this.code = code;
    this.upgradeHook = upgradeHook;
  }
}

type Envelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  code?: string;
  upgradeHook?: boolean;
};

async function request<T>(
  propertyId: string,
  path: string,
  init: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    query?: Record<string, string | undefined>;
  } = {}
): Promise<T> {
  const jwt = await getSessionJwt();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  const url = scopedFunctionsUrl(
    `/marketing-media${path}${suffix ? `?${suffix}` : ''}`,
    propertyId
  );

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    signal: init.signal,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  let json: Envelope<T> = {};
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    // Non-JSON body (gateway error): fall through to the status message.
  }
  if (!res.ok || json.success === false || json.data === undefined) {
    throw new MarketingMediaApiError(
      json.error ?? `Request failed (${res.status})`,
      res.status,
      json.code,
      json.upgradeHook === true
    );
  }
  return json.data;
}

export function fetchMarketingMediaPage(
  propertyId: string,
  filter: MarketingMediaListFilter,
  cursor: string | null,
  signal?: AbortSignal
): Promise<MarketingMediaPage> {
  return request<MarketingMediaPage>(propertyId, '', {
    signal,
    query: {
      kind: filter.kind,
      source: filter.source,
      q: filter.q?.trim() || undefined,
      cursor: cursor ?? undefined,
    },
  });
}

export function fetchMarketingMediaUsage(
  propertyId: string,
  signal?: AbortSignal
): Promise<MarketingMediaUsage> {
  return request<MarketingMediaUsage>(propertyId, '/usage', { signal });
}

/** How many saved designs use each asset (by id). Missing ids count as 0. */
export async function fetchMarketingMediaUsedIn(
  propertyId: string,
  ids: string[],
  signal?: AbortSignal
): Promise<Record<string, number>> {
  const data = await request<{ counts: Record<string, number> }>(propertyId, '/used-in', {
    signal,
    query: { ids: ids.join(',') },
  });
  return data.counts ?? {};
}

export type ReserveInput = {
  kind: MarketingMediaKind;
  mime: string;
  bytes: number;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  hash: string;
  fileName: string;
};

export function reserveMarketingMediaUpload(
  propertyId: string,
  input: ReserveInput,
  signal?: AbortSignal
): Promise<ReserveResponse> {
  return request<ReserveResponse>(propertyId, '/reserve', {
    method: 'POST',
    signal,
    body: {
      ...input,
      durationMs: input.durationMs ?? undefined,
      width: input.width ?? undefined,
      height: input.height ?? undefined,
    },
  });
}

export function finalizeMarketingMediaUpload(
  propertyId: string,
  assetId: string,
  peaks?: string,
  signal?: AbortSignal
): Promise<{ deduped?: boolean; asset: MarketingMediaAsset }> {
  return request(propertyId, '/finalize', { method: 'POST', body: { assetId, peaks }, signal });
}

export function abandonMarketingMediaUpload(
  propertyId: string,
  assetId: string
): Promise<{ abandoned: boolean }> {
  return request(propertyId, '/abandon', { method: 'POST', body: { assetId } });
}

export function deleteMarketingMedia(
  propertyId: string,
  ids: string[]
): Promise<{ deleted: string[]; purgeAfter: string }> {
  return request(propertyId, '', { method: 'DELETE', body: { ids } });
}

export function restoreMarketingMedia(
  propertyId: string,
  ids: string[]
): Promise<{ restored: string[] }> {
  return request(propertyId, '/restore', { method: 'POST', body: { ids } });
}

/**
 * PUT bytes to a signed Storage upload URL with progress and abort. Supabase's signed upload
 * endpoint takes multipart form data (`cacheControl` + the file under an empty field name).
 */
export function putToSignedUrl(
  uploadUrl: string,
  blob: Blob,
  options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new MarketingMediaApiError('Upload failed', xhr.status));
    };
    xhr.onerror = () =>
      reject(new MarketingMediaApiError('Network error during upload', 0, 'network'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    const onAbort = () => xhr.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    xhr.onloadend = () => options.signal?.removeEventListener('abort', onAbort);

    const form = new FormData();
    form.append('cacheControl', '31536000');
    form.append('', blob);
    xhr.send(form);
  });
}
