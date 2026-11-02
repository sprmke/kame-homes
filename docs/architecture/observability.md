---
title: Observability — faults vs outcomes
status: in-progress
tags: [architecture, observability, sentry, posthog]
updated: 2026-11-01
---

# Observability — faults vs outcomes

Each vendor has exactly one job. Anything that crosses that line is a bug in how we
instrument, not a preference.

| Vendor      | Owns                                                                                                     | Never does                                         |
| ----------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Sentry**  | Exceptions, crashes, failed requests, failed crons, failed webhooks, third-party faults, alerts, tracing | Product analytics, funnels, feature flags          |
| **PostHog** | Pageviews, named product events, funnels, identify, groups, (masked) session replay when enabled         | Exception capture, error alerts, error source maps |

Full plan and phase order: `docs/workflow/planned/observability-sentry-posthog-split/`.
Org: **`kame-tech`** (US). Projects: **`kame-homes-web`** / **`kame-homes-edge`**.
Agent skill: **`sentry`**. OpenCode MCP: `opencode mcp auth sentry`.

## The rule

- **Fault** = something an engineer must fix. Exception, 5xx, provider outage, failed cron.
  Goes to **Sentry**, once.
- **Outcome** = what a user experienced in a journey. `guest_form_rejected`,
  `parking_payment_failed`, `marketing_publish_failed`. Goes to **PostHog**.
- An outcome can have a fault behind it. They are joined by `request_id` and release id,
  never by sending the same event to both vendors.

An expected result is never a Sentry issue: a validation failure, a blocked captcha, a
heuristic anti-spam block, a 404 route, or a deliberate 4xx `EdgeError` is an outcome.

## Shared ids

| Field         | Browser                                            | Edge                                   |
| ------------- | -------------------------------------------------- | -------------------------------------- |
| `release`     | `VITE_APP_VERSION` (git SHA)                       | `APP_RELEASE` secret (same SHA)        |
| `environment` | `local` \| `preview` \| `production`               | same, resolved from the deployment env |
| `app_track`   | `mt` \| `legacy`                                   | same                                   |
| `request_id`  | `x-request-id` header                              | `resolveRequestId(req)`                |
| `user.id`     | Supabase auth uid, no email                        | `auth.getUser` uid, no email           |
| tenant tags   | `org_id` / `property_id` / `parking_id` UUIDs only | from the `verify*Access` result        |

`VITE_APP_VERSION` is injected by `vite.config.ts` `define` from `ui/vite-plugins/releaseId.ts`.
`APP_RELEASE` is stamped by the deploy scripts from `git rev-parse HEAD`. They must always
name the same commit, or "which deploy introduced this?" stops being answerable.

## Scrub rule

No names, emails, phone numbers, addresses, message bodies, ID or receipt contents, file
URLs, or capability-token query values reach either vendor.

The list is single-sourced:

- Browser: `ui/src/lib/telemetry/scrub.ts`
- Edge: `supabase/functions/_shared/telemetryScrub.ts`
- Parity test: `ui/src/lib/telemetry/scrubParity.test.ts`

Edge isolates cannot import from `ui/`, so the two files are duplicated by hand. Editing one
without the other fails CI.

Sentry additionally gets `sendDefaultPii: false`, IP storage off, and a project-level data
scrubber. PostHog keeps today's rule: host and super-admin email on the person profile,
never a guest's.

## Choke points

Capture at the shared seam, not at each call site. Per-call capture is only for a swallowed
failure that never reaches a choke point.

| Runtime | Seam                                                              | Phase |
| ------- | ----------------------------------------------------------------- | ----- |
| Edge    | `_shared/httpResponse.ts#handleEdgeError`, `_shared/serveEdge.ts` | S2    |
| Edge    | `_shared/serveEdge.ts#serveCronPost` (cron check-ins)             | S3    |
| Browser | `@sentry/react` init, React root hooks, error boundaries          | S1    |
| Browser | TanStack `QueryCache` / `MutationCache` `onError`                 | S1    |
| Browser | edge-call wrappers (`adminEdgeFetch`, `callEdgeFunction`)         | S1    |

PostHog analytics on the edge run after the response (`_shared/backgroundTask.ts`), never on
the response path.

## Adding a new surface

1. Decide the event: name it `object_action` (snake_case, past tense), add it to
   `ui/src/lib/posthog/catalog.ts` and, if emitted on the edge,
   `supabase/functions/_shared/posthogCatalog.ts`. Properties are ids, enums, counts,
   booleans and buckets, never free text.
2. Decide where the outcome is decided. Server-decided outcomes are emitted on the edge
   after the write succeeds. Browser is for intent and UI-only steps. Never both.
3. Decide the fault path. If the new code can throw, it must reach a choke point above.
   A swallowed failure needs an explicit `captureSentryException` with a provider or
   side-effect tag.
4. If it schedules work, give the cron a monitor (`serveCronPost` `cron` option, phase S3).
5. Mark the row N/A with a reason if the surface genuinely has neither.

## Do not

- Emit `activity_log` from either vendor, or a telemetry event to replace `activity_log`.
  Accountability records are not analytics.
- Feed the host Analytics module (occupancy / ADR / RevPAR) from PostHog.
- Use PostHog feature flags for plan or RBAC gates. Entitlements stay in `planFeatures`.
- Capture an expected user outcome as an exception.
