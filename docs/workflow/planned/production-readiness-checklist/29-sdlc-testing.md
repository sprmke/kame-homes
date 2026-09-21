---
title: 'SDLC testing'
status: active
tags: [workflow, planned, production-readiness, testing, quality]
updated: 2026-09-19
stage: planned
kind: plan
---

# 29 — SDLC testing

## Goal

The test suite is trustworthy enough that a green CI run is sufficient confidence to deploy. Coverage is concentrated where failure is most costly, not spread evenly.

## Implementation status (2026-09-19 session)

- **Phase 29.2 — first slice of the table-driven handler harness shipped.** `supabase/functions/tests/authWrapperRejection.test.ts`: a 3×5 table (3 auth verifiers — `verifyAdminJwt`/`verifyAuthenticatedUser`/`verifySuperAdminJwt` — × 5 malformed-auth cases — missing/empty/non-Bearer/empty-Bearer/whitespace-Bearer) = 15 generated tests, all passing, ~5ms total with **zero network calls**. This proves doc 21's static-sweep claim ("missing authentication is structurally impossible for any `serve*`-wrapped function") at runtime instead of by code inspection. **Deliberately does not import `serveEdge.ts` itself** — its wrappers call `serve()` at module scope (binds a port), which is why none of the 7 pre-existing handler tests import it either; traced by hand that every verifier throws before reaching `createServiceClient()` on a bad header, so this is safe without a live Supabase connection. **This is the wrapper level only** — genuine per-function coverage (request shape validation, business-logic branches, per-permission-leaf cases across 300 handlers) is not attempted; doc 29.2's own instruction is that this scale needs a generator/fixture approach as future work, not a single-session sweep. Handler test count: 7 files/20 tests → **8 files/35 tests**.
- Confirmed `ui/e2e/features/team/shared/propertyTeamRbacHarness.ts` (referenced by this doc as "the pattern already exists — extend it") is a **Playwright UI-level RBAC harness** (nav visibility, route guards), a different layer from an edge-function auth/validation harness — the two don't overlap and neither substitutes for the other; noting this so a future session doesn't assume the UI harness already covers the edge-handler gap.
- `deno check` clean; `bun run test:edge:handlers` 35/35 passing (1 ignored, pre-existing).

Everything else in this doc (risk-tier coverage targets, contract tests against a real stack, WebKit, large-tenant fixture, flake reduction, manual release checklist, accessibility pass) not attempted this session — genuinely incremental/large scope per the doc's own framing, and several explicitly need a display or seeded infra this session didn't have.

## Remaining work to finalize

**Status: partial.** The testing pyramid and `@smoke` / `@ci` / `@live` tags already exist (not redone). This session shipped the first slice of the table-driven handler harness (wrapper-level auth rejection, 15 tests). Remaining work is risk-tier targets and the rest of the handler / adversarial gaps.

| #   | Work                                                                                                                                                          | Blocker                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Risk-tier coverage targets defined and met for the seven high-risk surfaces (29.1).                                                                           | Process + tests          |
| 2   | Table-driven handler harness: **wrapper-level auth rejection done** (15 tests); per-function validation still open (29.2).                                    | Tests                    |
| 3   | Doc 21 adversarial matrix executable and green. **Partial:** `adversarialAuthLive.test.ts` **8/8** hosted dev (2026-09-21); cd-dev **6/6** until next deploy. | Doc 21 + tests           |
| 4   | Contract tests against a real local stack for the top flows (29.3).                                                                                           | Local Supabase           |
| 5   | WebKit for the guest flow; large-tenant fixture; Manila timezone pinned in the test env.                                                                      | Playwright + doc 10 seed |
| 6   | Zero long-lived quarantined flaky tests (29.4). **One found this session** (`guestFormSubmit.spec.ts` — doc 26 cross-ref).                                    | Tests                    |
| 7   | Manual release checklist for items automation cannot cover (29.5).                                                                                            | Process                  |
| 8   | Accessibility pass on the primary guest and host flows (29.6).                                                                                                | Display + a11y           |

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
- [ ] Table-driven handler harness covering auth + validation for every mutating edge function. **Wrapper-level auth slice done** (15 tests, 3 verifiers × 5 malformed-auth cases); per-function business-logic validation not started.
- [ ] Doc 21's adversarial matrix executable and green.
- [ ] Contract tests against a real local stack for the top flows.
- [ ] WebKit added for the guest flow.
- [ ] Large-tenant fixture committed; Manila timezone pinned in the test env.
- [ ] Zero long-lived quarantined flaky tests. One found this session, not yet fixed.
- [ ] Manual release checklist maintained and used for the items automation cannot cover.
- [ ] Accessibility pass on the primary guest and host flows.

## Docs / Plans / activity-log

- **Docs:** `docs/guides/testing/README.md` (mandatory), `.cursor/rules/testing.mdc`, `.agent/skills/testing/SKILL.md`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
