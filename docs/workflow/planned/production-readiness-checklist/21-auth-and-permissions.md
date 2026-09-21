---
title: 'Auth and permissions'
status: active
tags: [workflow, planned, production-readiness, auth, rbac, security]
updated: 2026-09-21
stage: planned
kind: plan
---

# 21 — Auth / Permissions

**Launch blocker.** Must close before any production cutover.

## Goal

Every endpoint and every UI surface enforces the correct one of seven auth tiers, server-side, with no gap between what the UI hides and what the API allows.

## Remaining work to finalize

**Status: partial — auth-matrix sweep + CI, capability-token audit, invite code review, sign-out code path, and super-admin write audit shipped (2026-09-18).** Parity tests, shared-device sign-out proof, and the adversarial suite still block the exit gate.

| #   | Work                                                                                                                                                                                                                                                                                                           | Blocker           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | ~~Per-function semantic review of `MISSING-resource-scope-check` rows.~~ **Done** — grouped judgments in **Scope-gap judgments** below. Heuristic `--gaps-only` still lists them (by design); they are not IDOR bugs.                                                                                          | —                 |
| 2   | Client/server parity test for every role × endpoint (21.2). **Partial:** table-driven harness `authParitySeed.test.ts` + `fixtures/auth-parity-seed.example.json` (JWT fixture; not green until local seed filled).                                                                                            | Tests + seed data |
| 3   | Sign-out on a shared device: query cache / realtime / PWA Cache Storage. **Code path exists** (`PwaQueryPersistence` + `purgeOfflineState` on `SIGNED_OUT`; `clearOrgRenewalAutoShownForUser` on admin sign-out — unit-tested in `listingContractRenewalSession.test.ts`). PWA/shared-device proof still open. | Display + PWA     |
| 4   | ~~Capability-token TTL / purpose / revocation / telemetry audit.~~ **Done** — findings in 21.3 below. Remaining product work: purpose-scoped tokens and cancel-time denylist (not shipped).                                                                                                                    | Product           |
| 5   | Invite-flow adversarial checks (replay after revoke, non-escalating role). **Code review:** accept uses invite row `role_id` (not the body), email-bound, `status=pending` then `accepted`, expiry checked. Tests not written.                                                                                 | Tests             |
| 6   | ~~Super-admin mutating audit coverage.~~ **Done** this pass for FAQ, playbook, support reply/status, pricing-plans, platform payment/host/parking settings, dashboard-assistant kill switch, contract consideration. Reads remain N/A. Spot-check any new `serveSuperAdmin` writer.                            | —                 |
| 7   | Adversarial suite (21.6 table). **Partial:** `adversarialAuthLive.test.ts` **14/14** on hosted dev + cd-dev [`35567004695`](https://github.com/sprmke/kame-homes/actions/runs/35567004695) (`de1a6a05`, 2026-09-21). Full 21.6 table + Playwright still open.                                                  | Tests + seed data |

## Measured before / after

| Metric                                           | Before                                         | After                                                         | Difference                          |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Auth matrix                                      | None                                           | `audit-auth-matrix.mjs` over 296 functions; `--check` in CI   | Wrapper-auth regression blocked     |
| `MISSING-resource-scope` judgments               | Heuristic list only                            | Grouped N/A judgments recorded                                | Humans do not re-derive the 50 rows |
| Super-admin writes without `logSuperAdminAction` | FAQ/playbook/support/pricing/settings/contract | Those mutators now log after success                          | Console audit trail                 |
| Guest HMAC token                                 | Unaudited                                      | 180-day TTL, booking-id only, no denylist, telemetry redacted | Gaps explicit                       |
| Sign-out cache                                   | Unverified                                     | Code clears query + offline IDB on `SIGNED_OUT`               | Display proof still open            |

## Implementation status (2026-09-18 session)

**Phase 21.1 (auth matrix) shipped as a static, regex-based conformance sweep** — `scripts/dev/audit-auth-matrix.mjs`, mirroring doc 18's `audit-edge-functions.mjs` shape. It classifies every one of the 296 non-`_shared` functions by declared tier (from the `serve*` wrapper: `serveAdmin`→legacy-admin, `serveSuperAdmin`→super-admin, `serveAuthenticated`→org/guest-authenticated, `servePublic`→guest-anon, `serveCronPost`→cron), then greps for resource-scope-check and permission-leaf-check call sites across ~45 known helper names (`verifyOrgAccess`, `verifyPropertyAccess`, `resolveScopedParkingAccess`, `assertBookingBelongsToProperty`, `requireOrgTeamContext`, `resolveFinanceAssetAccess`, `resolveSupportTicketScope`, the `accessPermissionExpansion`/`bookingsPermissionExpansion`/etc. family, and more — full list in the script). A committed CSV snapshot is at `docs/workflow/planned/production-readiness-checklist/baselines/auth-matrix-doc21.csv`.

**Key architectural finding, confirmed by reading `_shared/serveEdge.ts`:** authentication (check type 1) is fully enforced by the wrapper itself for every function except `servePublic` (anon by design) — `serveAdmin`/`serveSuperAdmin`/`serveAuthenticated` all call their respective `verify*` function before the handler body runs, so **zero functions can be missing authentication** while using a `serve*` wrapper (verified: 0 raw/no-serve functions outside doc 18's already-reviewed 19-name allowlist). This closes most of 21.2's "missing authentication" class outright — the residual risk in this codebase is entirely in resource-scope (#2, the IDOR class) and permission-leaf (#3) checks, which are NOT wrapper-enforced and must be called explicitly per handler.

**Iterative false-positive reduction (documented so the next session trusts the script, not just re-derives it):** the sweep started at 73 functions with zero resource-scope/permission-leaf signal, then was refined against hand-read handler bodies down to 0 — every reduction was a verified false positive (own-record access via `user.id` passed into a named service function; a brand-new-resource creation with nothing to own-check yet; a global non-tenant content read; an ownership check living one import-hop below the handler in a `_shared/*.ts` callee the single-file regex can't see). The script documents each category inline (`NO_SCOPE_NEEDED_ALLOWLIST`, `SCOPE_VIA_CALLEE_ALLOWLIST`, the named own-record patterns) with the specific function read to justify it — not a blanket suppression. **This is a heuristic triage tool, not proof of correctness for any single function** — same caveat as doc 18's script.

**CI guard shipped**: `node scripts/dev/audit-auth-matrix.mjs --check` fails on (a) any function with no `serve*`/raw-serve detected, (b) any function on `serveAdmin`/`serveAuthenticated` with zero resource-scope AND zero permission-leaf signal. Wired into `ci.yml`, `cd-dev.yml`, and `ci-quality-gate.sh` (`bun run check:auth-matrix`). Currently green: 0 functions with zero authz signal.

### Scope-gap judgments (`--gaps-only`, 2026-09-18)

`--check` already allows these. One-line human judgment so the next session does not re-read every handler:

| Class                        | Functions                                                                                                                                                                                                                                                                | Judgment                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Super-admin platform-wide    | FAQ/playbook CRUD + admin lists, `list-organizations-admin`, `get-organization-admin`, `list-support-tickets-admin`, `get-support-ticket-admin`, `list-super-admin-audit`, `super-admin-overview` / `search` / `ai-usage` / `verification`, `get-platform-host-settings` | N/A — no tenant resource. `SUPER_ADMIN_EMAILS` is the scope.         |
| Public catalog               | `list-public-*`, `search-listings`, `search-suggestions`, `property-page-view`                                                                                                                                                                                           | N/A — anonymous public listings.                                     |
| Unguessable guest id         | `get-parking-booking-status`, `get-pay-parking`                                                                                                                                                                                                                          | Capability-style booking UUID; identical 404.                        |
| Own-record authenticated     | `list-organizations`                                                                                                                                                                                                                                                     | Memberships for `user.id` from JWT. Permission leaf present.         |
| Raw-serve (doc 18 allowlist) | `submit-form`, `submit-form-completion`, `submit-sd-form`, `submit-pay-parking`, crons, Meta webhook/OAuth/backfill, `ical-export`, uploads, `parking-broadcast-email`                                                                                                   | Auth is handler-specific; already reviewed as the 19-name allowlist. |

### Capability tokens (21.3) — audited

`guestBookingAccessToken.ts`: HMAC `v1.{bookingId}.{exp}.{sig}`, default TTL **180 days**, optional `GUEST_BOOKING_ACCESS_ENFORCE`, 30-day legacy bare-UUID grace. **Not purpose-scoped.** **No denylist** on cancel. PostHog drops `access`/`token` keys; `handleEdgeError` redacts query-param values. Product follow-up: shorter TTL, purpose claim, cancel revocation.

### Sign-out (21.3) — code complete, display open

`PwaQueryPersistence` listens for `SIGNED_OUT`, `queryClient.clear()`, `purgeOfflineState()`. Admin and guest sign-out both call `supabase.auth.signOut()`. Shared-device Cache Storage still needs a human pass.

### Invites (21.4) — code complete, tests open

`acceptOrgInvitation` (property/parking mirrors): pending + expiry + signed-in email must match invite email; `role_id` from the invite row, not the request body; status set to `accepted`. Replay after accept fails `status !== 'pending'`. Adversarial suite still unwritten.

### Super-admin audit (21.5) — mutating writers covered this pass

`logSuperAdminAction` after successful writes on: help-center FAQ CRUD, host-playbook CRUD, support ticket status + admin reply, pricing-plans POST/PATCH, platform payment/host/parking settings, dashboard-assistant global settings PATCH, decide-contract-consideration. Step-up OTP already gated the sensitive ones (`GATED_SUPER_ADMIN_ACTIONS`). Reads: N/A.

**Still blocked** — parity tests, shared-device PWA proof, invite/adversarial suites (rows 2, 3, 5, 7 in Remaining work).

## The seven tiers (from `CLAUDE.md` — do not conflate)

| Tier                | Gate                                                      | Notes                              |
| ------------------- | --------------------------------------------------------- | ---------------------------------- |
| Guest anon          | none                                                      | Public endpoints, anon key         |
| Guest authenticated | Supabase Auth, **separate identity**                      | Guest portal only, never admin     |
| Legacy admin        | `ADMIN_ALLOWED_EMAILS` + `_shared/auth.ts#verifyAdminJwt` | First line of every admin function |
| Org                 | `orgAuth.ts#verifyOrgAccess`                              | owner / org admin / member         |
| Property            | `propertyScope.ts#verifyPropertyAccess`                   | built-in + custom roles            |
| Parking             | `parkingScope.ts#resolveScopedParkingAccess`              | separate scope from property       |
| Super-admin         | `SUPER_ADMIN_EMAILS`                                      | gates `/admin/*`                   |

**Critical architectural fact:** `verify_jwt=false` on most functions (Kong's HS256 check rejects modern tokens), so **the handler's auth call is the only boundary**. A function that forgets it is fully open. There is no platform backstop.

## Prior art — do not redo

| Shipped                                                                | Where                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super-admin emails removed from the client bundle                      | Launch audit P1-4 — `list-organizations` returns `isSuperAdmin`                                                                                               |
| Browser-side writes moved behind the permission layer                  | P1-5 — `update-booking-details` with allowlist + permissions + CAS                                                                                            |
| `assertBookingBelongsToProperty` rejects NULL/mismatched `property_id` | P1-2                                                                                                                                                          |
| Step-up OTP for sensitive settings + super-admin                       | [`sensitive-settings-email-otp.md`](../../done/sensitive-settings-email-otp.md), [`super-admin-step-up-otp.md`](../../for-testing/super-admin-step-up-otp.md) |
| Granular team permissions                                              | [`org-granular-team-permissions.md`](../../for-testing/org-granular-team-permissions.md)                                                                      |
| OTP single-flight (client-side)                                        | `ui/src/features/guest/auth/lib/otpRequestGate.ts`                                                                                                            |

## Phases

### Phase 21.1 — Complete auth matrix (the core deliverable)

Extend doc 18's conformance table with an auth column audited **by reading each handler**, not by trusting the wrapper name. For all 300 functions record: declared tier, actual verification call, resource-scope check, and permission-leaf check.

Three distinct failures to find:

1. **Missing authentication** — no identity verified. Total bypass.
2. **Missing authorization** — identity verified but resource ownership not checked. This is the IDOR class: a valid host token reading another org's booking by ID. The `property_id` NULL bug was this.
3. **Missing permission leaf** — authorized for the resource but not for that _action_ (viewing finance vs editing pricing).

**Every function must check all three** where applicable. Most real-world breaches in multi-tenant apps are #2.

### Phase 21.2 — Client/server parity

For every permission leaf, verify the server enforces what the UI hides. Build a parity test: for each role, call every endpoint that role's UI does not expose and assert 403.

**This is the highest-value test in this entire folder.** Hiding a button is not access control, and this app has extensive JSONB-scoped permissions where drift is easy.

### Phase 21.3 — Session and token handling

- Token storage, refresh, and expiry behavior; what happens to an open dashboard when a session expires mid-action (it must not silently discard an in-progress edit).
- Sign-out must clear query cache, PostHog identity (already handled), realtime subscriptions, and any PWA-cached tenant data. **Cached data surviving sign-out on a shared device is a real leak.**
- Guest capability tokens (`guestBookingAccessToken.ts`, stay-guide/form tokens): verify TTL, single-purpose scope, revocation on booking cancellation, and that they are never logged or sent to analytics (`posthogSanitize.ts` should cover URL tokens — verify).
- Role/permission changes must take effect promptly. If permissions are cached in a JWT claim, a revoked admin keeps access until expiry; if read per request, that is a cost. Decide and document.

### Phase 21.4 — Invitation and onboarding flows

Team invites (org, property, parking) are a privilege-escalation surface:

- Invite tokens: single-use, expiring, bound to the invited email.
- Accepting an invite must not allow choosing a higher role than offered.
- Verify an invite cannot be replayed after revocation or after the inviter loses their own permission.

### Phase 21.5 — Super-admin tier

- `SUPER_ADMIN_EMAILS` verified server-side on every `/admin/*` endpoint, never inferred from the client.
- Step-up OTP on destructive actions (already shipped — verify coverage across the console).
- Every super-admin action audit-logged with actor identity (`superAdminAudit.ts` exists — verify coverage).
- Impersonation, if it exists, must be logged, time-boxed, and clearly indicated in the UI.

### Phase 21.6 — Negative testing

Add a Playwright + edge test suite that is specifically adversarial:

| Attack                                                        | Expected |
| ------------------------------------------------------------- | -------- |
| Host A requests Host B's booking/property/finance/media by ID | 404      |
| Member role calls an owner-only endpoint                      | 403      |
| Guest token used on an admin endpoint                         | 401/403  |
| Expired/revoked capability token                              | 401      |
| Anon calls an authenticated endpoint                          | 401      |
| Parking-scoped user reaches property endpoints                | 403      |
| Non-super-admin calls `/admin/*` functions                    | 403      |
| Invite token replayed after use                               | 400      |

Each case gets a test. This suite is the evidence that closes this doc.

## Edge cases

- **Separate guest identity vs admin identity** — the same person can be both. Verify a guest session can never be mistaken for an admin session by any code path.
- **Org owner vs org admin vs property member** — overlapping scopes where a property member of one property must not read a sibling property.
- **Parking is a separate vertical**, not a property sub-feature. Property permissions must not imply parking access.
- **Permission expansion helpers** (`accessPermissionExpansion.ts`, `bookingsPermissionExpansion.ts`, `legacyPermissionExpansion.ts`, and several others) are where a subtle over-grant hides. Unit-test the expansion functions directly with exhaustive role fixtures.
- **Legacy permission formats** — migration between old and new shapes can silently grant more. Test both.
- **Service-role client in a user-scoped path** bypasses everything.
- **Email as identity** — `ADMIN_ALLOWED_EMAILS`/`SUPER_ADMIN_EMAILS` assume email immutability and case-insensitivity. Normalize case and confirm an email change cannot inherit privileges.
- **Deleted/suspended user with an active session** keeps access until token expiry unless checked per request.

## Exit gate

- [x] Auth matrix for all 296 functions, via static sweep (`audit-auth-matrix.mjs`) — not a hand-read of every handler, but every wrapper/scope/permission call site is pattern-matched and the 73 initial ambiguous cases were individually hand-verified down to 0. CI-enforced against regression.
- [x] Zero functions missing authentication (wrapper-level guarantee, verified by reading `serveEdge.ts`); zero functions with no resource-scope-or-permission-leaf signal at all (heuristic, CI-guarded).
- [x] `MISSING-resource-scope` rows judged (grouped table above). Not IDOR.
- [ ] Client/server parity test passes for every role × endpoint combination. Not attempted — needs seeded roles against a running stack.
- [ ] Sign-out clears query cache, realtime, and PWA-cached tenant data — **code path exists**; not verified on a shared-device scenario.
- [x] Capability tokens audited: TTL 180 days, not single-purpose, no cancel denylist, not logged (query values redacted). Product follow-up listed in Remaining work.
- [ ] Invite flows proven single-use, expiring, email-bound, non-escalating **by test**. Code review says they are; suite not written.
- [x] Super-admin mutating actions listed above now `logSuperAdminAction`; step-up already on `GATED_SUPER_ADMIN_ACTIONS`. Impersonation: none found.
- [ ] Adversarial suite green; each case fails correctly when the check is removed. **Partial:** live smoke **14/14** on cd-dev `35567004695` (seeded IDOR/invite rows still open).
- [ ] Permission expansion helpers unit-tested (21 prior art). **Partial:** `permissionExpansion_test.ts` (9) + UI `permissionExpansionDrift.test.ts` (10); property/org full chain still open.

## Docs / Plans / activity-log

- **Docs:** `.cursor/rules/admin-auth.mdc` (mandatory), `docs/PROJECT.md` (auth tiers), `docs/architecture/edge-functions.md`.
- **Plans / Team RBAC:** invoke `plans-and-permissions` — this doc _is_ the RBAC surface.
- **activity-log:** `logSuperAdminAction` → `super_admin_audit_events` (platform-only; no `organization_id`). Team invite accept already emits `team.invite_accepted`. **activity-log: N/A** for the FAQ/playbook/platform-settings writers (no org). Contract consideration already writes listing-lifecycle audit; super-admin row added this pass without an org-activity mirror (no fitting catalog action).
