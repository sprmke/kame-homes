# Load test harness (doc 17)

k6 mixed-scenario skeleton. **Never run against production.** Never point at live Resend, Meta, PayMongo, or Gemini.

## Run

```bash
# Install k6 separately: https://k6.io/docs/get-started/installation/
export BASE_URL='https://<hosted-dev-preview>'
k6 run scripts/performance/load-test/mixed.js
```

`public-api.js` adds the public edge functions behind those pages (listings, search, place groups, listing detail, suggestions) with the anon key, ramping to `VUS` and holding for `HOLD`. Per-IP rate limits answer 429 to one load generator; those count in `rate_limited`, not as failures.

```bash
BASE_URL=https://<preview>.vercel.app FUNCTIONS_URL=https://fworvijbrwpyngycotbz.supabase.co/functions/v1 \
ANON_KEY=... PROPERTY_SLUG=<listing-slug> VUS=50 HOLD=8m k6 run scripts/performance/load-test/public-api.js
```

Default is 1 VU / 30s and **public GET only** so an accidental run cannot write or hit third parties. Raise `VUS` / `DURATION` only against hosted-dev with the large-tenant seed (doc 10) and with third parties mocked at the edge.

`authenticated-api.js` covers host dashboard reads (`list-bookings`, `dashboard-stats`, `finance-summary`, page 2 with an alternate sort). It needs a host JWT and one scope id:

```bash
FUNCTIONS_URL=... ANON_KEY=... AUTH_TOKEN=<host JWT> PROPERTY_ID=<uuid> \
VUS=50 HOLD=5m k6 run scripts/performance/load-test/authenticated-api.js
```

`write-path.js` is opt-in twice: `ALLOW_WRITES=1` **and** a valid `BOOKING_PAYLOAD_FILE`. Both scripts refuse production hosts.

## Capacity matrix to run

Record requests/s, p50/p95/p99, error rate, cache hit rate, DB CPU/memory/swap/connections, PostgREST waiting, Realtime channels, and the first failing component for each row.

| Scenario               | VUs                             |
| ---------------------- | ------------------------------- |
| `public-api.js`        | 25, 50, 100, 200                |
| `mixed.js`             | 50, 100, 200, 400               |
| `authenticated-api.js` | 25, 50, 100                     |
| `write-path.js`        | 5, 10, 25 (synthetic seed only) |

## What this does not do yet

- Inbox realtime fan-out and AI request load.
- A measured first-fail component (needs hosted-dev + seed).
- Feeding numbers into docs 27 / 30.
