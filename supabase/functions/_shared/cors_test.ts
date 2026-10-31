import { CORS_ALLOW_HEADERS, corsHeaders, isAllowedOrigin } from './cors.ts';

function headerReq(origin: string): Request {
  return new Request('https://example.test/functions/v1/list-organizations', {
    method: 'OPTIONS',
    headers: { Origin: origin },
  });
}

Deno.test('isAllowedOrigin echoes Vite 127.0.0.1 as well as localhost', () => {
  if (!isAllowedOrigin('http://localhost:5173')) {
    throw new Error('localhost:5173 should be allowed');
  }
  if (!isAllowedOrigin('http://127.0.0.1:5173')) {
    throw new Error('127.0.0.1:5173 should be allowed');
  }
  if (!isAllowedOrigin('http://127.0.0.1:4173')) {
    throw new Error('127.0.0.1:4173 (vite preview / Playwright) should be allowed');
  }
  if (!isAllowedOrigin('http://[::1]:5173')) {
    throw new Error('[::1]:5173 should be allowed');
  }
});

Deno.test('isAllowedOrigin echoes known hosted SPA origins', () => {
  if (!isAllowedOrigin('https://dev.kamehomes.space')) {
    throw new Error('dev.kamehomes.space should be allowed');
  }
  if (!isAllowedOrigin('https://kame-homes.vercel.app')) {
    throw new Error('kame-homes.vercel.app should be allowed');
  }
});

Deno.test('isAllowedOrigin rejects a random third-party origin', () => {
  if (isAllowedOrigin('https://evil-cors-probe.example')) {
    throw new Error('third-party origin must not be allowed');
  }
  if (isAllowedOrigin('https://untrusted-preview.vercel.app')) {
    throw new Error('unlisted Vercel previews must not be allowed');
  }
});

Deno.test('corsHeaders echoes a loopback Origin and includes PostHog tracing headers', () => {
  const headers = corsHeaders(headerReq('http://127.0.0.1:5173'));
  if (headers['Access-Control-Allow-Origin'] !== 'http://127.0.0.1:5173') {
    throw new Error(`expected loopback origin echo, got ${headers['Access-Control-Allow-Origin']}`);
  }
  const allow = headers['Access-Control-Allow-Headers'].toLowerCase();
  for (const name of [
    'x-posthog-distinct-id',
    'x-posthog-session-id',
    'x-posthog-window-id',
    'idempotency-key',
  ]) {
    if (!allow.includes(name)) {
      throw new Error(`Allow-Headers missing ${name}: ${CORS_ALLOW_HEADERS}`);
    }
  }
});

Deno.test('corsHeaders does not echo a blocked Origin', () => {
  const headers = corsHeaders(headerReq('https://evil-cors-probe.example'));
  if (headers['Access-Control-Allow-Origin'] === 'https://evil-cors-probe.example') {
    throw new Error('blocked origin must not be echoed');
  }
});
