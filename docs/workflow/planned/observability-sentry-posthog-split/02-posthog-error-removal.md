---
stage: planned
title: 'Observability split — 02 remove error capture from PostHog (Phase P1)'
status: planned
tags: [workflow, planned, observability, posthog, cleanup]
updated: 2026-11-01
kind: plan
---

# 02 — Phase P1: remove all error capture from PostHog

> **Status 2026-11-02:** shipped except two items. **P1.2 (build)** rides with S4, because
> removing `@posthog/rollup-plugin` and adding `@sentry/vite-plugin` is one change to
> `ui/vite.config.ts` that currently also holds another session's in-flight precache work.
> **P1.5 (PostHog project settings)** is an operator click (doc 05 §2). Everything else —
> browser, edge, env docs, legal copy and both CI guards — is done.

**Precondition:** S1 (browser Sentry) and S2 (edge Sentry) are deployed to
`dev.kamehomes.space` / mt-dev and a test error from each side is visible in Sentry.
Never remove the PostHog path before Sentry receives the same error, or there is a
window with no capture.

**Ship as one PR** so there is no half-state where some errors still double-report.

## P1.1 Browser

- [x] `ui/src/lib/posthog/client.ts`
  - Replace the `capture_exceptions: { … }` block with `capture_exceptions: false`.
  - Set `capture_performance: false` (web vitals and network timing belong to Sentry
    tracing per S1.9; avoids two sources of truth). Keep `capture_pageview` from `defaults`.
  - Keep `tracing_headers` (it links edge **analytics** events to the browser session).
  - Update the file comment: analytics only.
- [x] `ui/src/lib/posthog/capture.ts` — delete `captureAppException`; update
      `capture.test.ts`.
- [x] `ui/src/components/error/AppErrorBoundary.tsx`, `RouteErrorFallback.tsx` — remove
      the PostHog import and call; the Sentry call is replaced by the SDK call in S1.4.
- [x] `ui/src/features/dashboard/org/lib/edgeClient.ts` — remove the
      `edge_request_failed` `captureAppEvent`; S1.6 adds the Sentry report in the shared
      fetch reporter.
- [x] `ui/src/lib/posthog/analyticsMode.ts` + `types.ts` — remove `errors_only`; a stored
      `errors_only` value reads as `off`. Update `analyticsMode.test.ts`.
- [x] `ui/src/lib/posthog/catalog.ts` — remove `edge_request_failed` from the
      "Reliability" group (delete the group).
- [ ] `@posthog/react` — confirm `PostHogProvider` is only used as a client provider; do
      not adopt `PostHogErrorBoundary`.

## P1.2 Build

- [ ] `ui/vite.config.ts` — remove `posthogRollupPlugin` import,
      `resilientPosthogSourcemapsPlugin`, `posthogSourceMapsEnabled`,
      `posthogReleaseName`; `build.sourcemap` is now driven by the Sentry flag (S4).
      Keep `'observability-vendor'` chunk but list `@sentry/*` in it alongside PostHog, or
      split into `analytics-vendor` / `errors-vendor` if the S0 bundle measurement says so.
- [ ] `ui/package.json` — remove `@posthog/rollup-plugin`; `bun install`; update lockfiles.
- [ ] Update the comment in `vite.config.ts` `esbuild` block that refers to "PostHog's
      exception capture".
- [ ] `scripts/performance/assert-no-sourcemaps.mjs` — message and doc comment reference
      Sentry instead of PostHog.

## P1.3 Edge

- [x] `_shared/posthog.ts` — delete `capturePostHogException`; header comment says
      "product events only"; keep `capturePostHogEvent`.
- [x] `_shared/httpResponse.ts#handleEdgeError` — drop the PostHog branch; only
      `captureSentryException` (with the extra context from S2.2).
- [x] `_shared/serveEdge.ts` (`serveCronPost`, line ~181) — replace with Sentry capture +
      cron check-in failure (S3.1).
- [x] Raw `serve()` functions that call `capturePostHogException` directly — replace with
      `captureSentryException` **or** (preferred, S2.4) migrate to a `serve*` wrapper:
      `submit-form`, `submit-form-completion`, `submit-sd-form`, `submit-pay-parking`,
      `sd-refund-cron`, `calendar-sync-cron`, `ical-export`, `meta-inbox-backfill`,
      `meta-inbox-oauth-callback`, `upload-development-media`.
- [x] `_shared/rateLimit.ts` (3 sites) — real DB faults → `captureSentryException`
      (`level: 'warning'`, tag `fail_open: true`, sampled per S2.7).
- [x] `_shared/captcha.ts`
  - Siteverify network / parse failure (line ~182) → Sentry `warning`, tag
    `provider: cloudflare_turnstile`.
  - `logCaptchaEvent` (synthetic `Error(name)`) → structured `logEvent('info'|'warn', …)`
    plus, for outcome counts, the PostHog system event `public_write_blocked` (A2).
- [ ] `_shared/antiSpam.ts` heuristic block → structured log + `public_write_blocked`
      PostHog system event with `reason`, `scope` (never a Sentry event: it is expected).
- [x] `_shared/posthogCatalog.ts` — remove `edge_request_failed`.
- [x] Remove `capturePostHogException` imports everywhere;
      `rg -n "capturePostHogException" supabase/functions` returns nothing.

## P1.4 Env, tooling, system health

- [x] `ui/.env.example` — remove `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID`
      **Done for the docs**; the operator half is Vercel (doc 05 §3).
      section; PostHog block says analytics only.
- [x] `supabase/.env.example` — PostHog comment: "product events only".
- [ ] `envRegistry.ts` / `uiEnvRegistry.ts` (super-admin System health) — remove
      PostHog personal key / project id rows if present; PostHog rows describe analytics.
- [ ] Remove `POSTHOG_PERSONAL_API_KEY` / `POSTHOG_PROJECT_ID` from Vercel
      (operator, doc 05 §3).

## P1.5 PostHog project settings (operator, doc 05 §2)

- [ ] Error tracking → disable exception autocapture in **both** projects.
- [ ] Delete any exception alerts / error-tracking dashboards; delete uploaded symbol
      sets.
- [ ] Keep insights that used `$exception` only if needed for history; otherwise archive.

## P1.6 Legal copy

User-facing copy follows `human-copy.mdc` (no em dashes, plain, short).

- [ ] `CookiesPage.tsx` — PostHog sentence: "first-party product analytics (PostHog)".
      Remove "and errors". Add one sentence: error monitoring (Sentry) records technical
      details when something breaks, without names, emails, phone numbers, or message
      content. Sentry does not set advertising cookies.
- [ ] `PrivacyPage.tsx` — analytics paragraph: PostHog for usage and funnels only. New
      processor paragraph for Sentry: error reports, pseudonymous user id, no IP storage,
      retention per Sentry plan (90 days default).
- [ ] `docs/guides/routes/legal.md` — same facts; Host-facing knowledge Q&A if present.
- [ ] Ship this copy **before** production Sentry keys are set.

## P1.7 Guard

- [x] Add `scripts/dev/check-posthog-analytics-only.sh` (wired into `ci:quality`):
      **Done** — wired into `ci:quality`, plus a companion import guard.
      fails if `captureException`, `\$exception`, `capture_exceptions: true`,
      `capturePostHogException`, or `captureAppException` appear anywhere outside
      `ui/src/lib/sentry/**` and `supabase/functions/_shared/sentry*.ts`. Details in doc 06.

## Verification

- `bun run ci:quality` green.
- Throw a test error on mt-dev (browser + edge): it appears in Sentry, and PostHog Live
  events shows **no** `$exception`.
- PostHog Live events still shows `$pageview` and named events with the shared props.
