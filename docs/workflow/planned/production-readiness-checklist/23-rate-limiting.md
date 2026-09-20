---
title: 'Rate limiting'
status: active
tags: [workflow, planned, production-readiness, security, rate-limit, cost]
updated: 2026-09-18
stage: planned
kind: plan
---

# 23 — Rate limiting

**Launch blocker.** The app exposes anonymous endpoints that cost real money per call (AI, email, SMS-like sends, map loads, payment API calls).

## Remaining work to finalize

**Status: partial — log-only wrapper limiting, 429-retry fix, allowlist justification, limit matrix, fail-open/closed decision, and wrapper CI guard shipped (2026-09-18).** Enforcement still needs traffic.

| #   | Work                                                                                                    | Blocker       |
| --- | ------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | ~~Limit matrix for every endpoint class.~~ **Done** — table below (23.1).                               | —             |
| 2   | Flip wrapper check from log-only to 429, after hosted traffic shows the 120/60s default is safe.        | Hosted (time) |
| 3   | Cost-weighted limits for AI/email/Meta/maps/payments. Hand to `super-admin-service-cost-monitoring.md`. | Code + doc 25 |
| 4   | ~~Fail-open vs fail-closed per class.~~ **Done** — recorded in `rateLimit.ts` header + table.           | —             |
| 5   | Limiter metrics, alerting, super-admin visibility (23.6). Sweep + index already exist.                  | Code + hosted |
| 6   | ~~CI coverage for authenticated wrappers.~~ **Done** — `check-authenticated-rate-limit.sh`.             | —             |

## Measured before / after

| Metric                            | Before                     | After                                                 | Difference                 |
| --------------------------------- | -------------------------- | ----------------------------------------------------- | -------------------------- |
| Authenticated default limit       | None                       | Log-only 120/60s on `serveAdmin`/`serveAuthenticated` | Observability, not 429 yet |
| Admin TanStack Query retry on 429 | Bare `retry: 1`            | `shouldRetryQuery` never retries 4xx                  | No amplify loop            |
| Wrapper CI                        | `servePublic` only         | `check-authenticated-rate-limit.sh` in CI             | Cannot drop log-only check |
| Fail-open/closed                  | Implicit in `rateLimit.ts` | Explicit: public/wrapper open; AI quota closed        | Decision recorded          |

## Implementation status (2026-09-18 session)

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

### Limit matrix (23.1) — current code, 2026-09-18

| Class                                          | Key                                     | Limit (as shipped)                                                                          | Fail                                                      | Rationale       |
| ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------- |
| Public read (listings, search)                 | IP                                      | `platform_settings.public_rate_limit_per_min` default **60/min** (`publicGetRateLimitGate`) | Open                                                      | Scraping        |
| Public write (booking submit, SD, pay-parking) | IP + CAPTCHA + honeypot                 | Durable `rateLimitGate` via `antiSpamGate`                                                  | Open (limiter); closed on missing CAPTCHA in enforce mode | Spam, cost      |
| OTP / auth send                                | Email + IP                              | Supabase Auth Turnstile + client `otpRequestGate`                                           | Auth provider                                             | Abuse           |
| Authenticated read/write (dashboard)           | User                                    | **120 / 60s log-only** wrapper default                                                      | Open (log-only)                                           | Runaway client  |
| AI endpoints                                   | Org + property quota + platform USD cap | `assertOrgAndPropertyAiQuota`                                                               | **Closed**                                                | Spend           |
| Upload                                         | User + size ceilings                    | `uploadLimits.ts` + some per-handler `rateLimitGate`                                        | Open                                                      | Storage         |
| Webhooks (6 allowlisted)                       | Signature + idempotency                 | Unlimited by IP                                                                             | N/A                                                       | Provider bursts |
| Cron                                           | Secret gate                             | Unlimited                                                                                   | Closed in production if secret unset                      | Already shipped |

Not attempted this session — remaining rows 2, 3, 5 in Remaining work.

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
- [x] Per-user/per-org limiting applied by default in the authenticated wrappers (`serveAdmin`/`serveAuthenticated`) — shipped log-only. Enforcement decision still pending real traffic data.
- [ ] Limits calibrated against real usage from the doc-00 baseline; no false positives in a normal-use E2E run. Default (120/60s) is a reasoned starting point, not measured against doc 00's baseline.
- [x] `429` + `Retry-After` already existed server-side; client now backs off and never auto-retries a 429 — `AdminEdgeFetchError` + `shouldRetryQuery` fixed a real gap where the admin dashboard retried every 429 once.
- [x] All six allowlisted handlers documented with their alternative protection (table above).
- [x] Fail-open/fail-closed decided: public + wrapper log-only **open**; AI quota **closed**; cron secret **closed** in production. Recorded in `rateLimit.ts`.
- [ ] Limiter metrics + alerting + super-admin visibility live. Not built this session.
- [x] Limiter table swept and indexed (pre-existing: `maybeSweep` + `idx_request_rate_limits_window_start`).
- [x] CI coverage script extended to authenticated wrappers (`check-authenticated-rate-limit.sh`).

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (mandatory), `.cursor/rules/supabase-edge-functions.mdc`, `docs/guides/testing/cost-abuse-verification.md`.
- **Plans / Team RBAC:** N/A this pass — wrapper default is the same for every plan. Cost-weighted / per-tier limits belong in the service-cost plan.
- **activity-log:** N/A — log-only `console.warn`, no block/unblock UI yet.
