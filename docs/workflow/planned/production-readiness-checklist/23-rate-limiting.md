---
title: 'Rate limiting'
status: active
tags: [workflow, planned, production-readiness, security, rate-limit, cost]
updated: 2026-09-16
stage: planned
kind: plan
---

# 23 — Rate limiting

**Launch blocker.** The app exposes anonymous endpoints that cost real money per call (AI, email, SMS-like sends, map loads, payment API calls).

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

- [ ] Limit matrix committed covering every endpoint class.
- [ ] Per-user/per-org limiting applied by default in the authenticated wrappers; shipped log-only first, then enforced.
- [ ] Limits calibrated against real usage from the doc-00 baseline; no false positives in a normal-use E2E run.
- [ ] `429` + `Retry-After`; client backs off and never auto-retries a 429.
- [ ] All six allowlisted handlers documented with their alternative protection.
- [ ] Fail-open/fail-closed decided and implemented per class.
- [ ] Limiter metrics + alerting + super-admin visibility live.
- [ ] Limiter table swept and indexed.
- [ ] CI coverage script extended to authenticated wrappers.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (mandatory), `.cursor/rules/supabase-edge-functions.mdc`, `docs/guides/testing/cost-abuse-verification.md`.
- **Plans / Team RBAC:** rate limits are a plausible plan-tier dimension — invoke `plans-and-permissions` if limits differ by plan.
- **activity-log:** invoke `audit-logging` — sustained limiting or a manual block/unblock is worth an event.
