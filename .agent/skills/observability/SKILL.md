---
name: observability
description: >-
  How to instrument a feature in this repo: add a PostHog event to both catalogs,
  capture a swallowed fault to Sentry, wire a cron monitor, and verify with the
  guards and the live drill. Mirrors always-on Cursor rule observability.mdc. Use
  whenever a change adds a user-facing action, a new edge function, a cron, a
  webhook, or error handling.
---

# Observability — how to instrument a change

Sentry owns **faults** (something an engineer fixes). PostHog owns **outcomes** (what a user
experienced). They are joined by `request_id` and release id, never duplicated.

Full contract: `docs/architecture/observability.md`.

## Add a PostHog event

1. **Name it** `object_action`, snake_case, past tense (`review_response_posted`).
2. **Declare it in both catalogs**:
   - `ui/src/lib/posthog/catalog.ts`
   - `supabase/functions/_shared/posthogCatalog.ts` (only if the edge emits it)
     `catalogParity.test.ts` fails when an emitted name is undeclared, or when the edge catalog
     is not a subset of the browser one.
3. **Pick the runtime.** Server-decided outcome (payment, submit accepted, workflow
   transition, webhook) → emit on the **edge, after the write succeeds**. Intent and UI-only
   steps (opened, clicked, started) → browser. Never both.
4. **Browser:** `captureAppEvent('name', { ...props })`.
   **Edge:** `capturePostHogEvent('name', { logPrefix, request, properties, groups })`.
5. **Properties:** ids, enums, counts, booleans, buckets. No free text, names, emails,
   phones, URLs with query strings. Money as `amount_bucket`.
6. Send it when a fault may sit behind the outcome by including `request_id`.

Do **not** emit per keystroke, per scroll or per row. A bulk action is one event with `count`.

## Capture a fault

Report at a **choke point**, not at the call site:

| Where the fault happens                      | What to use                                    |
| -------------------------------------------- | ---------------------------------------------- |
| Edge handler throws                          | nothing — the `serve*` wrapper captures it     |
| Edge handler catches and answers its own 4xx | `captureFaultIfServerError` (classifies first) |
| Edge side effect fails, request succeeded    | `captureSideEffectFailure('email:gaf', err)`   |
| Webhook fails after signature + dedupe       | `captureSentryException` with `provider`       |
| Browser render crash                         | nothing — the boundaries capture it            |
| Failed read / write                          | nothing — the query cache captures it          |
| Failed edge call                             | nothing — the fetch wrappers capture it        |
| A `catch` you deliberately swallow           | `captureError(err, { tags, fingerprint })`     |

Rules:

- One fault, one report. If something throws to a choke point, do not capture it again.
- Fingerprint repeats: `['edge', fn, statusBucket]`, `['side_effect', name]`,
  `['provider', name, bucket]`. One broken thing must be one issue.
- `level: 'warning'` for degraded but handled (fail-open, provider 429, sampled provider
  outage). `error` for a user-visible failure.
- Never include PII. The scrub list is `ui/src/lib/telemetry/scrub.ts` +
  `_shared/telemetryScrub.ts`, kept identical by a parity test.

## Add a cron

1. Register it in `_shared/systemHealth/jobsRegistry.ts` so `/admin/health` shows last run
   and last status.
2. Sentry cron monitors are capped at **one** on the current plan and it is taken
   (`sd-refund-cron`). Another cron gets no Sentry monitor; `cronMonitorConfig_test.ts` fails
   if a second starts sending check-ins.

## Verify

```bash
bun run check:posthog-analytics-only   # no exception capture in PostHog
bun run check:sentry-imports           # SDK imported only inside lib/sentry
bun run test                           # catalog + scrub parity
bun run type-check
```

Live drill (deliberate errors, 9 steps): `docs/guides/testing/observability-manual.md`.

## Do not

- Add `captureException` / `$exception` to PostHog — the helper no longer exists and CI
  blocks it.
- Emit `activity_log` from either vendor, or a telemetry event to replace it.
- Feed the host Analytics module (occupancy / ADR / RevPAR) from PostHog.
- Use PostHog feature flags for plan or RBAC gates.
