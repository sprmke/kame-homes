---
title: 'Cache expensive queries'
status: active
tags: [workflow, planned, production-readiness, caching, database]
updated: 2026-09-16
stage: planned
kind: plan
---

# 12 — Cache expensive queries

Doc 11 caches the **HTTP response**. This doc caches the **computation** behind it, for cases where the result is expensive and the response is not publicly cacheable.

## Goal

No expensive aggregate is recomputed per request. Analytics, finance summaries, dashboard stats, search facets, and AI context are served from a cache or a materialized result with a defined freshness contract.

## Prior art — do not redo

| Shipped                                               | Where                                       |
| ----------------------------------------------------- | ------------------------------------------- |
| AI response cache, 1h TTL, SHA-256 prompt fingerprint | `_shared/aiQuotaCache.ts`                   |
| Platform settings 60s in-memory cache                 | `_shared/platformSettingsCache.ts`          |
| Client-side query cache                               | TanStack Query, `staleTime: 15_000` default |

The AI cache is a good model: content-addressed key, explicit TTL, cost-aware. Reuse its shape.

## Current state — the expensive queries

| Surface                                                                                 | Cost driver                                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Host analytics (`_shared/analyticsService.ts`, `analyticsChannel.ts`, `bookingPace.ts`) | Multi-month aggregates over bookings; occupancy, ADR, RevPAR, channel mix, pace |
| Finance summary (`financeService.ts`)                                                   | Currently fetches the full booking history per request (doc 10)                 |
| Dashboard stat tiles                                                                    | Several counts per property, polled on an interval                              |
| `propertyListStats.ts`                                                                  | Per-property rollups in list views                                              |
| Public search + facets (`publicSearch.ts`, `publicListingFacets.ts`)                    | Facet counts across the listing corpus                                          |
| Superhost metrics (`superhostMetrics.ts`)                                               | Windowed aggregates per host                                                    |
| AI usage / credit rollups                                                               | Per-org ledger aggregates                                                       |
| Smart pricing (`smartPricingEngine.ts`)                                                 | Demand/competitor computation                                                   |
| Inbox thread metrics (`inboxThreadMetrics.ts`)                                          | Per-thread aggregates across messages                                           |

Polled surfaces are the worst offenders: an expensive aggregate on a `refetchInterval` multiplies cost by every open dashboard tab.

## Phases

### Phase 12.1 — Measure, then choose

Using the doc-00 `pg_stat_statements` snapshot, rank queries by **total time** (`calls × mean_exec_time`), not by mean alone. A 40 ms query called 100k times matters more than a 2 s query called twice.

For each of the top 20, pick exactly one strategy:

| Strategy                                | When                                                     | Cost                               |
| --------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| **Fix the query** (index, better shape) | The query is expensive because it is badly shaped        | Best outcome; no staleness         |
| **Client cache only** (`staleTime`)     | Cheap-ish, per-user, tolerates staleness                 | Free; no server relief             |
| **In-memory edge cache**                | Small, hot, shared, tolerant of per-instance duplication | Free; evaporates on cold start     |
| **DB-backed cache table**               | Expensive, shared across users, needs durability         | A table + TTL + invalidation       |
| **Materialized view**                   | Heavy aggregate, tolerant of scheduled refresh           | Refresh scheduling + lock behavior |
| **Precomputed rollup table**            | Deterministic aggregates over immutable history          | Write-path work; most durable win  |

**Fix the query first.** Caching a bad query hides the problem and doubles the code paths. Docs 10 and 14 come before this one for exactly that reason.

### Phase 12.2 — Rollup tables for analytics

Analytics over historical bookings is the ideal rollup candidate: the past does not change. Build a daily rollup per property (`occupied_nights`, `revenue`, `bookings_created`, `channel`, `lead_time`) written by a nightly cron (Manila timezone) plus an incremental update on booking transitions.

Queries then read a few hundred rollup rows instead of scanning the booking history.

**Edge case:** history _does_ change — cancellations, retroactive edits, refunds. The rollup needs a repair path: recompute a date range on any booking write that touches a past date, and a nightly full-recompute of the trailing 90 days to self-heal drift.

**Edge case:** timezone. Rollups bucketed in UTC produce wrong daily numbers for a Manila-facing product. Bucket by `Asia/Manila` explicitly, using the existing `calendarAvailabilityManila.ts` helpers.

### Phase 12.3 — DB-backed cache for search facets and stats

A generic `query_cache` table (`cache_key`, `payload jsonb`, `computed_at`, `expires_at`, `scope_org_id`), read-through with TTL, following `aiQuotaCache`'s shape.

Rules:

- Key must include **every** scope input: org, property, filters, date range, and the viewer's permission set. A cache key missing a permission dimension serves privileged data to an unprivileged viewer — this is the most dangerous bug in this doc.
- Always store the org/property scope as a column so a tenant's cache can be purged wholesale.
- Cap the table size and sweep expired rows on a cron (a cache table that grows forever becomes the expensive query).

### Phase 12.4 — Stampede protection

When a hot cache entry expires, every concurrent request recomputes it simultaneously. With polled dashboards this is guaranteed, not hypothetical.

- Single-flight per key: the first request computes, others wait or get the stale value. Note the existing `ui/src/features/guest/auth/lib/otpRequestGate.ts` single-flight is **client-side** and is not a server-side precedent — an edge-side single-flight needs durable coordination (a lock row or advisory lock), since module-scope state is per-instance.
- Serve-stale-while-recomputing for analytics, where a slightly old number is fine.
- Jitter TTLs (±10%) so entries created together do not expire together.

### Phase 12.5 — Invalidation

- Scope-keyed purge on the write path: a booking transition purges that property's analytics and finance cache keys.
- Route purges through `workflowOrchestrator` side effects rather than sprinkling them in handlers — the repo's rule that side effects never live inline in a handler applies to cache invalidation too.
- Version the cache key with a schema version constant so a deploy that changes the payload shape invalidates everything automatically. Without this, a deploy serves old-shaped JSON to new client code.

### Phase 12.6 — Guard

- Record cache hit ratio per key class; expose it in the super-admin console alongside the existing cost/usage panels.
- Alert when hit ratio collapses (a key-shape bug) or when a cached endpoint's p95 rises (cache not being used).
- Add a correctness test: mutate the underlying data, assert the cached surface reflects it within the documented freshness window.

## Edge cases

- **Stale money.** Finance totals and payout figures shown stale cause real disputes. Either do not cache them, or display "as of <time>". Prefer fixing the query.
- **Permission-dimension omission** (above) — treat every cache key as a security review item.
- **Cache warm-up after deploy** — the first request per key after a deploy is slow for everyone at once. Warm the top keys in a post-deploy step, or accept it and make sure alerting does not page on it.
- **Per-instance in-memory caches are inconsistent** across edge instances: two users see different numbers at the same moment. Fine for settings, not for anything a host might screenshot and compare.
- **Materialized view refresh locks** — a non-concurrent `REFRESH MATERIALIZED VIEW` takes an exclusive lock and blocks reads. Use `CONCURRENTLY` (which requires a unique index) or rollup tables instead.
- **Cache as a crutch for a missing index** — if doc 14 finds an index that makes the query fast, delete the cache rather than keeping both.
- **Realtime + cache** — a realtime event telling the UI to refetch, which then reads a stale cache, shows the old value and looks like a broken realtime feed. Purge before emitting the event.

## Exit gate

- [ ] Top-20 expensive queries ranked by total time from `pg_stat_statements`; a strategy chosen and justified for each.
- [ ] Queries fixable by shape/index fixed (docs 10, 14) rather than cached.
- [ ] Analytics rollup tables live, with incremental update, trailing-90-day self-heal, and Manila bucketing.
- [ ] `query_cache` (or equivalent) live with scope-complete keys including permission dimensions, TTL jitter, size cap, and sweep cron.
- [ ] Stampede protection on every hot key.
- [ ] Invalidation routed through `workflowOrchestrator`; cache keys carry a schema version.
- [ ] Hit-ratio metrics visible; correctness test proves freshness within the documented window.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md`, `docs/PROJECT.md` (data model for rollup/cache tables), `docs/archive/operations/migration-runbook.md`, `docs/archive/operations/scheduled-jobs-and-testing.md` for the refresh crons.
- **Plans / Team RBAC:** N/A — unless analytics freshness becomes a plan-tier differentiator; if so, invoke `plans-and-permissions`.
- **activity-log:** N/A for cache reads. New crons follow the `system.cron_run` decision already deferred in [`activity-log-followups.md`](../activity-log-followups.md).
