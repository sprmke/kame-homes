/**
 * k6 public read scenario with the edge functions behind the public pages (launch audit
 * Phase 8). GETs only, no writes, anon key like the browser. Hosted dev only.
 *
 *   BASE_URL=https://dev.kamehomes.space FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1 \
 *   ANON_KEY=... PROPERTY_SLUG=qa-monaco-1801 VUS=50 HOLD=8m \
 *   k6 run scripts/performance/load-test/public-api.js
 *
 * Per-IP rate limits answer 429 to a single load generator; those are counted in
 * `rate_limited`, not as failures (real visitors come from many IPs).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
const FN = (__ENV.FUNCTIONS_URL || '').replace(/\/$/, '');
const ANON = __ENV.ANON_KEY || '';
const SLUG = __ENV.PROPERTY_SLUG || '';
const VUS = Number(__ENV.VUS || 1);
const HOLD = __ENV.HOLD || '30s';

if (!BASE || !FN || !ANON)
  throw new Error('Set BASE_URL, FUNCTIONS_URL and ANON_KEY (hosted dev only).');
if (/app\.kamehomes\.space/.test(BASE)) throw new Error('Refusing to load-test production.');

const rateLimited = new Rate('rate_limited');
http.setResponseCallback(http.expectedStatuses(200, 304, 429));

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: VUS },
        { duration: HOLD, target: VUS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{expected_response:true}': ['p(95)<1500'],
  },
};

const api = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const REQUESTS = [
  {
    w: 30,
    name: 'page',
    url: () =>
      `${BASE}${['/', '/search', '/properties', '/for-hosts'][Math.floor(Math.random() * 4)]}`,
    headers: { Accept: 'text/html' },
  },
  {
    w: 25,
    name: 'list-public-properties',
    url: () => `${FN}/list-public-properties`,
    headers: api,
  },
  { w: 20, name: 'search-listings', url: () => `${FN}/search-listings`, headers: api },
  {
    w: 10,
    name: 'list-public-place-groups',
    url: () =>
      `${FN}/list-public-place-groups?family=properties&groupOffset=0&groupLimit=6&previewSize=8`,
    headers: api,
  },
  {
    w: 10,
    name: 'get-public-property',
    url: () => `${FN}/get-public-property?property=${SLUG}`,
    headers: api,
    skip: !SLUG,
  },
  { w: 5, name: 'search-suggestions', url: () => `${FN}/search-suggestions?q=ce`, headers: api },
].filter((r) => !r.skip);
const TOTAL = REQUESTS.reduce((a, r) => a + r.w, 0);

function pick() {
  let n = Math.random() * TOTAL;
  for (const r of REQUESTS) {
    n -= r.w;
    if (n <= 0) return r;
  }
  return REQUESTS[0];
}

export default function () {
  const r = pick();
  const res = http.get(r.url(), { headers: r.headers, tags: { endpoint: r.name } });
  rateLimited.add(res.status === 429, { endpoint: r.name });
  check(res, {
    'ok or rate limited': (x) => x.status === 200 || x.status === 304 || x.status === 429,
  });
  sleep(1 + Math.random());
}
