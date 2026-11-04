/**
 * Hostnames load tests must never hit (production + legacy prod).
 * Vercel preview hosts stay allowed; production hosts are refused.
 */

export const REFUSED_LOAD_TEST_HOSTS = new Set([
  'kamespace.com',
  'www.kamespace.com',
  'app.kamespace.com',
  'kamehomes.space',
  'www.kamehomes.space',
  'app.kamehomes.space',
]);

export function refuseProdLoadTestBaseUrl(baseUrl) {
  let host;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid BASE_URL: ${baseUrl}`);
  }
  if (REFUSED_LOAD_TEST_HOSTS.has(host)) {
    throw new Error(`Refusing to load-test production host: ${host}`);
  }
}
