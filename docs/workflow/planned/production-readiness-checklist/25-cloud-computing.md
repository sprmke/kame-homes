---
title: 'Cloud computing'
status: active
tags: [workflow, planned, production-readiness, cloud, cost, infrastructure]
updated: 2026-09-16
stage: planned
kind: plan
---

# 25 — Cloud computing

Resource sizing, regional placement, service limits, and cost. Scaling behavior is doc 17; deployment is doc 24.

## Goal

Every cloud resource is correctly sized and placed for a Manila-centric user base, every platform limit is known before it is hit, and spend is bounded and attributable.

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

- [ ] Service inventory with limits, current usage, and headroom committed.
- [ ] Manila → Supabase region and Manila → Vercel edge latency measured and recorded.
- [ ] Regional placement decision documented and, if changing, executed before launch.
- [ ] Database compute sized from load-test data with a documented upgrade path.
- [ ] Billing alerts at 50/80/100% on every service; hard caps where supported.
- [ ] Per-org cost attribution available.
- [ ] Every cost-amplification vector enumerated and capped.
- [ ] Degradation behavior defined per service.
- [ ] Vendor risk and data-export path documented.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/deployment.md`, `docs/architecture/integrations.md`, `docs/PROJECT.md` (env vars), the service-cost plan.
- **Plans / Team RBAC:** cost caps map to plan tiers — invoke `plans-and-permissions`.
- **activity-log:** N/A — platform operations.
