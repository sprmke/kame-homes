/**
 * k6 authenticated host read scenario (admin dashboard traffic).
 *
 *   FUNCTIONS_URL=https://fworvijbrwpyngycotbz.supabase.co/functions/v1 \
 *   ANON_KEY=... AUTH_TOKEN=<host JWT> PROPERTY_ID=<uuid> [ORG_ID=<uuid>] \
 *   VUS=50 HOLD=5m k6 run scripts/performance/load-test/authenticated-api.js
 *
 * Read-only. Refuses production hosts. Never point at live vendors: these
 * endpoints only read Postgres/Edge, so no vendor mocks are needed.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const FN = (__ENV.FUNCTIONS_URL || '').replace(/\/$/, '');
const ANON = __ENV.ANON_KEY || '';
const TOKEN = __ENV.AUTH_TOKEN || '';
const PROPERTY_ID = __ENV.PROPERTY_ID || '';
const ORG_ID = __ENV.ORG_ID || '';
const VUS = Number(__ENV.VUS || 1);
const HOLD = __ENV.HOLD || '30s';

if (!FN || !ANON || !TOKEN)
  throw new Error('Set FUNCTIONS_URL, ANON_KEY and AUTH_TOKEN (hosted dev only).');
if (!PROPERTY_ID && !ORG_ID) throw new Error('Set PROPERTY_ID or ORG_ID.');
if (/kamespace\.com|app\.kamehomes\.space/.test(FN))
  throw new Error('Refusing to load-test production.');

const rateLimited = new Rate('rate_limited');
http.setResponseCallback(http.expectedStatuses(200, 304, 429));

export const options = {
  scenarios: {
    host_reads: {
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

const headers = { apikey: ANON, Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' };
const scope = ORG_ID ? `org_id=${ORG_ID}` : `property_id=${PROPERTY_ID}`;
const month = new Date().toISOString().slice(0, 7);
const REQUESTS = [
  {
    w: 45,
    name: 'list-bookings',
    url: () => `${FN}/list-bookings?${scope}&page=1&limit=31`,
  },
  {
    w: 25,
    name: 'dashboard-stats',
    url: () => `${FN}/dashboard-stats?${scope}`,
  },
  {
    w: 15,
    name: 'finance-summary',
    url: () => `${FN}/finance-summary?${scope}&from=${month}-01&to=${month}-28`,
  },
  {
    w: 15,
    name: 'list-bookings-page-2',
    url: () => `${FN}/list-bookings?${scope}&page=2&limit=31&sort=check_in_date:asc`,
  },
];
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
  const res = http.get(r.url(), { headers, tags: { endpoint: r.name } });
  rateLimited.add(res.status === 429, { endpoint: r.name });
  check(res, {
    'ok or rate limited': (x) => x.status === 200 || x.status === 304 || x.status === 429,
  });
  sleep(1 + Math.random() * 2);
}
