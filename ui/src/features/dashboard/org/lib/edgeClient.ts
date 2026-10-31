import { captureAppEvent } from '@/lib/posthog/capture';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Refresh only when the access token is this close to expiring (or already expired). */
const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 60;

type AuthRefreshError = { status?: number; code?: string } | null;

type RefreshResult = {
  token: string | null;
  transientFailure: boolean;
};

let refreshInFlight: Promise<RefreshResult> | null = null;

function accessTokenExpiresSoon(expiresAt: number | undefined, nowSeconds: number): boolean {
  if (typeof expiresAt !== 'number') return true;
  return expiresAt <= nowSeconds + ACCESS_TOKEN_REFRESH_MARGIN_SECONDS;
}

function isTransientAuthRefreshError(error: AuthRefreshError): boolean {
  if (!error) return false;
  const status = error.status ?? 0;
  const code = (error.code ?? '').toLowerCase();
  return status === 429 || status === 408 || status >= 500 || code === 'over_request_rate_limit';
}

async function refreshAccessTokenSingleFlight(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { supabase } = await import('@/lib/supabase/client');
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      return { token: data.session.access_token, transientFailure: false };
    }
    return { token: null, transientFailure: isTransientAuthRefreshError(error) };
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Cached JWT for edge calls. Refresh only near expiry so parallel org fetches cannot 429 Auth. */
export async function getSessionJwt(): Promise<string> {
  const { readE2EAdminAccessToken } = await import('@/lib/e2e/adminSession');
  const mockedJwt = readE2EAdminAccessToken();
  if (mockedJwt) {
    return mockedJwt;
  }

  const { supabase } = await import('@/lib/supabase/client');
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  const existingToken = session?.access_token ?? null;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (existingToken && !accessTokenExpiresSoon(session?.expires_at, nowSeconds)) {
    return existingToken;
  }

  if (session) {
    const refreshed = await refreshAccessTokenSingleFlight();
    if (refreshed.token) return refreshed.token;
    if (existingToken && refreshed.transientFailure) {
      return existingToken;
    }
  }

  await supabase.auth.signOut();
  throw new Error(existingToken ? 'Your session expired. Please sign in again.' : 'Not signed in');
}

/* ---------------------- Super Admin step-up (sudo) token --------------------- */
// A short-lived token from `super-admin-verification` that unlocks gated `/admin/*`
// mutations for a sudo window. Stored per-tab so it never outlives the session, and
// replayed as `x-superadmin-otp` on every edge call.

const SUPER_ADMIN_OTP_KEY = 'gfm.superAdminOtp';
export const SUPER_ADMIN_OTP_REQUIRED_CODE = 'SUPERADMIN_OTP_REQUIRED';

export function readSuperAdminOtpToken(): string | null {
  try {
    const raw = sessionStorage.getItem(SUPER_ADMIN_OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; expiresAt?: number };
    if (!parsed.token || !parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(SUPER_ADMIN_OTP_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function storeSuperAdminOtpToken(token: string, expiresAt: number): void {
  try {
    sessionStorage.setItem(SUPER_ADMIN_OTP_KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — the user just re-verifies more often.
  }
}

export function clearSuperAdminOtpToken(): void {
  try {
    sessionStorage.removeItem(SUPER_ADMIN_OTP_KEY);
  } catch {
    // ignore
  }
}

type SuperAdminStepUpRequester = (ctx: { action?: string; message?: string }) => Promise<boolean>;

let stepUpRequester: SuperAdminStepUpRequester | null = null;

/** Registered once by `SuperAdminStepUpProvider`; unset outside the `/admin/*` shell. */
export function registerSuperAdminStepUp(fn: SuperAdminStepUpRequester | null): void {
  stepUpRequester = fn;
}

export async function callEdgeFunction<T>(path: string, init?: RequestInit): Promise<T> {
  return callEdgeFunctionInner<T>(path, init, false);
}

async function callEdgeFunctionInner<T>(
  path: string,
  init: RequestInit | undefined,
  isStepUpRetry: boolean
): Promise<T> {
  const jwt = await getSessionJwt();
  const otpToken = readSuperAdminOtpToken();
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...(otpToken ? { 'x-superadmin-otp': otpToken } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);

  if (!res.ok || !json.success) {
    if (res.status >= 500) {
      captureAppEvent('edge_request_failed', {
        edge_path: path.split('?')[0] ?? path,
        http_status: res.status,
      });
    }

    if (
      !isStepUpRetry &&
      res.status === 401 &&
      json?.code === SUPER_ADMIN_OTP_REQUIRED_CODE &&
      stepUpRequester
    ) {
      const verified = await stepUpRequester({
        action: typeof json.action === 'string' ? json.action : undefined,
        message: typeof json.error === 'string' ? json.error : undefined,
      });
      if (verified) {
        return callEdgeFunctionInner<T>(path, init, true);
      }
    }
    throw new Error((json.error as string) ?? 'Request failed');
  }
  return json.data as T;
}
