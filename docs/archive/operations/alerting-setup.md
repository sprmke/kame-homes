---
title: 'Alerting setup'
status: active
tags: [operations, observability, alerting]
updated: 2026-09-22
---

# Alerting setup

**Operator task.** The code is shipped and inert; it stays a no-op until the two accounts below exist and their values are set. Until then nothing pages when production breaks.

Context: production-readiness [`30-availability-and-recovery.md`](../../workflow/planned/production-readiness-checklist/30-availability-and-recovery.md) records that no pager, uptime monitor or watched channel exists today, and [`incident-response.md`](./incident-response.md) states on-call is "whoever is awake." This closes the detection half of that gap.

---

## 1. Uptime monitor (no code, do this first)

`get-health` already ships and needs nothing added. It returns `200` with `{status, version, db}` and `503` when the DB probe fails, is rate-limited to 60/min, and leaks nothing.

| Setting      | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| URL          | `https://<project-ref>.supabase.co/functions/v1/get-health`          |
| Method       | `GET`                                                                |
| Interval     | 1–5 min (stay under the 60/min limit)                                |
| Up condition | HTTP `200`                                                           |
| Alert after  | 2 consecutive failures (one blip on a cold isolate is not an outage) |

Any provider works (Better Stack, UptimeRobot, Pingdom). Point it at hosted dev first to confirm the alert path delivers before relying on it for production.

**Verify it works:** the alert must fire when the endpoint is down. An untested monitor is an assumption, not coverage — the same trap [`30-availability-and-recovery.md`](../../workflow/planned/production-readiness-checklist/30-availability-and-recovery.md) flags for the never-rehearsed restore.

---

## 2. Sentry

Create **two** projects so a browser crash loop cannot drown out edge alerts:

| Project        | Platform       | DSN goes in                        |
| -------------- | -------------- | ---------------------------------- |
| Edge functions | Deno / generic | Supabase Edge secret `SENTRY_DSN`  |
| Browser SPA    | JavaScript     | Vercel build env `VITE_SENTRY_DSN` |

Setting each secret is all that is required — no redeploy of application logic, though the browser DSN is read at build time so the UI needs a rebuild to pick it up.

### Three alert rules, deliberately few

Alert fatigue is the failure mode that makes alerting worthless. Start here and add only when a real incident proves a gap:

1. **Health check down** — from the uptime monitor above, not Sentry.
2. **Edge 5xx spike** — Sentry, edge project: new issue, or issue rate above your normal baseline. Note that after the `EdgeError` change, unexpected faults correctly report as 500; routine validation stays 400 and will not page.
3. **Browser exception spike** — Sentry, browser project. Expect noise from extensions and old cached bundles; tune the threshold after a week of real data rather than guessing now.

### What the code already guarantees

- **Both are optional.** Unset DSN → no-op. Malformed DSN → logged once, disabled, never throws.
- **Telemetry cannot break a request.** Every entry point swallows its own errors; the edge settles PostHog and Sentry in parallel so a slow vendor cannot delay a response.
- **PII is stripped** via the shared denylist (`posthogSanitize.ts`), reused rather than duplicated so the two cannot drift. URLs are redacted before they leave (`sanitizeUrlForTelemetry`) — capability tokens live in query strings on guest routes.
- **CSP is ready** — `ui/vercel.json` `connect-src` allows `*.ingest.sentry.io` (plus the `us`/`de` regional hosts). A DSN on any other host needs a matching entry, or it will break when CSP moves from Report-Only to enforcing (doc 22).

---

## Why Sentry when PostHog already captures exceptions

PostHog keeps the exception history and stays the product-analytics system of record. It is not the alerting path here because PostHog alert configuration is operator-blocked ([doc 28](../../workflow/planned/production-readiness-checklist/28-analytics.md)). Both receive every captured error from the same choke point, so this is additive — if PostHog alerting is configured later, the Sentry rules can be retired without touching handler code.

---

## Related

- [`incident-response.md`](./incident-response.md) — what to do once an alert fires
- [`docs/architecture/edge-functions.md`](../../architecture/edge-functions.md) — error status contract and the logging/correlation-id contract
- [`docs/architecture/validation-and-env.md`](../../architecture/validation-and-env.md) — `SENTRY_DSN` / `VITE_SENTRY_DSN` reference
