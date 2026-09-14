const ALLOWED_ORIGINS = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:4173', // Vite preview
  'http://localhost:54321', // Supabase local development
  'https://guest-form-management-ui.vercel.app', // Legacy Vercel deploy
  'https://kamehomes.space', // Legacy production SPA
  'https://www.kamehomes.space',
  'https://dev.kamehomes.space', // Multi-tenant dev SPA (docs/workflow/in-progress/ci-cd-environments)
  'https://app.kamehomes.space', // Multi-tenant prod SPA (reserved ahead of cutover)
];

// Vercel preview deployments use a per-branch/per-PR subdomain of *.vercel.app —
// allow the whole family rather than hardcoding every preview URL.
const ALLOWED_ORIGIN_SUFFIXES = ['.vercel.app'];

const DEFAULT_ORIGIN = 'https://www.kamehomes.space';

/** Request headers the browser may send on a CORS-preflighted edge call. */
export const CORS_ALLOW_HEADERS = [
  'authorization',
  'apikey',
  'x-client-info',
  'content-type',
  'accept',
  // PostHog `tracing_headers` patches fetch for the functions hostname and
  // injects all three. Missing any one of them makes Chrome fail the preflight
  // with net::ERR_FAILED / TypeError: Failed to fetch (host sign-in routing
  // calls list-organizations immediately after Google/OTP).
  'x-posthog-distinct-id',
  'x-posthog-session-id',
  'x-posthog-window-id',
  'x-superadmin-otp',
  'idempotency-key',
].join(', ');

function hostnameOf(origin: string): string | null {
  try {
    return new URL(origin).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  const host = hostnameOf(origin);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (isLoopbackOrigin(origin)) return true;
  return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => origin.endsWith(suffix));
}

export const corsHeaders = (req: Request) => {
  const requestOrigin = req.headers.get('origin');
  // Non-browser callers (webhooks, cron via pg_net, curl) send no Origin header at
  // all — CORS is a browser-only concept, so the value here doesn't affect them.
  // Browser callers only get a matching Allow-Origin when their origin is allow-listed.
  const allowOrigin =
    requestOrigin && isAllowedOrigin(requestOrigin) ? requestOrigin : DEFAULT_ORIGIN;

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Max-Age': '7200', // 2 hours - Chrome's maximum limit
  };
};
