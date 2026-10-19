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
BASE_URL=https://dev.kamehomes.space FUNCTIONS_URL=https://<dev-ref>.supabase.co/functions/v1 \
ANON_KEY=... PROPERTY_SLUG=<listing-slug> VUS=50 HOLD=8m k6 run scripts/performance/load-test/public-api.js
```

Default is 1 VU / 30s and **public GET only** so an accidental run cannot write or hit third parties. Raise `VUS` / `DURATION` only against hosted-dev with the large-tenant seed (doc 10) and with third parties mocked at the edge.

## What this does not do yet

- Host dashboard writes, booking transitions, inbox, or AI.
- A measured first-fail component (needs hosted-dev + seed).
- Feeding numbers into docs 27 / 30.
