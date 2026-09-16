---
title: 'Production readiness checklist'
status: active
tags: [workflow, planned, production-readiness, performance, security, reliability]
updated: 2026-09-16
stage: planned
kind: reference
---

# Production readiness checklist

One plan per checklist item, each applied across the **whole** app: 2330 UI source files, 300 edge functions, 346 migrations, guest + host + parking + super-admin surfaces.

**Goal:** 100% confidence that the multi-tenant track is optimized and safe for a production release. Every doc here ends in a measurable exit gate, not a vibe.

## Read this first — what is already done

This repo has run four prior production-readiness passes. **Do not redo their work.** These plans are inputs:

| Prior plan                                                                                                               | Stage       | What it already closed                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`pre-production-launch-audit.md`](../../for-testing/pre-production-launch-audit.md)                                     | for-testing | P0/P1/P2 all closed — bundle split + budget CI, public-GET rate-limit gate, migration version check, backup/rollback hardening, CORS tightening, mobile Playwright viewports |
| [`performance-optimization-production-readiness.md`](../../for-testing/performance-optimization-production-readiness.md) | for-testing | Route lazy loading, `manualChunks`, query invalidation scoping, edge query shape, SW cache correctness                                                                       |
| [`cost-abuse-security-production-readiness.md`](../../for-testing/cost-abuse-security-production-readiness.md)           | for-testing | AI quotas, abuse limits, cost ceilings, pentest findings                                                                                                                     |
| [`posthog-analytics-production-readiness.md`](../../for-testing/posthog-analytics-production-readiness.md)               | for-testing | Event taxonomy, identify/groups, exceptions, source maps                                                                                                                     |
| [`captcha-anti-spam-hardening.md`](../../for-testing/captcha-anti-spam-hardening.md)                                     | for-testing | Turnstile, durable rate limiter, honeypot/timing                                                                                                                             |
| [`ci-cd-environments/`](../../in-progress/ci-cd-environments/README.md)                                                  | in-progress | Dev/prod dual-track, `cd-dev.yml`, `cd-prod.yml` scaffolds                                                                                                                   |

**What this folder adds:** the prior passes were _audits_ — they found and fixed specific defects. This folder is _coverage_: taking each checklist item and proving it is applied at **every** call site across the codebase, with a CI guard so it cannot regress. Each doc opens with a "Prior art" section naming exactly what is already closed and what remains.

## Docs in this folder

Ordered by recommended execution order (dependencies flow downward).

### Tier 0 — Measure before changing

| #   | Doc                                                          | Item                                                                             |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 00  | [`00-baseline-and-budgets.md`](./00-baseline-and-budgets.md) | Baseline capture + budgets + regression gates (prerequisite for every other doc) |

### Tier 1 — Frontend delivery

| #   | Doc                                                                      | Checklist item             |
| --- | ------------------------------------------------------------------------ | -------------------------- |
| 01  | [`01-code-splitting-and-chunks.md`](./01-code-splitting-and-chunks.md)   | Split code into chunks     |
| 02  | [`02-minify-js-css.md`](./02-minify-js-css.md)                           | Minify JS and CSS          |
| 03  | [`03-lazy-loading.md`](./03-lazy-loading.md)                             | Add lazy loading           |
| 04  | [`04-defer-non-critical-scripts.md`](./04-defer-non-critical-scripts.md) | Defer non-critical scripts |
| 05  | [`05-unused-dependencies.md`](./05-unused-dependencies.md)               | Unused dependencies ❌     |
| 06  | [`06-unnecessary-rerenders.md`](./06-unnecessary-rerenders.md)           | Unnecessary re-renders ❌  |
| 07  | [`07-loading-skeletons.md`](./07-loading-skeletons.md)                   | Loading skeletons          |
| 08  | [`08-debounce-input-handlers.md`](./08-debounce-input-handlers.md)       | Debounce input handlers    |
| 09  | [`09-compress-images.md`](./09-compress-images.md)                       | Compress images            |
| 10  | [`10-paginate-large-lists.md`](./10-paginate-large-lists.md)             | Paginate large lists       |

### Tier 2 — Backend, data, delivery

| #   | Doc                                                                              | Checklist item              |
| --- | -------------------------------------------------------------------------------- | --------------------------- |
| 11  | [`11-cache-api-responses.md`](./11-cache-api-responses.md)                       | Cache API responses         |
| 12  | [`12-cache-expensive-queries.md`](./12-cache-expensive-queries.md)               | Cache expensive queries     |
| 13  | [`13-compress-api-payloads.md`](./13-compress-api-payloads.md)                   | Compress API payloads       |
| 14  | [`14-index-the-database.md`](./14-index-the-database.md)                         | Index the database          |
| 15  | [`15-database-connection-pooling.md`](./15-database-connection-pooling.md)       | Database connection pooling |
| 16  | [`16-cdn.md`](./16-cdn.md)                                                       | Add CDN                     |
| 17  | [`17-load-balancing-and-scalability.md`](./17-load-balancing-and-scalability.md) | Load balancer / scalability |

### Tier 3 — Platform readiness (the second checklist)

| #   | Doc                                                                    | Checklist item          |
| --- | ---------------------------------------------------------------------- | ----------------------- |
| 18  | [`18-backend-and-apis.md`](./18-backend-and-apis.md)                   | Backend & APIs          |
| 19  | [`19-database-operations.md`](./19-database-operations.md)             | Database                |
| 20  | [`20-storage.md`](./20-storage.md)                                     | Storage                 |
| 21  | [`21-auth-and-permissions.md`](./21-auth-and-permissions.md)           | Auth / Permissions      |
| 22  | [`22-security-and-rls.md`](./22-security-and-rls.md)                   | Security & RLS          |
| 23  | [`23-rate-limiting.md`](./23-rate-limiting.md)                         | Rate limiting           |
| 24  | [`24-hosting-and-deployment.md`](./24-hosting-and-deployment.md)       | Hosting & deployment    |
| 25  | [`25-cloud-computing.md`](./25-cloud-computing.md)                     | Cloud computing         |
| 26  | [`26-ci-cd-and-version-control.md`](./26-ci-cd-and-version-control.md) | CI/CD & version control |
| 27  | [`27-error-tracking-and-logs.md`](./27-error-tracking-and-logs.md)     | Error tracking & logs   |
| 28  | [`28-analytics.md`](./28-analytics.md)                                 | Analytics               |
| 29  | [`29-sdlc-testing.md`](./29-sdlc-testing.md)                           | SDLC testing            |
| 30  | [`30-availability-and-recovery.md`](./30-availability-and-recovery.md) | Availability & recovery |

## Execution order

```
00 baseline  ──►  Tier 1 (01–10)  ──►  Tier 2 (11–17)  ──►  Tier 3 (18–30)
                        │                    │
                        └─ 05, 06 depend on ─┘
                           00's profiler baseline
```

Tier 3 docs are mostly independent and can run in parallel once Tier 0 lands. **21 / 22 / 23 must complete before any production cutover** — they are launch blockers, the rest are optimizations.

## Conventions used in every doc

- **Prior art** — what is already shipped, with file references, so no work is redone.
- **Current state** — measured, not assumed. Numbers come from the tree at 2026-09-16.
- **Phases** — ordered, each independently shippable and verifiable.
- **Edge cases** — the non-obvious failures each item creates if done naively.
- **Exit gate** — the measurable condition that closes the item, plus the CI guard that prevents regression.
- **Docs / Plans / activity-log** — the repo's mandatory same-change obligations per `CLAUDE.md`.

## Status ledger

| Doc   | Status      | Owner | Exit gate met |
| ----- | ----------- | ----- | ------------- |
| 00–30 | not started | —     | —             |

Update this table as slices land. When the whole folder closes, run `/workflow-done`.
