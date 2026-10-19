---
title: 'Production readiness audit and remediation'
status: active
tags: [planning, production-readiness, security, testing, cost]
updated: 2026-09-12
stage: in-progress
kind: plan
origin_stage: for-testing
readiness: unverified
launch_gate: B
launch_blocker: tbd
last_verified: none
---

# Production readiness audit and remediation

## Goal

Make the multi-tenant **develop** track (`develop` → `dev.kamehomes.space` → `fwor…`) evidence-ready for a controlled launch: no unresolved Critical defects, High items fixed or explicitly accepted, quality/migration gates green, tenant isolation proven, and operator P0 controls listed as launch blockers rather than hidden as “missing code.”

This plan is the single ledger. Existing work is input, not work to recreate.

## Scope

### In

- Audit of the current `develop` working tree (including uncommitted testing + cost/abuse hardening)
- Deduplication against shipped/in-progress/planned docs
- Local quality + mocked E2E verification
- Critical/High code remediations that do not require operator keys or production deploy
- Workflow/doc hygiene so completed plans are not listed as “not started”

### Out

- Production Supabase / `kamewave` cutover
- mt-prod creation and legacy data migration
- Operator-only items (Turnstile keys, Maps lock, billing alerts, Vault cron secrets, branch protection)
- New product modules (analytics, trust-safety, marketing mobile editors, super-admin followups)
- Parking Phase 6 ranking (needs live data)
- Full guest mobile-native shell (owned by `mobile-native-redesign.md`)

## Approach

1. Snapshot the dirty tree; run quality/migration checks; record failures as findings.
2. Build one ledger: verified complete / code complete unverified / operator blocked / accepted / deferred / stale docs / **new defect**.
3. Fix only net-new Critical/High code defects in small batches with tests + docs.
4. Publish module-specific go/no-go gates.

Trade-off: this audit does not claim “production ready” until operator P0 items and hosted-dev verification (V-1–V-5) land. Code can close IDOR/catalog/CI gaps independently.

---

## Baseline snapshot (2026-09-11)

| Item                 | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Branch               | `develop` @ `fe1ddb62` plus large dirty tree (testing pyramid + cost/abuse code) |
| Dirty tree           | ~199 files (docs, CI, edge handlers, Playwright harnesses)                       |
| UI unit tests        | 18 `ui/src/**/*.test.ts`                                                         |
| Deno `_shared` tests | 41 `*_test.ts`                                                                   |
| Playwright specs     | 47 under `ui/e2e/features/`                                                      |
| GitHub Issues        | **blocked** — `gh` unauthenticated; linkage pending                              |
| Production           | untouched (no `kamewave`)                                                        |

Quality gate (`./scripts/dev/ci-quality-gate.sh --skip-install`) **passed** 2026-09-11 against the pre-remediation dirty tree (lint warnings only; Playwright `@smoke` 31 passed; build + lazy-optimizer OK). Local `db:reset` was **not** run (preserve dirty tree). New remediations verified with focused Deno + type-check after Phase 1–2.

---

## Deduplication ledger

Status key: **verified** (code + docs + tests) · **code-complete** (unverified on hosted dev) · **operator** · **accepted** · **deferred** · **stale-doc** · **new**

### Do not rebuild (already shipped / tracked)

| ID  | Item                                                                                                     | Status                            | Where                                                     |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| D1  | Guest submissions scoped RLS                                                                             | verified (local fixtures)         | `done/production-readiness-hardening.md`                  |
| D2  | Durable public GET rate limits + guest read tokens + private storage + cron fail-closed + AI quota holes | code-complete                     | `for-testing/cost-abuse-security-production-readiness.md` |
| D3  | CAPTCHA / anti-spam stack                                                                                | code-complete; inert without keys | `for-testing/captcha-anti-spam-hardening.md`              |
| D4  | Sitewide testing pyramid Phases 0–12                                                                     | verified (quality gate)           | `done/sitewide-automated-testing.md`                      |
| D5  | Deploy guardrails + rollback                                                                             | verified (scripts)                | `done/supabase-deploy-guardrails-and-rollback.md`         |
| D6  | Tier / plan gating audit                                                                                 | verified                          | `done/tier-feature-alignment-audit.md`                    |
| D7  | Parking E2E phases 0–5, 7–8                                                                              | code-complete                     | `done/parking-e2e-phase*`                                 |
| D8  | Super-admin console Phases 0–7                                                                           | verified                          | `done/super-admin-console-overhaul.md`                    |
| D9  | Org activity log Phases 0–4                                                                              | code-complete                     | `in-progress/org-activity-audit-log.md`                   |
| D10 | CI quality + develop CD                                                                                  | code-complete                     | `.github/workflows/ci.yml`, `cd-dev.yml`                  |

### Operator / third-party (launch blockers, not code)

See [`cost-abuse-security-pending-from-user.md`](../operator/cost-abuse-security-pending-from-user.md): P0-1–P0-7, V-1–V-5.

### Sibling plans (do not fold into this remediation)

- [`ai-paid-provider-and-production-quotas.md`](../../../planned/ai-paid-provider-and-production-quotas.md)
- [`super-admin-service-cost-monitoring.md`](../../../planned/super-admin-service-cost-monitoring.md)
- [`parking-e2e-production-readiness.md`](./parking-e2e-production-readiness.md)
- [`parking-property-parity.md`](../../../for-testing/parking-property-parity.md)
- [`mobile-native-redesign.md`](../../../for-testing/mobile-native-redesign.md)

### Stale documentation (hygiene in this plan)

| ID  | Issue                                                                              | Fix                                             |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| S1  | `planned/README.md` lists sitewide + cost-abuse as “not started” with broken paths | Point to in-progress; mark code-complete        |
| S2  | `docs/README.md` still cites in-progress tier-audit + portfolio bundling           | Point to `done/`                                |
| S3  | `sitewide-automated-testing.md` `status: planned` while phases done                | Move to `done/` after quality gate              |
| S4  | Cost-abuse `stage: in-progress` + `status: done`                                   | Keep pending-operator doc; parent → for-testing |
| S5  | `PROJECT.md` help-support path points at in-progress                               | Point to `done/`                                |
| S6  | `intake/_to-plan.md` still 📋-links sitewide + cost-abuse to planned/              | Sync to actual folders                          |

---

## Findings (net-new or sharper than existing docs)

### Critical

| ID  | Finding                                                                                      | Evidence                                                                                                                         | Fix in this plan?        |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| C1  | Guest **writes** still accept bare `bookingId` (SD form, form update, review, voucher claim) | `submit-sd-form`, `submit-form` update path, `submit-guest-review`, `claim-sd-voucher` do not call `authorizeGuestBookingAccess` | **Yes**                  |
| C2  | Developments list is live; detail/sub-routes read `mockDevelopments`                         | `DevelopmentDetailPage.tsx`, `DevelopmentPropertiesPage.tsx`, `DevelopmentParkingListPage.tsx`                                   | **Yes**                  |
| C3  | Property PDP “Similar stays” always uses `mockProperties`                                    | `PropertyDetailPage.tsx` → `SimilarProperties`                                                                                   | **Yes**                  |
| C4  | Hosted dev not verified (V-1–V-5)                                                            | pending-from-user unchecked                                                                                                      | Operator — document only |
| C5  | CAPTCHA inert without keys                                                                   | `captcha.ts`                                                                                                                     | Operator — document only |

### High

| ID  | Finding                                                                                                      | Evidence                                               | Fix in this plan?                                              |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| H1  | `resolveScopedPropertyAccess` falls back to first owned/member/`DEFAULT_PROPERTY` when `property_id` omitted | `_shared/propertyScope.ts`                             | **Yes** — require explicit scope on mutating/list handlers     |
| H2  | Workflow status update has no compare-and-swap                                                               | `databaseService.ts#updateBookingStatus`               | **Yes** — `UPDATE … WHERE status = from`                       |
| H3  | Voice preview bypasses AI quota + durable RL                                                                 | `voice-receptionist-voice-preview/index.ts`            | **Yes**                                                        |
| H4  | `check-serve-public-rate-limit.sh` in local `ci:quality` only, not GitHub Actions                            | `ci.yml`, `cd-dev.yml`                                 | **Yes**                                                        |
| H5  | Meta webhook: no bad-signature rate limit                                                                    | `meta-inbox-webhook/index.ts`                          | **Yes**                                                        |
| H6  | Assistant expire + attachment retention cron not scheduled                                                   | snippet only                                           | **Yes** — add migration that schedules if Vault secret present |
| H7  | Parking-only org interim ungate                                                                              | `useFeatureGate.ts` `PARKING_INTERIM_UNGATED_FEATURES` | No — owned by parking-property-parity                          |
| H8  | Voice cost estimator uses text Flash rates                                                                   | `aiModelRouter.ts`                                     | No — owned by AI paid-provider plan Phase 1                    |
| H9  | Search listings load up to 20k rows before slice                                                             | `publicListingRows.ts`                                 | No — owned by service-cost plan                                |
| H10 | Guest/marketing mobile shell incomplete                                                                      | `mobile-native-redesign.md` Phases 1–2                 | No — existing plan                                             |

### Medium (backlog, not this batch)

Workflow race documentation, dual RL stacks, booking AI review 1s poll in background, Resend unmetered, `get-public-app-config` missing, single app error boundary, Bun unpinned in CI, `format:check` not in CI. Featured stays on `/` and stay-guide titles are live in this follow-up. Search-bar Where still resolves some location labels from leftover mock catalogs.

### Accepted

- Durable RL / CAPTCHA fail-open on DB/Turnstile 5xx
- `get-booked-dates` returns booking UUID for self-edit
- Parking guest status UUID bearer (v1)
- Voice session post-mint is cooperative (token TTL is hard stop)

---

## Implementation tasks

### Phase 0 — Persist, baseline, reconcile

- [x] Write this file; index in `planned/README.md`; scratchpad 📋
- [x] `/workflow-start` → in-progress
- [x] Run `bun run ci:quality` (or equivalent steps) against dirty tree; record result
- [x] Count migrations / functions / routes; note operator deps
- [x] Fix stale index docs (S1–S6) without claiming operator work done
- [x] Move sitewide testing plan to `done/` if quality gate confirms phases
- [x] Move cost-abuse parent toward for-testing (operator pending stays)

### Phase 1 — Critical code (guest write tokens + catalog honesty)

- [x] Wire `authorizeGuestBookingAccess` on `submit-sd-form`, `submit-form` update, `submit-guest-review`, `claim-sd-voucher` (same grace/enforce as reads)
- [x] Deno tests for write-path token reject when enforce + grace expired
- [x] Developments detail/sub-pages: live `get-public-development` (or list payload) instead of mock; 404 → list
- [x] Similar stays: live neighbors from listing API or hide section if empty
- [x] Route guides: `form.md`, `sd-form.md`, `developments.md`, `properties.md`
- [x] activity-log: N/A for token gate (authz, no new mutation); catalog pages are reads

### Phase 2 — High security/ops

- [x] Require explicit `property_id` or org+slug on scoped admin list/mutate (no silent default property)
- [x] `updateBookingStatus` CAS: only update if current status matches `from`
- [x] Voice preview: `assertOrgAndPropertyAiQuota` + durable per-user RL
- [x] Add `check-serve-public-rate-limit.sh` to `ci.yml` + `cd-dev.yml`
- [x] Meta webhook: durable RL on bad signature (mirror PayMongo)
- [x] Schedule `dashboard-assistant-expire` via migration snippet pattern
- [x] Tests + `docs/PROJECT.md` / security rule notes

### Phase 3 — Publish gates + stop

- [x] Fill go/no-go tables in this doc
- [x] Update `MODULE-DISPOSITION.md` + in-progress README
- [x] Do **not** start H7–H10 or sibling plans

## Docs to update

| Doc                                                                            | Why                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------- |
| This file                                                                      | Ledger + checkboxes                           |
| `docs/workflow/planned/README.md` then `in-progress/README.md`                 | Index                                         |
| `docs/workflow/intake/_to-plan.md`                                             | 📋 → 🚧                                       |
| `docs/README.md`                                                               | Stale in-progress pointers                    |
| `docs/PROJECT.md`                                                              | Guest write tokens, CI step, developments API |
| `docs/guides/routes/form.md`, `sd-form.md`, `developments.md`, `properties.md` | Token writes + live catalog                   |
| `.cursor/rules/security.mdc`                                                   | Guest write token requirement                 |
| `docs/guides/testing/cost-abuse-verification.md`                               | Write-path A5 companion                       |

## Open questions

None that block Phase 1–2. Operator items stay on the pending-from-user doc.

---

## Go / no-go

| Gate                         | Verdict                                                           | Why                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **A Core platform (code)**   | **Go for hosted-dev beta after operator P0**                      | C1–C3 and H1–H6 fixed in this change. Quality gate green on pre-remediation tree; remediations covered by Deno + type-check. |
| **A Core platform (launch)** | **No-go** until P0-1–P0-7 + V-1–V-5 + pentest + branch protection | Operator / hosted-dev only.                                                                                                  |
| **B Parking money**          | **No-go**                                                         | Sibling `parking-e2e-production-readiness.md`                                                                                |
| **C AI / voice**             | **No-go**                                                         | Sibling AI paid-provider plan + P0-3. Voice preview now quota-gated; kill switch stays off.                                  |
| **D PWA / push**             | **No-go**                                                         | `for-testing/pwa-installable-offline-push.md` QA #5                                                                          |
| **E Meta**                   | **No-go** (not a core-booking blocker)                            | Bad-signature RL added; live OAuth still operator.                                                                           |
| **F mt-prod cutover**        | **Out of scope**                                                  | `ci-cd-environments/` Phase B                                                                                                |

## Launch gates

### Gate A — Core platform (develop / hosted-dev beta)

| Check                                             | Owner             | Status |
| ------------------------------------------------- | ----------------- | ------ |
| No open Critical code defects (C1–C3)             | Agent (this plan) | Done   |
| CI + `check-serve-public-rate-limit.sh` on GitHub | Agent             | Done   |
| Operator P0-1–P0-7 + V-1–V-5                      | Michael           | Open   |
| Internal pentest §6.2                             | Michael           | Open   |
| Branch protection                                 | Michael           | Open   |

### Gate B — Parking money

Owned by `parking-e2e-production-readiness.md` (sandbox PayMongo, refund path, entitlements).

### Gate C — AI / voice

Owned by AI paid-provider plan (estimator + paid key) + P0-3. Keep voice kill switch off until then.

### Gate D — PWA / push

Owned by `for-testing/pwa-installable-offline-push.md` QA batch #5.

### Gate E — Meta

Marketing refinement + live OAuth/webhook on hosted dev. Not a core-booking blocker.

### Gate F — mt-prod cutover

Owned by `ci-cd-environments/` Phase B. Out of scope.

---

## Implementation status

| Phase                  | Status |
| ---------------------- | ------ |
| 0 Baseline + reconcile | done   |
| 1 Critical code        | done   |
| 2 High security/ops    | done   |
| 3 Publish gates        | done   |
| 4 Self-review harden   | done   |

activity-log: N/A for Phase 0 docs. Phase 1 token gates are authorization. Phase 2 CAS is booking mutation already logged by orchestrator. Self-review follow-up (query pushdown, voice `recordAiUsage`, 409 mapping, fail-closed public property, live featured catalog) is authz/read/quota accounting, not a new mutation.

Plans / RBAC: N/A — no new host capability.
