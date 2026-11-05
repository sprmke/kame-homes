/**
 * k6 controlled booking write scenario.
 *
 * Writes are opt-in twice: `ALLOW_WRITES=1` and a real `BOOKING_PAYLOAD_FILE`
 * containing a valid `submit-form` JSON body for the target hosted-dev property.
 * Without both, the script exits before sending anything.
 *
 *   FUNCTIONS_URL=https://fworvijbrwpyngycotbz.supabase.co/functions/v1 \
 *   ANON_KEY=... ALLOW_WRITES=1 BOOKING_PAYLOAD_FILE=./tmp/booking.json \
 *   VUS=5 HOLD=1m k6 run scripts/performance/load-test/write-path.js
 *
 * Run only against hosted dev with a synthetic seed. Guests, emails, and
 * vendors must be test-only; never point this at production.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const FN = (__ENV.FUNCTIONS_URL || '').replace(/\/$/, '');
const ANON = __ENV.ANON_KEY || '';
const VUS = Number(__ENV.VUS || 1);
const HOLD = __ENV.HOLD || '15s';
const PAYLOAD_FILE = __ENV.BOOKING_PAYLOAD_FILE || '';

if (__ENV.ALLOW_WRITES !== '1')
  throw new Error('Writes are off. Set ALLOW_WRITES=1 only for hosted-dev synthetic runs.');
if (!FN || !ANON || !PAYLOAD_FILE) throw new Error('Set FUNCTIONS_URL, ANON_KEY and BOOKING_PAYLOAD_FILE.');
if (/kamespace\.com/.test(FN))
  throw new Error('Refusing to write to production.');

const body = open(PAYLOAD_FILE);
const created = new Rate('booking_created');
http.setResponseCallback(http.expectedStatuses(200, 201, 409, 429));

export const options = {
  scenarios: {
    submit: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: HOLD, target: VUS },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{expected_response:true}': ['p(95)<3000'],
  },
};

const headers = {
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
  'Content-Type': 'application/json',
};

export default function () {
  const res = http.post(`${FN}/submit-form`, body, { headers, tags: { endpoint: 'submit-form' } });
  created.add(res.status === 200 || res.status === 201);
  check(res, { 'accepted or throttled': (x) => [200, 201, 409, 429].includes(x.status) });
  sleep(3 + Math.random() * 4);
}
