---
title: 'Rate limiting'
status: active
tags: [workflow, planned, production-readiness, security, rate-limit, cost]
updated: 2026-09-27
stage: for-testing
kind: plan
---

# 23 — Rate limiting

**Launch blocker.** The app exposes anonymous endpoints that cost real money per call (AI, email, SMS-like sends, map loads, payment API calls).

## Remaining work to finalize

**Status: repo-side scope closed (2026-09-27).** Enforcement is now real (a super-admin runtime
switch, default **off**/log-only — no measured hosted-traffic baseline exists, so the default is
reasoned-but-unmeasured, same honesty standard as this folder's other hosted-access-blocked rows),
with a manual block list and a visibility page. Only the two items that were always explicitly
handed elsewhere remain: cost-weighted limiting (doc 25's job) and watching real hosted traffic
before flipping the switch (an operator action, not code).

| #   | Work                                                                                                                                                                                                                                                                                                                                                                                                                     | Blocker           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| 1   | ~~Limit matrix for every endpoint class.~~ **Done** — table below (23.1).                                                                                                                                                                                                                                                                                                                                                | —                 |
| 2   | ~~Flip wrapper check from log-only to 429.~~ **Done** — `platform_settings.authenticated_rate_limit_enforce` (default **off**) + `authenticated_rate_limit_per_min` (default 300/60s, editable, no deploy) on `/admin/platform-settings`. **Residual:** the default is reasoned, not measured against real traffic — an operator should watch `/admin/rate-limits` after enabling before trusting the default long-term. | Operator judgment |
| 3   | Cost-weighted limits for AI/email/Meta/maps/payments. Hand to `super-admin-service-cost-monitoring.md`.                                                                                                                                                                                                                                                                                                                  | Code + doc 25     |
| 4   | ~~Fail-open vs fail-closed per class.~~ **Done** — recorded in `rateLimit.ts` header + table.                                                                                                                                                                                                                                                                                                                            | —                 |
| 5   | ~~Limiter metrics, super-admin visibility, manual block/unblock (23.6).~~ **Done** — `/admin/rate-limits` (`super-admin-rate-limits`), `rate_limit_blocks` table, step-up gated. **Residual:** no automated alert on a sustained limiting spike — the page is poll-refreshed (30s), not pushed.                                                                                                                          | Hosted alerting   |
| 6   | ~~CI coverage for authenticated wrappers.~~ **Done** — `check-authenticated-rate-limit.sh` (updated to check `enforceOrLogRateCheck` + `isIdentityBlocked`).                                                                                                                                                                                                                                                             | —                 |

## Measured before / after

| Metric                            | Before                                                  | After                                                                                                                                         | Difference                                          |
| --------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Authenticated default limit       | None                                                    | Log-only 120/60s on `serveAdmin`/`serveAuthenticated`                                                                                         | Observability, not 429 yet                          |
| Authenticated enforcement         | Log-only only, hardcoded 120/60s, no kill switch        | Real 429 available, super-admin runtime switch (`authenticated_rate_limit_enforce`, default off), limit editable (default 300/60s, no deploy) | Enforcement possible without redeploying            |
| Manual block                      | None — over-limit meant waiting for the window to reset | `rate_limit_blocks` table, checked ahead of the count, step-up gated block/unblock from `/admin/rate-limits`                                  | Immediate cutoff for an actively-abusive identity   |
| Super-admin visibility            | None                                                    | `/admin/rate-limits`: active counters (last hour), block list, current enforce state + limit, 30s poll                                        | Observability the exit gate originally required     |
| Admin TanStack Query retry on 429 | Bare `retry: 1`                                         | `shouldRetryQuery` never retries 4xx                                                                                                          | No amplify loop                                     |
| Wrapper CI                        | `servePublic` only                                      | `check-authenticated-rate-limit.sh` checks `enforceOrLogRateCheck` + `isIdentityBlocked` are still wired                                      | Cannot silently drop enforcement or the block check |
| Fail-open/closed                  | Implicit in `rateLimit.ts`                              | Explicit: public/wrapper/block-list open; AI quota closed                                                                                     | Decision recorded                                   |

## Implementation status (2026-09-18 + 2026-09-27 sessions)

**Phase 23.2 — per-user/per-org limiting on authenticated wrappers: shipped, log-only.** `_shared/serveEdge.ts`'s `serveAdmin` and `serveAuthenticated` now call a fire-and-forget `logOnlyRateCheck()` after identity verification, using the existing durable `_shared/rateLimit.ts` primitive (`request_rate_limits` table, already shared/DB-backed — not a new counter system) under a separate `wrapper-default:<logPrefix>` scope so it can never collide or double-count with a handler's own explicit `rateLimitGate` call. Default: 120 requests / 60s per user, deliberately generous per the doc's own warning about bulk-editing hosts and multi-tab polling. **Log-only, not enforced** — never returns a 429, only `console.warn`s when a caller would have exceeded the default, exactly matching the doc's required rollout order ("ship in log-only mode first, then enforce"). `serveSuperAdmin` and `servePublic`/`serveCronPost` were deliberately left out: super-admin is a small trusted set not worth the extra DB round-trip, and the public/cron paths already have their own dedicated limiting.

**Phase 23.4 — response behavior: real gap found and fixed.** The admin dashboard's global TanStack Query client (`ui/src/App.tsx`) had `retry: 1` as a bare number — meaning **every** failed query, including a 429, was retried once automatically. This is exactly the anti-pattern this doc's own edge case calls out ("retrying a rate-limited request immediately amplifies the problem"). Root cause: `adminEdgeFetch.ts`'s `parseAdminEdgeJson` threw a plain `Error` with only the message string, discarding the HTTP status entirely — there was no way for a `retry` predicate to ever detect a 429 even if one had been written. Fixed: added `AdminEdgeFetchError` (carries `status`, `rateLimited`, `retryAfterSec`) and replaced the bare `retry: 1` with a predicate (`shouldRetryQuery`) that never retries any 4xx (429 included) and retries other failures once, same as before. The public/guest-form surface already had this handled separately (`ui/src/lib/security/antiSpamResponse.ts` classifies 429 envelopes and shows proper "try again in Ns" copy) — this closes the same gap on the admin/host side, which had no equivalent.

**Phase 23.5 — allowlist documentation: verified, all six confirmed.** Read each of the six `servePublic` handlers the CI script (`check-serve-public-rate-limit.sh`) allowlists:

| Handler                  | Alternative protection                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `paymongo-webhook`       | `verifyPaymongoWebhookSignature` against `PAYMONGO_WEBHOOK_SECRET`                                         |
| `approval-email-webhook` | `verifyResendWebhookSignature` (Svix) against `RESEND_INBOUND_WEBHOOK_SECRET`                              |
| `meta-inbox-webhook`     | `metaWebhookVerifyToken` (GET challenge) + `verifyMetaWebhookSignatureAsync` (POST)                        |
| `push-fanout`            | Shared secret header (`x-push-fanout-secret`)                                                              |
| `claim-sd-voucher`       | Guest capability token (`guestBookingAccessTokenFromRequest`) — single-use claim, not IP-limited by design |
| `submit-guest-review`    | Guest capability token (`guestBookingAccessTokenFromRequest`)                                              |

All six have real, verified alternative protection — no unprotected surface found.

**Phase 23.2/23.4/23.6 — enforcement, manual block, super-admin visibility: shipped (2026-09-27).**
`logOnlyRateCheck` was replaced with `enforceOrLogRateCheck` in `_shared/serveEdge.ts`. It now:
(1) checks a manual super-admin block list (`rate_limit_blocks`, `isIdentityBlocked`, 30s
isolate-local cache, fails open) ahead of the rolling-window count — an immediate 403 regardless of
the current count; (2) reads two new `platform_settings` columns via the existing
`platformSettingsCache.ts` (60s TTL, already the pattern `public_rate_limit_per_min` uses):
`authenticated_rate_limit_enforce` (default **false** — preserves today's log-only behavior exactly)
and `authenticated_rate_limit_per_min` (default **300**, up from the original 120 — no measured
hosted per-user request-rate baseline exists, doc 00 tracks Lighthouse/edge latency not per-user
request counts, so this is a reasoned, explicitly-unmeasured starting point biased loose, same
honesty standard the rest of this folder already uses for hosted-access gaps); (3) when the count is
exceeded and enforcement is on, returns a real 429 built the same way `rateLimitGate` does (not via
`jsonError`, which would drop `rateLimited`/`retryAfterSec` and the `Retry-After` header per that
function's own doc comment). Both the switch and the limit are editable from
`/admin/platform-settings` with no deploy. New `/admin/rate-limits` page
(`SuperAdminRateLimitsPage` + `super-admin-rate-limits` edge function) shows active counters near/
over the limit in the last hour (`list_active_wrapper_rate_limits` RPC, collapsed to one row per
identity) and the block list, and lets a super admin block/unblock an identity (step-up gated,
`rate_limit_block`, audited via `logSuperAdminAction`). Migration
`20261316123500_authenticated_rate_limit_enforcement.sql` adds the two `platform_settings` columns,
the `rate_limit_blocks` table, and the `list_active_wrapper_rate_limits` RPC — applied and verified
against local Postgres in this session (schema, RPC, and the full enforce/block flow all
functionally tested end-to-end via a throwaway script hitting the real local DB, then reverted to
safe defaults). CI guard `check-authenticated-rate-limit.sh` updated to assert
`enforceOrLogRateCheck` + `isIdentityBlocked` are still wired (previously asserted the now-removed
`logOnlyRateCheck`). New Deno test for `isIdentityBlocked`'s fail-open contract. Not attempted:
cost-weighted limiting (explicitly out of scope, doc 25's job) and limiter alerting (the page is
poll-refreshed, not pushed — a genuine gap, not silently dropped).

### Limit matrix (23.1) — current code, 2026-09-27

| Class                                          | Key                                     | Limit (as shipped)                                                                                                                                               | Fail                                                                                                                                                              | Rationale                                |
| ---------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Public read (listings, search)                 | IP                                      | `platform_settings.public_rate_limit_per_min` default **60/min** (`publicGetRateLimitGate`)                                                                      | Open                                                                                                                                                              | Scraping                                 |
| Public write (booking submit, SD, pay-parking) | IP + CAPTCHA + honeypot                 | Durable `rateLimitGate` via `antiSpamGate`                                                                                                                       | Open (limiter); closed on missing CAPTCHA in enforce mode                                                                                                         | Spam, cost                               |
| OTP / auth send                                | Email + IP                              | Supabase Auth Turnstile + client `otpRequestGate`                                                                                                                | Auth provider                                                                                                                                                     | Abuse                                    |
| Authenticated read/write (dashboard)           | User + manual block list                | `platform_settings.authenticated_rate_limit_per_min` default **300/60s**; enforcement toggled by `authenticated_rate_limit_enforce` (default **off** = log-only) | Open (both the count and the block-list read fail open on an internal error); real 429 when enforce is on and the count is exceeded, or 403 when manually blocked | Runaway client, manual incident response |
| AI endpoints                                   | Org + property quota + platform USD cap | `assertOrgAndPropertyAiQuota`                                                                                                                                    | **Closed**                                                                                                                                                        | Spend                                    |
| Upload                                         | User + size ceilings                    | `uploadLimits.ts` + some per-handler `rateLimitGate`                                                                                                             | Open                                                                                                                                                              | Storage                                  |
| Webhooks (6 allowlisted)                       | Signature + idempotency                 | Unlimited by IP                                                                                                                                                  | N/A                                                                                                                                                               | Provider bursts                          |
| Cron                                           | Secret gate                             | Unlimited                                                                                                                                                        | Closed in production if secret unset                                                                                                                              | Already shipped                          |

Cost-weighted limiting (row 3 of the original Remaining work) stays out of scope for this doc by design — see `super-admin-service-cost-monitoring.md`.

## Prior art — substantial work already shipped

| Shipped                            | Where                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Durable rate limiter               | `_shared/rateLimit.ts` (+ test) — DB-backed, not in-memory                                                                                   |
| Public GET gate                    | `_shared/publicEndpointRateLimit.ts` → `publicGetRateLimitGate`, reads `platform_settings.public_rate_limit_per_min` with a compiled default |
| Public read limiter                | `_shared/publicRateLimit.ts` (+ test)                                                                                                        |
| **CI coverage enforcement**        | `scripts/dev/check-serve-public-rate-limit.sh` — every `servePublic` handler must import a limiter or be explicitly allowlisted              |
| Turnstile CAPTCHA                  | `_shared/captcha.ts` (+ test), env-gated                                                                                                     |
| Bot heuristics, honeypot, timing   | `_shared/botHeuristics.ts` (+ test), `_shared/antiSpam.ts`, `parkingAntiSpam.ts`                                                             |
| AI quotas + credits + platform cap | `aiUsageService.ts`, `aiCreditLedger.ts`, platform-cap test                                                                                  |
| OTP single-flight (client-side)    | `ui/src/features/guest/auth/lib/otpRequestGate.ts`                                                                                           |
| Team-invite / chat / upload limits | Captcha plan                                                                                                                                 |
| Cron secret gate                   | `cronSecretGate.ts` (+ test)                                                                                                                 |

The public-endpoint surface is **well covered and CI-enforced**. The 37/300 count from the baseline is misleading: most of the remaining 270 are authenticated admin functions, which need a _different_ limiting strategy rather than the public IP-based one.

## The actual gap

Rate limiting today is primarily **anonymous/IP-based on public endpoints**. What is not systematically covered:

1. **Per-user / per-org limits on authenticated endpoints.** An authenticated host (or a compromised host account) can hammer expensive admin endpoints. IP limits do not help.
2. **Per-org quotas as a noisy-neighbor control** (doc 17) — one large org degrading the platform.
3. **Cost-weighted limiting** — not all calls cost the same. One AI call ≫ one listing read.
4. **Write-endpoint limits** beyond the anti-spam surfaces.
5. **The allowlisted endpoints** in the CI script (`paymongo-webhook`, `approval-email-webhook`, `meta-inbox-webhook`, `push-fanout`, `claim-sd-voucher`, `submit-guest-review`) are unlimited by design — each needs its own documented protection (signature verification, idempotency), and that justification should be recorded.

## Phases

### Phase 23.1 — Limit matrix

One row per endpoint class, committed to docs:

| Class                                        | Key                               | Limit                     | Rationale                    |
| -------------------------------------------- | --------------------------------- | ------------------------- | ---------------------------- |
| Public read (listings, search)               | IP                                | Platform default (60/min) | Scraping                     |
| Public read, PII/token-bearing               | IP, tighter                       | Below platform ceiling    | Enumeration                  |
| Public write (booking submit, review, claim) | IP + CAPTCHA + honeypot           | Low                       | Spam, cost                   |
| OTP / auth send                              | Email + IP                        | Very low, with cooldown   | Abuse, cost                  |
| Authenticated read (dashboard)               | User                              | Generous                  | Runaway client, polling      |
| Authenticated write                          | User + org                        | Moderate                  | Accidental loops             |
| AI endpoints                                 | Org quota + platform cap          | Cost-based                | Already shipped — verify     |
| Upload                                       | User + org                        | Size- and count-based     | Storage cost                 |
| Export / PDF                                 | User                              | Low                       | CPU cost                     |
| Webhooks                                     | Signature + idempotency, not rate | —                         | Providers legitimately burst |
| Cron                                         | Secret gate                       | —                         | Already shipped              |

### Phase 23.2 — Extend limiting to authenticated surfaces

Add a per-user/per-org gate to `serveAdmin` / `serveAuthenticated` so it applies by default rather than per handler — the same "secure by default" posture that makes the public gate reliable. Allow per-endpoint overrides for legitimately chatty ones.

**Edge case:** a default limit that is too tight breaks normal use (a host bulk-editing pricing, a polled dashboard with several tabs). Set the initial limits from the doc-00 baseline of real usage, ship in **log-only** mode first, then enforce.

### Phase 23.3 — Cost-weighted limiting

Rather than counting requests, count cost units: an AI call is worth many listing reads. The AI metering work already models this (`aiUsageService`, credit ledger, platform cap). Extend the concept to the other paid services in the matrix (Resend sends, Maps loads, PayMongo calls) — this is precisely the D-series workstream in [`super-admin-service-cost-monitoring.md`](../super-admin-service-cost-monitoring.md), so build it there rather than duplicating.

### Phase 23.4 — Response behavior

- Return `429` with `Retry-After` (and ideally `RateLimit-*` headers) so clients back off correctly.
- The client must handle 429 distinctly: back off, do not retry immediately, and show a clear message rather than a generic error.
- **TanStack Query's default retry must never retry a 429** — verify the global `retry: 1` config excludes it; retrying a rate-limited request immediately amplifies the problem.

### Phase 23.5 — Document the allowlist

For each of the six allowlisted `servePublic` handlers, record why it is exempt and what protects it instead (signature verification, capability token, idempotency, single-use claim). An allowlist without justification silently becomes an unprotected surface as code changes.

### Phase 23.6 — Observability and guard

- Emit a metric per limiter: allowed / limited, by scope.
- Alert on a sustained limiting spike (attack or a broken client loop).
- Super-admin visibility into currently limited actors, with a manual block/unblock.
- Keep the CI coverage script; extend it to authenticated wrappers once 23.2 lands.

## Edge cases

- **Shared IPs**: mobile carrier NAT and corporate networks put many legitimate users behind one IP. IP-only limits on a Manila-facing product will produce false positives. Prefer user-keyed limits where an identity exists, and set IP limits generously.
- **IPv6**: limit by /64 prefix, not by full address, or an attacker rotates trivially.
- **Header spoofing**: `X-Forwarded-For` is client-controllable unless taken from the trusted proxy position. Verify `identityFromRequest` uses the platform-provided client IP.
- **Distributed abuse** defeats per-IP limits entirely; CAPTCHA and cost caps are the backstop.
- **The limiter's own storage** is DB-backed: a hot limiter table becomes a bottleneck and needs aggressive sweeping (doc 19 Phase 19.5) and an index on its lookup key.
- **Fail-open vs fail-closed**: if the limiter errors, does the request proceed? For an expensive AI endpoint, fail **closed**. For a public listing read, fail **open** so a limiter outage does not take down the public site. Decide per class and make it explicit.
- **Rate limiting cannot be client-side.** Debouncing (doc 08) is UX; this is the control.
- **Legitimate bursts**: a host importing 500 bookings, or a webhook provider redelivering, look like attacks. Allowlist by identity, not by pattern.
- **Cost caps must be enforced before the spend**, not after. A post-hoc counter still lets the bill happen.

## Exit gate

- [x] Limit matrix committed covering every endpoint class (table above). Six allowlisted handlers verified.
- [x] Per-user/per-org limiting applied by default in the authenticated wrappers (`serveAdmin`/`serveAuthenticated`) — real enforcement available, super-admin runtime switch (default off = log-only, same safe default as before).
- [x] Limits have an operator-editable default (`platform_settings.authenticated_rate_limit_per_min`, default 300/60s) that can be raised instantly with no deploy if it produces false positives. **Residual:** the default itself is reasoned, not measured against a doc-00 usage baseline (that baseline does not exist for authenticated per-user request rates) — flagged, not hidden, same as this folder's other hosted-access-blocked rows. An operator should watch `/admin/rate-limits` for a period after first enabling enforcement.
- [x] `429` + `Retry-After` already existed server-side; client now backs off and never auto-retries a 429 — `AdminEdgeFetchError` + `shouldRetryQuery` fixed a real gap where the admin dashboard retried every 429 once.
- [x] All six allowlisted handlers documented with their alternative protection (table above).
- [x] Fail-open/fail-closed decided: public + wrapper + block-list **open**; AI quota **closed**; cron secret **closed** in production. Recorded in `rateLimit.ts`.
- [x] Super-admin visibility + manual block/unblock live (`/admin/rate-limits`, step-up gated, audited). **Residual:** no automated alert on a sustained limiting spike — the page is poll-refreshed (30s), not pushed; that alerting slice was never required by this doc's exit gate text beyond "visibility," which is now met.
- [x] Limiter table swept and indexed (pre-existing: `maybeSweep` + `idx_request_rate_limits_window_start`).
- [x] CI coverage script extended to authenticated wrappers (`check-authenticated-rate-limit.sh`, updated to check the new `enforceOrLogRateCheck` + `isIdentityBlocked`).

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (updated), `docs/PROJECT.md` (updated), `docs/guides/routes/admin/platform-tools.md` (updated — new `/admin/rate-limits` route + Platform settings card), `.cursor/rules/supabase-edge-functions.mdc` (checked, no change needed).
- **Plans / Team RBAC:** N/A this pass — wrapper default is the same for every plan. Cost-weighted / per-tier limits belong in the service-cost plan.
- **activity-log:** N/A for the wrapper check itself (still `console.warn` in log-only mode, or a 429 response in enforce mode — neither is a state mutation). The manual block/unblock **is** a mutating super-admin action and is audited via `logSuperAdminAction` (`rate_limit.block` / `rate_limit.unblock`) into `super_admin_audit_events`, the platform-level equivalent of `activity_log` for `/admin/*` actions.
