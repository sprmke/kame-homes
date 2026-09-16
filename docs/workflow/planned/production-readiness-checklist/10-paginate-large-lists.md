---
title: 'Paginate large lists'
status: active
tags: [workflow, planned, production-readiness, performance, database]
updated: 2026-09-16
stage: planned
kind: plan
---

# 10 — Paginate large lists

## Goal

No endpoint, query, or UI list can grow unbounded with tenant data. Every list has a server-enforced page size, a stable order, and a cursor that survives concurrent writes.

## Prior art — do not redo

| Already correct — use as the reference pattern         | Where                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Keyset pagination + capped limit + bounded window      | `list-activity-log`, `notifications-list`                                        |
| `placeholderData: keepPreviousData` on paginated hooks | All paginated UI hooks (audited in the performance sibling plan — no gaps found) |
| Virtualized feed                                       | `ActivityFeedList.tsx` via `@tanstack/react-virtual`                             |

## Known defects already filed (fix here or there, not twice)

Both are documented in [`performance-optimization-production-readiness.md`](../../for-testing/performance-optimization-production-readiness.md) §C and remain open:

| Site                                                               | Defect                                                                                                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_shared/databaseService.ts:904-936` (`listBookings`)              | Fetches **all** matching rows, then paginates in memory. Its own comment concedes this is only "acceptable for ≤ a few thousand rows." Backs the primary admin bookings table |
| `_shared/financeService.ts:184-190` (`fetchAllBookingsForFinance`) | `select('*')` with **no limit** over the entire property booking history on every finance request, then filters/sorts/paginates in JS                                         |

These are the two highest-severity items in this doc. Both are **unbounded memory growth proportional to tenant size** — they work in dev and degrade non-linearly as a real property accumulates bookings.

## Phases

### Phase 10.1 — Audit every list-returning surface

Sweep all 300 edge functions for the unbounded pattern. Flag any query that:

- calls `.select()` without a `.range()` or `.limit()`, **and**
- can return a row count that grows with tenant activity (bookings, line items, messages, notifications, activity, guests, media, logs, AI usage).

Produce a table: function → table → bound present? → worst-case row count at 100 properties × 3 years.

**Static-list exception:** queries over inherently bounded tables (plan catalog, status enums, a single org's property list, team members) do not need pagination. Bound them anyway with a generous `.limit()` as a safety net — an unbounded query over a table that _should_ be small is exactly how one bad row insert takes down a page.

### Phase 10.2 — Fix the two known unbounded queries

**`listBookings`:** push filter + sort + `.range()` into SQL. The blocker is that its sort/filter shape is computed in JS (`bookingsListSort.ts`, `bookingsStatusFilter.ts`). Options, in order of preference:

1. Translate the sort/filter to SQL directly where expressible.
2. If the ordering depends on derived values, add a generated column or an indexed view carrying the sort key.
3. Only as a last resort, keep JS sorting but bound the input window by date range.

**`fetchAllBookingsForFinance`:** push the date-range and status filters into the query and paginate at the DB. Finance totals that must span the whole period should come from a SQL aggregate (`SUM`) rather than by fetching rows to add them up in JS — a separate, cheap query.

**Edge case:** aggregate-over-page vs aggregate-over-set. A summary computed from the current page is wrong. Totals must be a separate aggregate query over the full filtered set, and the UI must not imply the page total is the grand total.

### Phase 10.3 — Standardize the pagination contract

One shape across all list endpoints:

```ts
// request
{ limit: number (default 25, max 100), cursor?: string, sort?: string, filters?: {...} }
// response
{ items: T[], nextCursor: string | null, totalCount?: number }
```

Rules:

- **Server clamps the limit.** A client asking for `limit=100000` gets 100. Never trust the client bound — this is a denial-of-service control, not a convenience (doc 23).
- **Keyset (cursor) over offset** for anything large or realtime-fed. Offset pagination re-scans and skips/duplicates rows when items are inserted between page fetches, which this app does constantly (new bookings, new messages).
- **Deterministic ordering**: every sort must include a unique tiebreaker (`id`) or the cursor is unstable and rows repeat or vanish across pages.
- `totalCount` is **optional and expensive** — a `COUNT(*)` over a large filtered set is its own performance problem. Prefer "load more" over numbered pages; where a count is required, use an approximate count or cache it (doc 12).

### Phase 10.4 — UI patterns

| List                                            | Pattern                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| Bookings, finance, maintenance, team            | Paged table + `keepPreviousData`                      |
| Inbox threads/messages, activity, notifications | Infinite scroll + virtualization                      |
| Public property/parking search                  | Paged or infinite; must be crawlable — see edge cases |
| Guest trips/bookings                            | Paged, small                                          |
| Super-admin cross-org lists                     | Paged, hard-capped                                    |

Pair with doc 03 (virtualization) and doc 07 (skeletons for first page, no skeleton on next page).

### Phase 10.5 — Non-UI consumers

Pagination is not only a UI concern. Audit and bound:

- **Crons** — `contractExpiryCron` loads all orgs and all properties/parkings every tick (already filed). Any cron that scans a whole table must batch and checkpoint.
- **Exports** — finance PDF/CSV export must stream or chunk, not materialize everything in edge-function memory. Edge functions have hard memory and execution-time limits; a large export is the most likely OOM in this codebase.
- **AI context builders** — `dashboardAssistantContext` and inbox AI context must bound how many rows they pull into a prompt. Unbounded here is both a cost and a token-limit failure.
- **Telegram/notification fan-out** — bound and batch recipients.
- **Data sync scripts** — `scripts/data/*` must paginate against the API.

### Phase 10.6 — Guard

- Add a CI grep/AST check flagging `.select(` without `.limit(`/`.range(` in `supabase/functions/**`, with an explicit allowlist for reviewed bounded cases. This is the same enforcement shape as the existing `check-serve-public-rate-limit.sh`, so the pattern is proven in this repo.
- Add a seed script producing a large tenant (10k bookings, 50k line items, 20k messages) and run the key pages against it — **pagination bugs are invisible at dev data volume.**

## Edge cases

- **Cursor invalidation** — a cursor encoding a sort key breaks when the underlying row is edited or deleted. Encode `(sort_key, id)` and handle a missing anchor by falling back to the nearest position rather than erroring.
- **Filter change must reset the cursor.** Keeping a cursor across a filter change returns nonsense. Include the filter hash in the query key.
- **Realtime + pagination** — a new message arriving while the user is on page 3 must not shift pages. Prepend to the top page only; do not re-fetch the whole list.
- **Deleted rows and page shrink** — the last page can become empty; the UI must fall back to the previous page rather than showing an empty state.
- **Multi-tenant scoping is a security property, not a filter.** Every paginated query must apply its org/property/parking scope in the same query as the pagination. A bound without a scope means page 2 can leak another tenant's rows — the `assertBookingBelongsToProperty` class of bug already found in the launch audit (P1-2). Cross-check doc 22.
- **`.range()` is inclusive** in PostgREST (`range(0, 24)` is 25 rows). Off-by-one here duplicates or drops a row per page.
- **Sorting by a nullable column** — NULL ordering differs between databases and breaks cursors. Always specify `NULLS FIRST/LAST` explicitly.
- **SEO** — infinite scroll on public search hides results from crawlers. This is an SPA with no SSR, so search-engine visibility of listings is already limited; if organic discovery matters, that is a separate architectural decision, not a pagination fix.

## Exit gate

- [ ] All 300 edge functions audited; table of function → bound → worst-case row count committed.
- [ ] `listBookings` and `fetchAllBookingsForFinance` paginate at the DB; verified with the large-tenant seed.
- [ ] Every list endpoint uses the standard contract with a **server-clamped** max limit.
- [ ] All large/realtime lists use keyset cursors with a unique tiebreaker.
- [ ] Aggregates computed by SQL over the full filtered set, never summed from a page.
- [ ] Crons, exports, and AI context builders bounded and batched.
- [ ] Large-tenant seed script committed; key pages profiled against it and within budget.
- [ ] CI check flags unbounded `.select(` in edge functions.

## Docs / Plans / activity-log

- **Docs:** `docs/architecture/edge-functions.md` (pagination contract), `docs/PROJECT.md` (API shapes), route guides for any page whose paging UX changes.
- **Plans / Team RBAC:** N/A — unless page-size limits become plan-tiered, in which case run `plans-and-permissions`.
- **activity-log:** N/A — read paths only.
