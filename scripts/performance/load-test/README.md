# Load test harness (doc 17)

k6 mixed-scenario skeleton. **Never run against production.** Never point at live Resend, Meta, PayMongo, or Gemini.

## Run

```bash
# Install k6 separately: https://k6.io/docs/get-started/installation/
export BASE_URL='https://<hosted-dev-preview>'
k6 run scripts/performance/load-test/mixed.js
```

Default is 1 VU / 30s and **public GET only** so an accidental run cannot write or hit third parties. Raise `VUS` / `DURATION` only against hosted-dev with the large-tenant seed (doc 10) and with third parties mocked at the edge.

## What this does not do yet

- Host dashboard writes, booking transitions, inbox, or AI.
- A measured first-fail component (needs hosted-dev + seed).
- Feeding numbers into docs 27 / 30.
