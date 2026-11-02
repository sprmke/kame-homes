---
stage: planned
title: 'Observability split — 06 testing, verification, guardrails'
status: planned
tags: [workflow, planned, observability, testing, ci]
updated: 2026-11-01
kind: plan
---

# 06 — Testing, verification, guardrails

Follows `.cursor/rules/testing.mdc`: unit tests for logic, Deno tests for shared edge code,
Playwright only for journeys, manual guide for live vendors.

## 1. Unit tests (Vitest, `ui/src/**`)

| File                                         | Covers                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lib/telemetry/scrub.test.ts`                | Deny keys, deny query keys, nested objects, arrays, non-plain values                                               |
| `lib/sentry/init.test.ts`                    | No DSN = no init; `beforeSend` scrubs URL, request, breadcrumbs; extension frames dropped                          |
| `lib/sentry/capture.test.ts`                 | Never throws; tags merged; level default                                                                           |
| `lib/sentry/reportQueryError.test.ts`        | Skips 4xx, abort, offline, 401; reports 5xx / network-online / thrown; fingerprint shape                           |
| `lib/api/edgeRequestId.test.ts`              | Header added; server id read back on failure                                                                       |
| `lib/chunkReload.test.ts` (extend)           | Warning on first failure, error after guard trips                                                                  |
| `lib/posthog/client.test.ts`                 | `capture_exceptions === false`, `capture_performance === false`, `before_send` scrubs `$current_url` / `$referrer` |
| `lib/posthog/analyticsMode.test.ts` (update) | `errors_only` stored value reads as `off`                                                                          |
| `lib/posthog/catalogParity.test.ts`          | UI catalog ⊇ edge catalog ⊇ emitted names (static scan); planned allow-list                                        |
| `lib/telemetry/scrubParity.test.ts`          | UI and edge deny lists identical (reads the edge file as text)                                                     |

## 2. Deno tests (`supabase/functions/**`)

| File                                            | Covers                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_shared/sentry_test.ts`                        | Envelope shape, release, user id, tags, trace context from `sentry-trace`, scrub, dedupe, rate cap, warning sampling, no DSN no-op, fetch failure swallowed |
| `_shared/sentryCron_test.ts`                    | `in_progress` → `ok` / `error`, duration, monitor_config                                                                                                    |
| `_shared/cronMonitorConfig_test.ts`             | Every function using `serveCronPost` declares `cron.slug` + schedule that matches its `cron.schedule` migration                                             |
| `_shared/httpResponse_test.ts` (extend)         | 5xx → Sentry once; deliberate 4xx → none; no PostHog call                                                                                                   |
| `_shared/posthog_test.ts`                       | Event capture runs after response (`runAfterResponse`), groups set, `app_release` added                                                                     |
| `tests/submit-form.test.ts` (extend)            | Thrown DB error → Sentry capture with `fn`, `request_id`; `public_write_blocked` on captcha fail, no exception                                              |
| `_shared/workflowOrchestrator_test.ts` (extend) | Side-effect failure → Sentry with `side_effect` tag; transition still succeeds                                                                              |

## 3. Playwright (`ui/e2e/`)

- [ ] `ui/e2e/shared/interceptTelemetry.ts`: route-abort `**/ingest/**`,
      `*.posthog.com`, `*.ingest*.sentry.io`, `/monitoring` in every spec (global fixture),
      and record attempted requests.
- [ ] `ui/e2e/features/observability/error-boundary.spec.ts` (`@ci`): force a render
      crash route in test mode; fallback shows `Ref:` line; one Sentry envelope attempted;
      zero PostHog requests contain `$exception`.
- [ ] Smoke specs keep `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY` empty except the one spec
      above, which sets a fake DSN.

## 4. Manual fire drill (`docs/guides/testing/observability-manual.md`, new)

Run on mt-dev after S5, then production at release. Record date, release and result.

| #   | Action                                                          | Expect in Sentry                                    | Expect in PostHog                         |
| --- | --------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| 1   | `/admin/health` → `Send test error` (browser + edge)            | 2 issues, release + env + user id, alert delivered  | Nothing                                   |
| 2   | DevTools: `Promise.reject(new Error('drill'))`                  | Issue, `mechanism.handled = false`                  | Nothing                                   |
| 3   | Block `functions/v1/list-bookings` with 500 (DevTools override) | Issue tagged `fn`, `request_id`, `http_status`      | Nothing                                   |
| 4   | Submit guest form with an invalid captcha                       | Nothing                                             | `public_write_blocked`                    |
| 5   | Submit a valid guest form                                       | Nothing                                             | `guest_form_submitted` with `app_release` |
| 6   | Pause one cron (disable its `pg_cron` job for one interval)     | Missed check-in alert                               | Nothing                                   |
| 7   | Push-notification click while app closed                        | SW errors (if any) tagged `runtime: service_worker` | `notification_opened`                     |
| 8   | Open a guest link with `?access=…`                              | Event URLs have no `access` value                   | `$current_url` has no `access` value      |
| 9   | Stack trace of drill 1                                          | Readable TS file + line (source maps)               | n/a                                       |

## 5. CI guards (wired into `bun run ci:quality`)

| Script                                                | Fails when                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/dev/check-posthog-analytics-only.sh`         | `captureException`, `$exception`, `capture_exceptions: true`, `capturePostHogException`, `captureAppException` outside Sentry modules |
| `scripts/dev/check-sentry-imports.sh`                 | `@sentry/*` imported outside `ui/src/lib/sentry/**` (one init point; keeps bundle control)                                            |
| `scripts/performance/assert-no-sourcemaps.mjs`        | Public `.map` files in `dist` (already exists; message updated)                                                                       |
| `scripts/performance/check-initial-bundle-budget.mjs` | Initial chunk over budget after the SDK lands                                                                                         |
| Vitest parity tests (§1)                              | Catalog or scrub list drift                                                                                                           |

Add both new scripts to `.cursor/hooks` docs index and `scripts/README.md`.

## 6. Rules, skills, docs

- [ ] New always-on `.cursor/rules/observability.mdc` (short): new feature must decide
      its PostHog events (matrix row or N/A) and confirm faults reach a Sentry choke point;
      "fault vs outcome" rule; no PII; no PostHog exceptions. Mirror in `.claude/` and
      `.opencode/` via `bun run setup:ai-tooling` sync, and add a line to `CLAUDE.md`.
- [ ] New skill `observability` (`.cursor/skills/observability/SKILL.md`): how to add an
      event (catalog both sides, properties rules, edge vs browser), how to capture a
      swallowed fault, how to add a cron monitor, how to test.
- [ ] Update `supabase-edge-functions.mdc` checklist item 9, `security.mdc` telemetry
      line, and every doc in the README "Docs to update" table.
- [ ] Route guides: `admin/health.md` (test button, registry rows), `legal.md`; add a
      Testing row for the error-boundary spec where relevant.

## 7. Phase verification summary

| Phase | Verify                                                             |
| ----- | ------------------------------------------------------------------ |
| S0    | Spike numbers recorded in this folder (`s0-spike-results.md`)      |
| S1    | Unit tests; drills 2, 3, 7 on mt-dev                               |
| S2    | Deno tests; drill 1 (edge half); submit-form fault test            |
| S3    | Cron config test; drill 6                                          |
| S4    | Drill 9                                                            |
| P1    | Guard script green; drills 1–3 show nothing in PostHog             |
| S5    | Drill 1 alert delivered to owners                                  |
| A0    | Drill 8; parity test; posthog edge test                            |
| A1–A5 | Each PR lists matrix rows wired; PostHog Live events check per row |
| A6    | Insights 1–8 present in prod                                       |
