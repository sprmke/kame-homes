import { captureError } from '@/lib/sentry/capture';

import { edgeFunctionName } from './edgeRequestId';

/**
 * One report per broken edge call, at the shared wrappers only.
 *
 * A failed edge call is a fault when the server broke (5xx) or the request never landed
 * (status 0 while the browser believes it is online). Everything else is an outcome the
 * caller already handles:
 *
 * - 4xx is the handler answering correctly. Validation, 401 step-up, 409 race, 429 quota
 *   are all normal traffic; reporting them would bury the real faults.
 * - Offline is expected. `navigator.onLine === false` means the user's connection dropped,
 *   not that the platform failed.
 *
 * Fingerprint is `['edge', fn, statusBucket]` so one broken endpoint is one issue instead
 * of thousands of one-offs.
 */

export type EdgeFailure = {
  /** Request path, with or without a leading slash and query string. */
  path: string;
  /** HTTP status, or 0 for a transport/network failure. */
  status: number;
  method?: string;
  requestId?: string | null;
};

function isReportable(status: number): boolean {
  if (status === 0) return typeof navigator === 'undefined' || navigator.onLine !== false;
  return status >= 500;
}

function statusBucket(status: number): string {
  if (status === 0) return 'network';
  return `${Math.floor(status / 100)}xx`;
}

export function reportEdgeFailure(failure: EdgeFailure): void {
  if (!isReportable(failure.status)) return;

  const fn = edgeFunctionName(failure.path);
  if (!fn) return;

  const networkFailure = failure.status === 0;
  const label = networkFailure ? 'network failure' : `HTTP ${failure.status}`;

  captureError(new Error(`Edge call failed: ${fn} (${label})`), {
    level: 'error',
    tags: {
      fn,
      http_status: String(failure.status),
      ...(failure.requestId ? { request_id: failure.requestId } : {}),
    },
    extra: {
      edge_path: failure.path.split('?')[0] ?? failure.path,
      ...(failure.method ? { method: failure.method } : {}),
    },
    fingerprint: ['edge', fn, statusBucket(failure.status)],
  });
}
