import { clientIpFromRequest } from './publicRateLimit.ts';

Deno.test('clientIpFromRequest prefers cf-connecting-ip over x-forwarded-for', () => {
  const req = new Request('https://example.com', {
    headers: {
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.99',
    },
  });
  if (clientIpFromRequest(req) !== '203.0.113.10') {
    throw new Error('expected cf-connecting-ip');
  }
});

Deno.test('clientIpFromRequest falls back to x-real-ip', () => {
  const req = new Request('https://example.com', {
    headers: {
      'x-real-ip': '203.0.113.20',
      'x-forwarded-for': '198.51.100.99',
    },
  });
  if (clientIpFromRequest(req) !== '203.0.113.20') {
    throw new Error('expected x-real-ip');
  }
});
