---
title: 'Cloud computing'
status: active
tags: [workflow, planned, production-readiness, cloud, cost, infrastructure]
updated: 2026-09-18
stage: planned
kind: plan
---

# 25 — Cloud computing

Resource sizing, regional placement, service limits, and cost. Scaling behavior is doc 17; deployment is doc 24.

## Goal

Every cloud resource is correctly sized and placed for a Manila-centric user base, every platform limit is known before it is hit, and spend is bounded and attributable.

## Remaining work to finalize

**Status: partial — bounce suppression, vendor-risk + data-export docs, regional-placement note, and cost-amplification inventory shipped (2026-09-18).** Service limits, latency, and billing alerts still need consoles.

| #   | Work                                                                                                                                                                                                                                                                                                                                                                                            | Blocker           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Service inventory with limits, current usage, and headroom (25.1).                                                                                                                                                                                                                                                                                                                              | Hosted dashboards |
| 2   | Measure Manila → Supabase region and Manila → Vercel edge latency (25.2).                                                                                                                                                                                                                                                                                                                       | Display + hosted  |
| 3   | Confirm (and if needed change) regional placement before launch. **Repo cannot see the region** — operators check dashboards (`deployment.md` § Regional placement).                                                                                                                                                                                                                            | Depends on 2      |
| 4   | Size database compute from load-test data; write the upgrade path (25.3).                                                                                                                                                                                                                                                                                                                       | Doc 17            |
| 5   | Billing alerts at 50/80/100% on every service; hard caps where supported (25.4).                                                                                                                                                                                                                                                                                                                | Hosted billing    |
| 6   | Per-org cost attribution (`serviceGuard.ts` still absent).                                                                                                                                                                                                                                                                                                                                      | Code + billing    |
| 7   | Cap remaining cost-amplification vectors (maps, transforms, egress). ~~Resend bounce/complaint suppression.~~ **Done** — `email_suppressions` + webhook + gated on all 5 external-recipient send paths (3 guest-lifecycle + 2 support-ticket submitter notifies). Sends to operator-controlled inboxes (EMAIL_TO/EMAIL_REPLY_TO/parking_owner_emails/SUPPORT_TEAM_EMAIL) intentionally ungated. | Code + product    |
| 8   | Degradation behavior per service (25.5).                                                                                                                                                                                                                                                                                                                                                        | Product           |
| 9   | ~~Vendor risk + data-export path.~~ **Done** — `docs/architecture/deployment.md`.                                                                                                                                                                                                                                                                                                               | —                 |

## Measured before / after

| Metric                     | Before                                         | After                                                              | Difference                                               |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| Regional placement in repo | Undocumented                                   | Explicit "verify in dashboard"; Singapore is the expected target   | Operators know where                                     |
| Vendor risk / export       | Undocumented                                   | Table in `deployment.md` (Supabase dump path, no-fallback vendors) | Portability written                                      |
| Resend bounces             | Webhook dropped `email.bounced` / `complained` | `email_suppressions` + gated on all 5 external-recipient sends     | Domain-reputation vector closed for guest/host lifecycle |
| `serviceGuard.ts`          | Missing                                        | Still missing; cost plan remains the owner                         | No duplicate build                                       |

## Implementation status (2026-09-18 session)

**Phase 25.4/25.5 — Resend bounce/complaint suppression shipped.** A prior session found and documented (but did not fix) that `approval-email-webhook` silently dropped every Resend event except `email.received`. This session closed the gap:

- `supabase/migrations/20261316122000_email_suppressions_table.sql` — `email_suppressions` table (RLS enabled, no policy, service-role-only — same posture as `processed_emails`/`query_cache`). Applied and verified against a running local Postgres this session (`bun run db:migrate` succeeded; `\d email_suppressions` + `relrowsecurity` confirmed).
- `supabase/functions/_shared/emailSuppression.ts` — `recordEmailSuppression` (upsert on `email`) and `isEmailSuppressed` (fail-open on lookup error, so a suppression-check outage never blocks a legitimate send).
- `approval-email-webhook/index.ts` now dispatches `email.bounced`/`email.complained` to `processDeliveryEvent`, which records every recipient in `event.data.to` with reason/event type/message id/detail. All other event types still 200-ack-and-ignore (unchanged).
- Gated the three **guest-facing** sends in `emailService.ts` (`sendBookingAcknowledgement`, `sendReadyForCheckin`, `sendSdRefundFormRequest`) behind `isEmailSuppressed(booking.guest_email)` — these are the sends that repeat to the same address across a booking's lifecycle and are what the doc's edge case describes ("harms deliverability for every subsequent email, including booking confirmations").
- **Deliberately not gated this session:** `sendEmail`/`sendPetEmail` (GAF/pet requests — sent to `EMAIL_TO`, the ops inbox, not the guest), `sendNewBookingRequestNotify` (ops inbox), `sendParkingBroadcast` (parking owner list), and `sendSupportTicketNotify`/`sendSupportTicketSubmitterReplyNotify` (both to `SUPPORT_TEAM_EMAIL`, our own team inbox). None of these repeatedly mail an address the guest/host controls the way the 3 gated sends do.
- `deno check` clean on all three touched files (one pre-existing, unrelated `TS2559` on `bookingNotificationMetadata` at a line this change did not touch). `bun run test:edge` — 307/307 passing.

**Code review follow-up (2026-09-20).** A code-review pass across this session's work flagged that the migration's own `COMMENT ON TABLE` claimed suppression was "checked by every guest-facing send path" while only 3 of the qualifying functions actually called it — `sendSupportTicketReplyNotify` and `sendSupportTicketStatusNotify` were missed in the original pass despite both sending to `ticket.submittedByEmail` (an external guest-or-host address, not an ops inbox — the same risk category as the 3 already-gated functions, distinct from `sendSupportTicketNotify`/`sendSupportTicketSubmitterReplyNotify` which correctly go to the internal `SUPPORT_TEAM_EMAIL`). Fixed by gating both, and corrected the migration comment via a new `COMMENT ON TABLE`-only follow-on migration (`20261316122100_email_suppressions_comment_scope.sql` — editing the shipped `...122000` migration directly is blocked by the repo's own hook, per CLAUDE.md's "never edit a shipped migration" rule). Coverage is now **5 of 5** genuinely external-recipient send paths, matching what the comment claims. `deno check` clean; edge tests unaffected (no logic in the gated functions' shared helpers changed, only the two new call sites).

**Everything else in this doc remains hosted-dashboard/billing-console work with zero repo-visible signal** — no `SUPABASE_ACCESS_TOKEN`, no Vercel/Resend/Gemini/PayMongo/Meta/PostHog console access this session either. Confirmed again: `serviceGuard.ts` still does not exist. Regional placement is now documented as dashboard-only (`deployment.md` § Regional placement, `PROJECT.md`).

**Phase 25.4 — `super-admin-service-cost-monitoring.md` status checked, confirmed still `planned`.** Read the plan doc directly: `serviceGuard.ts` (the central per-service limit/degrade enforcement layer the plan specifies) does not exist in `supabase/functions/_shared/` — only the AI-specific metering (`aiUsageService.ts`, `aiCreditLedger.ts`) is built. This confirms doc 25's own instruction to "hand enforcement to the service-cost plan" is accurate — that plan has not progressed since this session; doc 25 correctly does not duplicate it.

**Phase 25.2 — regional placement: not in env files; documented as dashboard-only.** Grepped `docs/PROJECT.md`, `docs/archive/operations/ci-cd-environment-matrix.md`, `ui/vercel.json`, `supabase/config.toml` for any region identifier — none found. This pass added an operator note in `deployment.md` / `PROJECT.md`: confirm Singapore (or measure) in the vendor consoles before launch.

Everything else in this doc is genuinely hosted-dashboard/billing-console work with zero repo-visible signal — no `SUPABASE_ACCESS_TOKEN`, no Vercel/Resend/Gemini/PayMongo/Meta/PostHog console access this session. Remaining work is the table at the top of this doc.

### Cost-amplification vectors (25.4) — enumerated, not all capped

| Vector                     | Cap today                                                | Gap                                                                        |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Anonymous AI               | Quotas + credits + platform USD cap                      | OK                                                                         |
| Public map loads           | None in-app                                              | Billing cap in Google Cloud (operator)                                     |
| Image transforms (doc 09)  | Not enabled                                              | Cost guard before turning on                                               |
| Email sends                | Resend plan + anti-spam on submit + **suppression list** | Other send paths (ops inbox, parking broadcast, support) ungated by design |
| Storage egress             | Private PII buckets; CDN cacheControl                    | Orphans (doc 20)                                                           |
| Authenticated admin hammer | Log-only 120/60s (doc 23)                                | Not enforced                                                               |

## Prior art

[`super-admin-service-cost-monitoring.md`](../super-admin-service-cost-monitoring.md) is the dedicated plan for cost control: a per-service limit matrix (Resend, Gemini/Groq, voice, Google Maps, PayMongo, Supabase, PostHog, Vercel, Meta), `serviceGuard` enforcement, an auto-degrade engine, a `/admin/service-health` console, and a D1–D8 optimization workstream.

**Do not duplicate it.** This doc covers the infrastructure sizing and limits that plan assumes, and hands cost enforcement to it.

## Phases

### Phase 25.1 — Service inventory and limits

For every cloud service, record: plan/tier, hard limits, soft limits, what happens at the limit, current usage, and headroom.

| Service                 | Limits to record                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Supabase Postgres       | Compute size, storage, connections, IOPS                                                               |
| Supabase Edge Functions | Invocations, execution time ceiling, memory, concurrency                                               |
| Supabase Storage        | Storage GB, egress GB                                                                                  |
| Supabase Realtime       | Concurrent connections, messages/sec, channels                                                         |
| Supabase Auth           | MAU, email send limits (Supabase's own SMTP limits are low — verify a custom SMTP/Resend path is used) |
| Vercel                  | Bandwidth, build minutes, function invocations if any                                                  |
| Resend                  | Sends/month, sends/second, domain reputation                                                           |
| Gemini / Groq           | RPM, TPM, daily quota, per-model limits                                                                |
| Google Maps             | Loads/month, billing threshold                                                                         |
| PayMongo                | API rate limits, webhook retry policy                                                                  |
| Meta Graph              | Rate limits per app and per page                                                                       |
| PostHog                 | Events/month, session replay quota                                                                     |

**The most common launch failure is a third-party soft limit, not our own infrastructure.** Email send limits and AI RPM are the likely first walls.

### Phase 25.2 — Regional placement

Users are Manila-centric. Latency to the origin dominates every edge-function call, and no CDN fixes that.

- Confirm the Supabase project region (Singapore is the nearest realistic option) and measure Manila → region latency.
- Confirm Vercel serves static assets from a nearby edge and that edge functions execute close to the database, not close to the user — a function far from the DB pays the round-trip on every query.
- Measure and record; if the numbers are poor, region migration is far cheaper to do before launch than after.

### Phase 25.3 — Right-sizing

- Database compute: sized from the doc-17 load test, not from a guess.
- Define the upgrade path and its downtime characteristics (a compute resize usually involves a restart).
- Storage growth projection from the doc-20 audit plus expected booking volume.

### Phase 25.4 — Cost model and controls

Hand the enforcement to the service-cost plan, but ensure here that:

- Billing alerts exist on every service at 50/80/100% of budget. Several were listed as operator-blocked in prior audits — close them.
- Hard caps exist where a service supports them (Google Maps billing cap, AI platform cap).
- Cost is attributable per org so a single tenant's usage is visible (feeds plan-tier decisions).
- The **cost-amplification vectors** are enumerated and bounded: anonymous AI calls, map loads, image transforms (doc 09), email sends, storage egress. Each needs a cap before launch.

### Phase 25.5 — Quotas and graceful degradation

For each service, define behavior at the limit (doc 17 Phase 17.5). The AI path already has quota + credit + upgrade-hook handling; extend the pattern rather than inventing a new one.

### Phase 25.6 — Vendor risk

- Which services have no fallback (Supabase is the whole platform; PayMongo is the only payment provider in-market).
- What a multi-hour outage of each looks like for users, and what the communication plan is (doc 30).
- Document the data-export path from Supabase — portability is the real mitigation for total vendor dependence.

## Edge cases

- **Free/low tiers throttle silently.** A rate limit that returns 429 is visible; a tier that quietly slows queries is not. Know which behavior each service has.
- **Egress is the sneaky cost** — media-heavy public listing pages can generate large Storage egress bills. Docs 09 and 16 are the mitigations.
- **AI cost is unbounded per request** — a long conversation or a large document costs far more than a typical call. Per-request caps matter as much as monthly ones; the AI plan's cost-based enforcement covers this.
- **Cold starts** scale with the number of distinct functions. With 300 functions, rarely used ones are always cold. That is a latency characteristic to accept and measure, not a bug.
- **Resend domain reputation** — a spike of sends to invalid addresses harms deliverability for every subsequent email, including booking confirmations. Validate addresses and handle bounces (`resendWebhookVerify.ts` exists — verify bounce handling).
- **Meta app review and rate limits** differ pre- and post-review; limits can change after approval.
- **Region migration is not a config change.** It is a full data migration with downtime. Decide before launch.

## Exit gate

- [ ] Service inventory with limits, current usage, and headroom committed. Not attempted — needs hosted dashboards.
- [ ] Manila → Supabase region and Manila → Vercel edge latency measured and recorded. Not attempted — needs hosted access + a display.
- [ ] Regional placement **in the live projects** confirmed (Singapore or measured). Procedure is in `deployment.md`; dashboards not read this pass.
- [ ] Database compute sized from load-test data with a documented upgrade path. Depends on doc 17's load test, not run this session.
- [ ] Billing alerts at 50/80/100% on every service; hard caps where supported. Not attempted — needs hosted billing consoles.
- [ ] Per-org cost attribution available. `serviceGuard.ts` (the plan's central attribution layer) confirmed not built yet.
- [x] Resend bounce/complaint suppression: `email_suppressions` + webhook recording + gated on all 5 external-recipient send paths (3 guest-lifecycle + 2 support-ticket submitter notifies — extended from 3 during code review, doc comment was overstating coverage). Other cost-amplification vectors (maps, transforms, egress) still need caps.
- [ ] Degradation behavior defined per service. Not attempted this session.
- [x] Vendor risk and data-export path documented in `docs/architecture/deployment.md`.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/deployment.md` (vendor risk, region, export), `docs/architecture/integrations.md`, `docs/PROJECT.md` (env vars + region note), the service-cost plan.
- **Plans / Team RBAC:** N/A this pass — cost caps already exist as AI plan features; bounce suppression would be platform-wide, not a host entitlement.
- **activity-log:** N/A — platform operations. Suppression writes are a platform table (`email_suppressions`), not org-scoped `activity_log`.
