import { scopedAdminPath } from '@/features/dashboard/org/lib/adminApiScope';
import type { AdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';
import { scopedAssetPath } from '@/features/dashboard/org/lib/adminAssetScope';

import { supabase } from '@/lib/supabase/client';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Preserves the HTTP status (and rate-limit envelope fields) on the thrown
 * error so callers — in particular the global TanStack Query `retry`
 * predicate in App.tsx — can tell a 429 apart from any other failure.
 * Production-readiness doc 23 Phase 23.4.
 */
export class AdminEdgeFetchError extends Error {
  readonly status: number;
  readonly rateLimited: boolean;
  readonly retryAfterSec: number | null;
  /** Server-generated correlation id (doc 27 Phase 27.2) — only set on a 5xx. */
  readonly requestId: string | null;

  constructor(
    message: string,
    status: number,
    rateLimited = false,
    retryAfterSec: number | null = null,
    requestId: string | null = null
  ) {
    super(message);
    this.name = 'AdminEdgeFetchError';
    this.status = status;
    this.rateLimited = rateLimited;
    this.retryAfterSec = retryAfterSec;
    this.requestId = requestId;
  }
}

/** One id per outgoing edge call — threaded into `x-request-id` and back via `handleEdgeError`. */
function newRequestId(): string {
  return crypto.randomUUID();
}

export async function adminEdgeFetch(
  path: string,
  init?: RequestInit,
  propertyId: string | null = null
): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) throw new Error('No admin session');
  const scopedPath =
    path.includes('property_id=') || path.includes('parking_id=')
      ? path
      : scopedAdminPath(path, propertyId);
  return fetch(`${FUNCTIONS_URL}${scopedPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'x-request-id': newRequestId(),
      ...(init?.headers ?? {}),
    },
  });
}

export async function assetEdgeFetch(
  path: string,
  init: RequestInit | undefined,
  scope: AdminAssetScope
): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) throw new Error('No admin session');
  const hasScope = path.includes('property_id=') || path.includes('parking_id=');
  const scopedPath = hasScope ? path : scopedAssetPath(path, scope);
  return fetch(`${FUNCTIONS_URL}${scopedPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'x-request-id': newRequestId(),
      ...(init?.headers ?? {}),
    },
  });
}

export async function parseAdminEdgeJson<T>(res: Response, fallbackError: string): Promise<T> {
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new AdminEdgeFetchError(
      json.error ?? fallbackError,
      res.status,
      json.rateLimited === true,
      Number.isFinite(Number(json.retryAfterSec)) ? Number(json.retryAfterSec) : null,
      typeof json.requestId === 'string' ? json.requestId : null
    );
  }
  return json as T;
}

export async function adminEdgeFetchJson<T>(
  path: string,
  init: RequestInit | undefined,
  propertyId: string | null,
  fallbackError: string
): Promise<T> {
  const res = await adminEdgeFetch(path, init, propertyId);
  return parseAdminEdgeJson<T>(res, fallbackError);
}

export async function assetEdgeFetchJson<T>(
  path: string,
  init: RequestInit | undefined,
  scope: AdminAssetScope,
  fallbackError: string
): Promise<T> {
  const res = await assetEdgeFetch(path, init, scope);
  return parseAdminEdgeJson<T>(res, fallbackError);
}
