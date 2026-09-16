---
title: 'SDLC testing'
status: active
tags: [workflow, planned, production-readiness, testing, quality]
updated: 2026-09-16
stage: planned
kind: plan
---

# 29 — SDLC testing

## Goal

The test suite is trustworthy enough that a green CI run is sufficient confidence to deploy. Coverage is concentrated where failure is most costly, not spread evenly.

## Prior art — a full testing pass already shipped

[`sitewide-automated-testing.md`](../../done/sitewide-automated-testing.md) (Phases 0–12, quality gate green 2026-09-11) built the pyramid. Plus launch-audit fixes:

| Shipped                    | Detail                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Vitest (UI unit, Node env) | `bun run test`                                                                           |
| Deno tests                 | `_shared/*_test.ts` (~46), handler tests (`functions/tests/*.test.ts`)                   |
| Type-checked edge tests    | `--no-check` removed (P2-1)                                                              |
| Deno type-check in CI      | `check:edge-types` (P0-2)                                                                |
| Playwright E2E             | ~48 specs under `ui/e2e/features/`, mocked                                               |
| Mobile + tablet viewports  | `mobile-chromium-smoke` (375×812), `tablet-chromium-smoke` (768×1024) on `@smoke` (P2-3) |
| Accessibility helpers      | Overflow + accessible-name checks                                                        |
| Quality gate               | `bun run ci:quality`                                                                     |
| Documented decision        | Vitest stays Node-only; component behavior is tested via Playwright (P2-2)               |

**That last point matters:** "zero component tests" was raised and **deliberately resolved** as a decision, not left as a gap. Do not re-open it as a finding; if the decision should change, argue it on its merits.

## Current state

Inventory at the last audit: 25 UI unit tests, 0 component tests (by decision), 46 shared edge tests, 7 handler tests, 48 E2E specs — against 2330 UI files and 300 edge functions.

The honest read: **the pyramid exists but is thin relative to the codebase size**, and it is concentrated on `_shared` logic and smoke paths. That is a defensible prioritization (pure logic and critical paths first), but it leaves most of the 300 edge handlers without a handler test.

## Phases

### Phase 29.1 — Risk-based coverage targets

Do not chase a coverage percentage. Target by blast radius:

| Surface                                               | Target                                                               | Why                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| Booking status machine + workflow orchestrator        | Exhaustive unit coverage of every transition, guard, and side effect | Core domain; a bug here corrupts real bookings |
| Auth/permission expansion helpers                     | Exhaustive, with role fixtures                                       | Doc 21 — a bug is a breach                     |
| Money: finance, pricing, refunds, vouchers, proration | Exhaustive                                                           | A bug costs real money                         |
| Date/timezone normalizers                             | Exhaustive, with Manila boundary cases                               | Known repo hazard                              |
| Payment + webhook handlers                            | Handler tests incl. replay/idempotency                               | Money + external                               |
| Every mutating edge handler                           | At least one happy path + one auth-failure test                      | Doc 18/21                                      |
| Guest booking flow E2E                                | Full, including failure paths                                        | Primary conversion                             |
| Host critical flows E2E                               | Transition, finance entry, pricing edit                              | Daily operations                               |

### Phase 29.2 — Close the handler-test gap

Currently 7 handler tests for 300 functions. Rather than writing 300 by hand, build a **table-driven harness**: for each function, a fixture declaring auth tier, valid input, and expected failures, then generate the auth/validation tests automatically. This makes doc 21's adversarial matrix and doc 18's conformance sweep executable rather than manual.

The E2E harnesses in `ui/e2e/features/team/shared/propertyTeamRbacHarness.ts` show this pattern already exists in the repo — extend it.

### Phase 29.3 — Test data and environments

- The large-tenant seed (doc 10) becomes the standard fixture for performance and pagination tests.
- Deterministic fixtures: fixed dates, fixed IDs, no `Date.now()` in assertions, no randomness.
- Manila timezone pinned in the test environment, or date tests pass locally and fail in CI (UTC).

### Phase 29.4 — Reduce flake

- Quarantine flaky specs into a non-blocking job with a deadline to fix or delete (doc 26).
- Ban fixed `waitForTimeout`; wait on conditions.
- Ensure tests are independent and can run in any order and in parallel.

### Phase 29.5 — Manual QA and exploratory testing

Automation cannot cover everything. Maintain:

- A release checklist of manual checks for what is hardest to automate: real payment flow (sandbox), real email delivery and rendering across clients, PDF output fidelity, Meta publishing, AI output quality, PWA install/offline on a real device.
- The `docs/workflow/for-testing/` stage and `QA-BATCH.md` already exist for this — keep them as the process of record.
- The `property-dashboard-qa` skill covers deep dashboard QA.

### Phase 29.6 — Non-functional testing

- Performance: doc 00 budgets in CI, doc 17 load test before releases.
- Accessibility: extend beyond the existing helpers toward WCAG 2.1 AA on the primary flows (the `accessibility` skill defines scope).
- Security: doc 21's adversarial suite, doc 22's checks, `security-auditor` on sensitive diffs.
- Cross-browser: currently Chromium only. Add at least WebKit for the guest flow — Safari/iOS is a large share of a Manila consumer audience and has genuinely different behavior (date inputs, PWA, IndexedDB).

**Cross-browser is the most significant untested risk on the guest side.**

## Edge cases

- **Mocked E2E proves the UI, not the integration.** All 48 specs are mocked, so a contract change between edge function and UI passes tests and breaks production. Add a small set of contract tests running against a real local Supabase stack.
- **Testing against real third parties** is forbidden for load tests (doc 17) and risky for functional tests. Use provider sandboxes where they exist (PayMongo) and mocks elsewhere, but verify the mock matches the real payload shape at least once per provider.
- **Time-dependent tests** — anything involving check-in/check-out, crons, or expiry needs injectable time, not real clocks.
- **Test pollution** — tests that write to a shared hosted dev project interfere with each other and with manual QA. Prefer local stack or per-test isolated tenants.
- **`?testing=true` pipelines are forbidden** by repo rule. Use local/staging Supabase instead.
- **Coverage metrics mislead** — 80% coverage of trivial code with untested payment logic is worse than the inverse. Report coverage per risk tier, not globally.
- **Snapshot tests** on a UI that changes frequently become noise everyone approves blindly.

## Exit gate

- [ ] Risk-tier coverage targets defined and met for the seven high-risk surfaces.
- [ ] Table-driven handler harness covering auth + validation for every mutating edge function.
- [ ] Doc 21's adversarial matrix executable and green.
- [ ] Contract tests against a real local stack for the top flows.
- [ ] WebKit added for the guest flow.
- [ ] Large-tenant fixture committed; Manila timezone pinned in the test env.
- [ ] Zero long-lived quarantined flaky tests.
- [ ] Manual release checklist maintained and used for the items automation cannot cover.
- [ ] Accessibility pass on the primary guest and host flows.

## Docs / Plans / activity-log

- **Docs:** `docs/guides/testing/README.md` (mandatory), `.cursor/rules/testing.mdc`, `.agent/skills/testing/SKILL.md`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
