---
title: 'Auth and permissions'
status: active
tags: [workflow, planned, production-readiness, auth, rbac, security]
updated: 2026-09-16
stage: planned
kind: plan
---

# 21 — Auth / Permissions

**Launch blocker.** Must close before any production cutover.

## Goal

Every endpoint and every UI surface enforces the correct one of seven auth tiers, server-side, with no gap between what the UI hides and what the API allows.

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

- [ ] Auth matrix for all 300 functions, audited by reading each handler, with all three check types recorded.
- [ ] Zero functions missing authentication; zero missing resource-scope checks; permission leaves enforced server-side.
- [ ] Client/server parity test passes for every role × endpoint combination.
- [ ] Sign-out clears query cache, realtime, and PWA-cached tenant data — verified on a shared-device scenario.
- [ ] Capability tokens: TTL, single purpose, revocation, never logged.
- [ ] Invite flows single-use, expiring, email-bound, non-escalating.
- [ ] Super-admin actions fully audit-logged with step-up on destructive operations.
- [ ] Adversarial suite green; each case fails correctly when the check is removed.

## Docs / Plans / activity-log

- **Docs:** `.cursor/rules/admin-auth.mdc` (mandatory), `docs/PROJECT.md` (auth tiers), `docs/architecture/edge-functions.md`.
- **Plans / Team RBAC:** invoke `plans-and-permissions` — this doc _is_ the RBAC surface.
- **activity-log:** invoke `audit-logging` — permission grants/revocations, invite acceptance, and super-admin actions must all emit events.
