import { newRequestId, readServerRequestId } from './edgeRequestId';
import { reportEdgeFailure } from './reportEdgeFailure';

/**
 * Guest / public edge calls: anon key, no session, but the same correlation and failure
 * reporting as the admin wrappers.
 *
 * Before this, guest calls sent no `x-request-id`, so a guest hitting a 500 could not be
 * matched to the edge log line or the Sentry issue. That is exactly the path where a
 * support conversation starts with "it just said something went wrong".
 *
 * Content-Type is left to the caller: several callers send FormData, and forcing JSON here
 * would break the upload paths.
 */

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

function defaultHeaders(): Record<string, string> {
  return {
    ...(ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {}),
  };
}

export type PublicEdgeFetchInit = RequestInit & {
  /** Skip the failure report for an endpoint whose 5xx is expected and handled. */
  quiet?: boolean;
};

export async function publicEdgeFetch(
  path: string,
  init?: PublicEdgeFetchInit
): Promise<Response> {
  const requestId = newRequestId();
  const url = path.startsWith('http') ? path : `${FUNCTIONS_URL}/${path.replace(/^\/+/, '')}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...defaultHeaders(),
        'x-request-id': requestId,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if (!init?.quiet) reportEdgeFailure({ path, status: 0, method: init?.method, requestId });
    throw error;
  }

  if (!res.ok && !init?.quiet) {
    reportEdgeFailure({
      path,
      status: res.status,
      method: init?.method,
      requestId: readServerRequestId(res) ?? requestId,
    });
  }
  return res;
}

/** Public JSON call with the platform's `{ success, data, error }` envelope. */
export async function publicEdgeFetchJson<T>(
  path: string,
  init: PublicEdgeFetchInit | undefined,
  fallbackError: string
): Promise<T> {
  const res = await publicEdgeFetch(path, init);
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
  };

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? fallbackError);
  }
  return json.data as T;
}
