/**
 * k6 mixed public-read scenario — production-readiness doc 17 Phase 17.2.
 *
 * Public GETs only. No writes. No third-party calls.
 * Default 1 VU so this cannot accidentally load-test a shared project.
 *
 *   BASE_URL=https://<hosted-dev> k6 run scripts/performance/load-test/mixed.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || 1);
const DURATION = __ENV.DURATION || '30s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<4000'],
  },
};

if (!BASE) {
  throw new Error('Set BASE_URL to a hosted-dev preview. Never production.');
}

const PATHS = ['/', '/search', '/for-hosts'];

export default function () {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(`${BASE}${path}`, {
    headers: { Accept: 'text/html' },
    tags: { scenario: 'public_browse' },
  });
  check(res, {
    'status is 200 or 304': (r) => r.status === 200 || r.status === 304,
  });
  sleep(1);
}
