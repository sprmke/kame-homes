# Supabase capacity model

> Read this before sizing a Supabase project or changing compute. Numbers below are
> either measured (with a date) or labelled as an estimate with the assumption stated.

Related: `docs/architecture/deployment.md` (one project, `fwor…`), `docs/PROJECT.md`,
`docs/workflow/planned/supabase-capacity-and-operational-readiness.md` (source plan),
and the 2026-11-04 baseline in
`docs/workflow/in-progress/production-readiness/evidence/supabase-capacity-2026-11-04.md`.

## 1. The limits that actually bind on Pro

Measured against Supabase docs on 2026-11-04. Pro includes a $10 compute credit.

| Resource                  |                                   Pro included | Overage                                       | Where it bites                                     |
| ------------------------- | ---------------------------------------------: | --------------------------------------------- | -------------------------------------------------- |
| Compute                   | Micro (1 GB RAM) effectively free after credit | Small ~$15/mo, Medium ~$60/mo, Large ~$110/mo | Memory commitment, DB connections, disk IO         |
| Database max connections  |      60 (Nano/Micro), 90 (Small), 120 (Medium) | Compute upgrade                               | PostgREST + Auth + Realtime pools share this       |
| Pooler max clients        |    200 (Nano/Micro), 400 (Small), 600 (Medium) | Compute upgrade                               | Edge functions and scripts                         |
| Database size             |                                      8 GB disk | $0.125/GB                                     | 68 MB now; bookings grow ~50 MB/month at 10k/month |
| Egress                    |                                         250 GB | $0.09/GB                                      | Public JSON + images; caching is the lever         |
| Storage                   |                                         100 GB | $0.021/GB                                     | Guest IDs, receipts, property media                |
| Edge Function invocations |                                       2M/month | $2/million                                    | Cron + public API calls                            |
| Realtime peak connections |                                            500 | $10 per 1,000                                 | One WebSocket per open browser tab                 |
| Realtime messages         |                                       5M/month | $2.50/million                                 | Scales with Postgres Changes subscriptions         |
| MAU                       |                                        100,000 | $0.00325/MAU                                  | Not a near-term constraint                         |

Compute sizes: Nano 0.5 GB, Micro 1 GB, Small 2 GB, Medium 4 GB, Large 8 GB (dedicated
2 vCPU). Nano and Micro cap `max_connections` at 60; Small raises it to 90.

## 2. Measured baseline (hosted dev, 2026-11-04)

| Signal                         | Value                                                          | Reading                                                            |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Compute                        | Micro, 1 GB RAM (upgraded from Nano on 2026-11-04)             | Pro compute credit covers it                                       |
| `Committed_AS` / `CommitLimit` | 86.5% after upgrade (was ~96% on Nano)                         | Kernel promise. Above the 70% stretch target, but headroom doubled |
| `MemAvailable`                 | 488 MB after upgrade (was ~194 MB)                             | 2.5x more free memory                                              |
| Swap used                      | 14.9% after upgrade (was 31-32%)                               | Reclaim pressure roughly halved                                    |
| OOM kills / Postgres restarts  | 0 / 0                                                          | Predictive warning, not an outage                                  |
| Database size                  | 68 MB (tables 2.9 MB, indexes 8.6 MB, WAL 128 MB)              | Tiny                                                               |
| Cache hit rate                 | 1.00 table and index                                           | No IO pressure                                                     |
| Postgres backends              | 7 active of 60                                                 | Not connection-bound                                               |
| Top DB time                    | `realtime.list_changes` 84% (1.36M calls / 2h47m over 92 days) | Background Realtime polling, not user traffic                      |
| Next outlier                   | `net.http_post` 28% of outlier time (9,789 calls)              | Cron fan-out via pg_net                                            |
| `request_rate_limits`          | 4,062 rows, 344 kB bloat, 20.5k writes                         | Opportunistic sweep only                                           |
| Migration drift                | 0 before this change                                           | The earlier 9-migration drift is resolved                          |

**Conclusion:** no user-facing limit is close to exhaustion. The memory chart is a
baseline-compute problem: Supabase's own services plus Postgres backends already commit
more memory than a Nano instance can comfortably back. Query tuning cannot fix that.
**Micro was applied on 2026-11-04** and cut the commitment ratio from ~96% to 86.5%
while doubling available memory. Micro keeps `max_connections` at 60; **Small** raises it
to 90 and the pooler to 400, and is the next step only when load tests or real traffic
show connection pressure.

## 3. What the repo now does to lower load

| Change                    | Effect                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `list_bookings_page` RPC  | Filtering, sorting, paging in Postgres. No tenant history in Edge memory                                           |
| Realtime binding merge    | Notifications 2 -> 1, inbox 3 -> 2, guest chat 3 -> 2 subscriptions. Each binding is polled against WAL separately |
| RLS init-plan rewrite     | 57 policies now evaluate `auth.uid()` once per statement, not per row                                              |
| Duplicate index drop      | Two identical indexes removed; less write amplification and bloat                                                  |
| Nightly retention         | `request_rate_limits`, `processed_emails`, Telegram/reminder logs, webhook events are pruned deterministically     |
| Read-only capture scripts | Metrics and advisor snapshots without touching production data                                                     |

## 4. Capacity estimates

Assumptions, stated so they can be challenged:

- A cached public page view costs 0 Edge invocations; an uncached public API call costs 1.
- 50 kB average public JSON response.
- A host keeps one tab open with notifications + inbox: 1 WebSocket, 3 Postgres Changes
  subscriptions after the merge (was 5).
- A guest chat tab: 1 WebSocket, 2 subscriptions (was 3).
- Admin list reads: 31-row page, 1 RPC, under 50 ms p95 on Small.

| Load                                                               | Public API/month |        Edge invocations/month |              Realtime connections | Realtime messages/month (est.) | Compute         | Verdict                                                                |
| ------------------------------------------------------------------ | ---------------: | ----------------------------: | --------------------------------: | -----------------------------: | --------------- | ---------------------------------------------------------------------- |
| Launch target: 250 guest + 100 host concurrent, 50k page views/day |            ~4.5M | ~4.5M (over 2M by 2.5M = ~$5) |                              ~350 |                            ~3M | Micro/Small     | Fits; cache public reads to cut invocations                            |
| 1,000 guest + 500 host concurrent, 500k page views/day             |             ~45M |         ~~45M (~~$86 overage) | ~1,500 (over 500 by 1,000 = ~$10) |                           ~30M | Medium          | Fits with Vercel caching; without it, egress is the first bill         |
| 10,000 guest + 5,000 host concurrent                               |            ~450M |               ~~450M (~~$900) |        ~15,000 (over 500 = ~$145) |                          ~300M | Large or higher | Requires a public cache tier and Broadcast instead of Postgres Changes |

**First failing component by tier, in order:**

1. **Nano/Micro memory commitment** — already at 96% with no users. Upgrade first.
2. **Public egress and Edge invocations** — can be reached before CPU. Fix with a
   same-origin Vercel cache in front of the public read endpoints.
3. **Realtime connections** — 500 included. One tab per host. Over 500 costs $10 per
   1,000, which is cheap; the real cost is message volume from Postgres Changes.
4. **Postgres connections** — 60 on Micro. At ~200 sustained requests/s with 20 ms
   statements, the PostgREST pool is the limit; Medium (120) is the next step.
5. **Disk IO / CPU** — only after the above. Shared CPU up to Medium; Large adds
   dedicated vCPUs.

## 5. Scaling triggers

| Trigger (sustained 15 min)                              | Action                                           |
| ------------------------------------------------------- | ------------------------------------------------ |
| Memory commitment > 80% of limit, or any OOM kill       | Move up one compute size                         |
| PostgREST pool waiting > 0, or connections > 80% of max | Medium, then Large                               |
| CPU > 70%                                               | One size up                                      |
| Disk IO balance < 20%                                   | One size up                                      |
| Public API p95 > 1 s uncached                           | Add/fix public cache before adding compute       |
| Realtime connections > 400                              | Confirm spend cap; then raise the Realtime limit |
| Edge invocations > 1.6M/month                           | Cache public reads; then accept overage          |
| Database size > 6 GB                                    | Review retention and archival                    |

## 6. What is deliberately not changed

- `max_connections`, `work_mem`, and `shared_buffers`: do not tune on a Nano baseline.
  Upgrade compute, measure for 24 hours, then tune only if a specific query needs it.
- Unused indexes on an idle dev database: no index is dropped based on zero scans.
- Notifications and `activity_log`: product-visible retention needs an owner decision.
- Dashboard and finance aggregates: still compute in Edge from a bounded booking set.
  This is the next query-shape project once real traffic exists; rewriting them without
  a large-tenant seed would trade correctness for an unmeasured win.

## 7. Operating checklist

1. Confirm the project's compute size in Dashboard -> Settings -> Infrastructure.
2. Confirm Billing -> Spend cap. Pro without a cap bills overages; with a cap, usage is
   throttled at the cap.
3. Run `bun run perf:supabase:snapshot` weekly and keep the output out of git.
4. Set alerts for memory commitment, OOM, connections, 5xx rate, and Realtime
   connections (thresholds in the plan, Phase 1).
5. Re-run the load matrix in `scripts/performance/load-test/README.md` after any compute
   change and record the first failing component.
