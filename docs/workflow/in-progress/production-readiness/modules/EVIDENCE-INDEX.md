---
title: 'Module card evidence index'
status: active
stage: in-progress
kind: reference
readiness: verified
launch_gate: 'A–G'
launch_blocker: false
last_verified: '78f1564a 2026-11-03'
---

# Module card evidence index

Every module card uses the same 16 criteria. This file maps each criterion to the **current** proof so
cards can be filled with a link instead of prose, and so "done" always points at something a reader can
re-run.

Use it like this in a card: `- [x] **4. Tenant isolation** — outsider probe, see EVIDENCE-INDEX §4`.

| #   | Criterion                         | Proof (re-runnable)                                                                                                                                                                     | Scope covered today                                                                                         |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Functional (happy + unhappy)      | `bun run test:e2e:ci` (`ui/e2e/features/**`), `bun run test`, `bun run test:edge:handlers`                                                                                              | Public pages, guest form submit, booking detail workflow step, plan gates, reviews, marketing, inbox shells |
| 2   | Access control (roles vs catalog) | `node scripts/dev/probe-readiness-rbac-dev.mjs` (Full Access / Operations / Read Only matrix), `node scripts/dev/audit-auth-matrix.mjs --check`, E2E `team/propertyTeamNavRbac.spec.ts` | Property + org + parking role templates                                                                     |
| 3   | Plan gate per tier                | `bun run check:plan-catalog`, `ui/src/features/dashboard/plans/lib/planGateCoverage.test.ts`, E2E `plans/gates/featureGates.spec.ts` (per-tier cases)                                   | Tier catalog + gated surfaces incl. auto-review                                                             |
| 4   | Tenant isolation (IDOR)           | `node scripts/dev/probe-readiness-idor-dev.mjs` (13 reads/writes denied for outsider + guest), `node scripts/dev/probe-readiness-bopla-dev.mjs` (privileged fields ignored)             | Org/property reads + writes; parking cross-scope still manual                                               |
| 5   | Server-side validation on writes  | Handler schemas + `bun run test:edge` (validators), uploads probe (`probe-readiness-uploads-dev.mjs`)                                                                                   | Booking form, settings patches, uploads                                                                     |
| 6   | Audit log                         | `activity_log` writer (`_shared/activityLog.ts`), audit probes: booking lifecycle shows `booking.status_changed` ×4, blocked-write + failed sign-in outcomes (#c8dfe00e)                | Bookings, settings, auth outcomes                                                                           |
| 7   | Mobile native (375/768/1280)      | `bun run test:e2e:smoke` (mobile + tablet projects), accessibility sweep at three viewports (`axeSweep.spec.ts`), 162-page walk (2026-10-19)                                            | Public + dashboard shells; feature screens spot-checked                                                     |
| 8   | States (skeleton/empty/error)     | Layout-matched skeletons (`ui/src/components/skeletons/**`, `role="status"`), E2E empty/error cases (e.g. `forHostsPricing` retry)                                                      | Baseline routes; per-module gaps listed in cards                                                            |
| 9   | Unsaved-changes guard             | `ui/src/hooks/useUnsavedChangesGuard.ts`, `useGuardedClose`; guard probes (notifications bot token, org settings)                                                                       | Settings forms, templates, telegram token                                                                   |
| 10  | Page title + favicon              | `usePageTitle` + `pageTitle.ts` (property dashboard titles)                                                                                                                             | All dashboard routes (E2E assertions)                                                                       |
| 11  | Accessibility smoke               | `bun run test:e2e:ci -- ui/e2e/features/a11y/axeSweep.spec.ts` — **35 routes, 0 serious/critical**; production Lighthouse a11y **100** on 9 routes                                      | Public, guest booking, property dashboard, org hub                                                          |
| 12  | Performance                       | `bun run check:budgets`, `BASE_URL=… node scripts/performance/lighthouse-medians.mjs` (3× median), `scripts/performance/capture-edge-latency.*`                                         | Prod LCP 6.8–11.7 s (blocked by stale prod build); develop entry 151 KiB gzip                               |
| 13  | Observability                     | Sentry wiring (#d25f90bb source maps), PostHog events, `handleEdgeError` envelopes, correlation id in `_shared/httpResponse.ts`                                                         | Edge + UI                                                                                                   |
| 14  | Automated tests (unit/E2E gaps)   | `bun run test` (731 files) · `test:edge` · `test:edge:handlers` · `test:e2e:ci` (304 passed / 6 skipped) · `test:e2e:smoke`                                                             | Suite-wide; per-card gaps listed                                                                            |
| 15  | Docs                              | `docs/guides/routes/*` (Testing column), route guides index                                                                                                                             | All shipped routes                                                                                          |
| 16  | Prod config (secrets/crons/Vault) | `node scripts/dev/readiness-env-matrix.mjs --check`, prod secrets list (61 names), `pg_cron` inventory in `docs/archive/operations/scheduled-jobs-and-testing.md`                       | 76 edge secrets, 26 `VITE_*`, 25 Vault, 25 crons                                                            |

## Criteria that are **not** yet evidence-backed everywhere

These stay unticked on cards unless the card says otherwise:

- **5** — mass-assignment coverage exists as a script (`probe-readiness-bopla-dev.mjs`) but has not been run against a seeded environment since production became the only backend; run it on the next staging project.
- **7** — 162-page walk is from 2026-10-19; the 2026-11 mobile/tablet E2E projects cover shells, not every screen.
- **8** — skeletons are swept by the a11y gate; per-module empty/error branches are only spot-checked.
- **12** — Lighthouse medians exist for production but production is stale; numbers must be re-taken after the Vercel release.
- **16** — Vault entry _names_ are verified; values are operator-owned.
