# Supabase capacity baseline and before/after (2026-11-04)

Plan: [`docs/workflow/planned/supabase-capacity-and-operational-readiness.md`](../../../planned/supabase-capacity-and-operational-readiness.md)
Model: [`docs/architecture/supabase-capacity.md`](../../../../architecture/supabase-capacity.md)

All measurements are read-only against hosted project `fworvijbrwpyngycotbz`
(`Kame Space`, Singapore) and the local Supabase stack. No production mutation was
performed. The compute tier change is an operator action and was **not** done here.

## 1. Before

Captured with `bun run perf:supabase:metrics` (wraps `supabase inspect db`) plus
targeted SQL on the linked schema. Raw snapshots live in `.artifacts/` and are not
committed.

| Signal                                   | Before                                                 | Reading                                                                                       |
| ---------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Compute footprint                        | Nano-sized, ~0.5 GB RAM                                | Free-tier footprint, not the Pro default Micro                                                |
| `Committed_AS` / `CommitLimit`           | ~96%                                                   | The Dashboard warning. Kernel promise, not resident usage                                     |
| OOM kills / Postgres restarts            | 0 / 0                                                  | Predictive, not an incident                                                                   |
| Database size                            | 68 MB (tables 2.9 MB, indexes 8.6 MB, WAL 128 MB)      | Tiny                                                                                          |
| Cache hit rate                           | 1.00 table / 1.00 index                                | No IO pressure                                                                                |
| Active backends                          | 7 of `max_connections = 60`                            | Not connection-bound                                                                          |
| Top DB time                              | `realtime.list_changes` 84.1% (1,362,404 calls, 2h47m) | Realtime Postgres Changes polling                                                             |
| Second outlier                           | `net.http_post` 28.1% of outlier time (9,789 calls)    | Cron fan-out                                                                                  |
| `realtime.subscription`                  | 5,029 writes, 6,705:1 write-heavy                      | Channel churn                                                                                 |
| `request_rate_limits`                    | 4,062 rows, 344 kB bloat, 20,520 writes                | Opportunistic sweep only                                                                      |
| Realtime bindings per open host tab      | 5 (inbox 3, notifications 2)                           | Each binding is a separate WAL poller                                                         |
| Realtime bindings per guest chat tab     | 3                                                      | Same                                                                                          |
| Migration drift                          | 0                                                      | Earlier 9-migration drift is resolved                                                         |
| Policies with non-init-plan `auth.uid()` | 57 (29 in `qual`, rest in `with_check`)                | Re-evaluated per row                                                                          |
| Duplicate indexes                        | 2 pairs, identical definitions                         | Write amplification                                                                           |
| Org-wide bookings list                   | Fetches every matching row into Edge memory            | 20k synthetic rows = 5.7 MB minimum, 291 B/row; real rows with media are several times larger |

### Why the memory chart says "problematic"

Supabase compares Linux `Committed_AS` with `CommitLimit`. `Committed_AS` is memory the
kernel has promised, including untouched copy-on-write pages from Postgres backends and
per-node `work_mem` allowances. A Nano instance has roughly 0.5 GB; Supabase's own
services already promise more than the instance can comfortably back. No query or index
change moves that number. **Micro (Pro default) or Small removes the warning.**

## 2. Changes in this pass

| Change                              | File                                                                                          | Why                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Server-side bookings list RPC       | `supabase/migrations/20261318171000_list_bookings_page_rpc.sql`, `_shared/databaseService.ts` | Filter/sort/page in Postgres. No tenant history in Edge memory                    |
| RLS init-plan rewrite (57 policies) | `supabase/migrations/20261318170000_capacity_hardening.sql`                                   | `(select auth.uid())` evaluates once per statement                                |
| Duplicate index drop                | same                                                                                          | Two identical indexes removed                                                     |
| Nightly retention                   | same                                                                                          | `request_rate_limits`, `processed_emails`, Telegram/reminder logs, webhook events |
| Realtime binding merge              | `useNotificationsRealtime.ts`, `useInbox.ts`, `useGuestChat.ts`                               | 5 -> 3 host subscriptions, 3 -> 2 guest-chat subscriptions                        |
| Read-only capture scripts           | `scripts/performance/capture-supabase-metrics.mjs`, `capture-supabase-advisors.mjs`           | Repeatable evidence without writes                                                |
| Migration drift gate                | `scripts/deploy/check-migration-drift.sh`, `.github/workflows/cd-prod.yml`                    | Post-deploy parity check                                                          |
| Load-test scenarios                 | `scripts/performance/load-test/authenticated-api.js`, `write-path.js`                         | Host reads and opt-in synthetic writes                                            |

### Post-upgrade verification (Micro, 2026-11-04 23:24 UTC)

The operator applied the free Nano -> Micro upgrade after the deploy. Values are from a
read-only Prometheus scrape of the privileged metrics endpoint; the compute add-on API
reports `ci_micro` (2 shared vCPU, 1 GB RAM, 60 direct connections, 200 pooler clients).

| Metric               | Nano (2026-10-27) | Micro (2026-11-04) | Change         |
| -------------------- | ----------------: | -----------------: | -------------- |
| `MemTotal`           |           ~457 MB |   978 MB (933 MiB) | ~2x            |
| `MemAvailable`       |           ~194 MB |   512 MB (488 MiB) | +152%          |
| `MemFree`            |       under 10 MB |   108 MB (103 MiB) | ~10x           |
| Cached               |           ~172 MB |   431 MB (411 MiB) | +151%          |
| `Committed_AS`       |     ~1.24-1.25 GB |           1.352 GB | +~8%           |
| `CommitLimit`        |          ~1.30 GB |           1.563 GB | +20%           |
| Commitment ratio     |              ~96% |          **86.5%** | -9.5 points    |
| Swap used            |            31-32% | **14.9%** (152 MB) | roughly halved |
| OOM kills / restarts |             0 / 0 |              0 / 0 | unchanged      |
| Load1                |      0.05 (load5) |               0.13 | idle           |

The absolute OOM risk is gone: available memory and swap headroom both improved
substantially. The 70% stretch target is not met at idle because Supabase's baseline
services still commit a fixed amount, and `Committed_AS` includes untouched Postgres
copy-on-write mappings. Micro is the right size for the current zero-user stage. Small
(2 GB, ~$5/month after the Pro credit) raises `max_connections` from 60 to 90 and the
pooler from 200 to 400, and is the next step only when load tests or real traffic show
connection pressure.

### Advisor delta after deploy

| Advisor category         |              Before (2026-10-27) |               After (2026-11-04) |
| ------------------------ | -------------------------------: | -------------------------------: |
| Security findings        | 142 (0 error, 36 warn, 106 info) | 147 (0 error, 36 warn, 111 info) |
| Performance findings     |          282 (33 warn, 249 info) |       **217 (0 warn, 217 info)** |
| `auth_rls_initplan`      |                               31 |                            **0** |
| `duplicate_index`        |                                2 |                            **0** |
| `unused_index`           |                              175 |                              126 |
| `unindexed_foreign_keys` |                               73 |                               90 |
| `rls_enabled_no_policy`  |                              106 |                              111 |

Performance warnings are now zero. The remaining security WARNs are
`function_search_path_mutable` (24), `authenticated_security_definer_function_executable`
(10), `auth_leaked_password_protection` (1), and `extension_in_public` (1). The first two
need a targeted follow-up, the leaked-password toggle is a Dashboard setting, and
`pg_trgm` relocation is its own change. Informational `unindexed_foreign_keys` and
`unused_index` findings stay accepted until production-like traffic exists.

## 3. After / expected effect

The only runtime change with a directly measurable local result is the bookings RPC.
Realtime and RLS effects are structural and scale with load; they cannot be measured at
the current traffic level.

| Change                 | Measured after                                                                                           | Expected effect at scale                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `list_bookings_page`   | 20,000 synthetic bookings: 42.8 ms first call, ~37 ms average over 20 calls, page returned from Postgres | Removes O(tenant history) Edge memory and one round trip. At 120k bookings the DB sorts server-side; Edge stays flat |
| Realtime binding merge | 10 bindings -> 7 across the three hooks                                                                  | Host tab 5 -> 3 subscriptions (-40%); guest chat 3 -> 2 (-33%). WAL poll count scales with active subscriptions      |
| RLS init-plan          | 0 policies left with a bare `auth.uid()`                                                                 | One evaluation per statement instead of per row                                                                      |
| Duplicate indexes      | 2 removed                                                                                                | Less write amplification and bloat on two log tables                                                                 |
| Retention              | Nightly at 02:23 UTC                                                                                     | `request_rate_limits` no longer depends on a probabilistic edge sweep                                                |
| Drift gate             | Fails when local-only migrations remain after deploy                                                     | Prevents testing code that is not deployed                                                                           |

### Governance notes

- **Plans and permissions: N/A.** No host-visible capability or gate changed.
- **Activity log: N/A.** The retention cron deletes platform logs only; it writes a
  `system_job_heartbeats` row and touches no organization, property, or guest data.
- **Route guides:** the Bookings API section notes the server-side pagination path.
  No user-visible behavior changed.

## 4. Verification performed

- `bun run type-check` passed.
- `bun run check:edge-types` passed.
- ESLint on the three changed UI files: 0 errors (only pre-existing warnings).
- Local migration replay applied both migrations successfully.
- `list_bookings_page` regression checks on a seeded local dataset:
  property scope, org-wide scope (property + parking union), default status priority,
  completed visibility, cancelled visibility, date range, search, scoped listing ids,
  pagination, and `created_at` sort all returned the expected rows and totals.
- `scripts/deploy/check-migration-drift.sh` correctly reports the two new local-only
  migrations until the next CD deploy.
- `bun run perf:supabase:metrics` produced 13/13 snapshots.

## 5. Capacity projections

Full assumptions and the trigger table are in
[`docs/architecture/supabase-capacity.md`](../../../../architecture/supabase-capacity.md).

| Load                                                   | First bottleneck                                                          | Headroom on Pro                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 250 guest + 100 host concurrent, 50k page views/day    | Edge invocations (~4.5M/mo vs 2M included) unless public reads are cached | ~$5/mo overage; compute Small                               |
| 1,000 guest + 500 host concurrent, 500k page views/day | Egress and Edge invocations without a public cache                        | Medium; ~$86 edge overage, ~$10 Realtime connection overage |
| 10,000 guest + 5,000 host concurrent                   | Public cache and Realtime message volume                                  | Large+; caching and Broadcast are required, not optional    |

Cron, retention, and read-only monitoring do not grow with users. The two costs that do
grow are public egress/invocations and Realtime connections/messages; both are addressed
by the next two items below.

## 6. Not done here, and why

| Item                                            | Why deferred                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compute upgrade to Micro/Small                  | Dashboard operator action; needs a backup and a deploy freeze. No `kamewave` was given, and it is not a repo change                                                      |
| Continuous Prometheus collector + paging alerts | Requires an external account, a watched channel, and a named owner (plan open decision 8)                                                                                |
| Public Vercel cache in front of Supabase        | Architectural change: same-origin proxy plus invalidation. Current `publicDynamic` browser cache helps repeat views only                                                 |
| Dashboard/finance SQL aggregates                | Correctness-sensitive; needs a large-tenant seed and a dedicated change. The 45 s cache bounds the blast radius today                                                    |
| Booking transition atomic RPC                   | Needs a concurrency test and touches the core state machine. Separate change                                                                                             |
| Postgres `max_connections` / `work_mem` tuning  | Do not tune on a Nano baseline. Upgrade, measure 24 h, then decide                                                                                                       |
| Notifications / activity retention              | Product-visible; needs an owner decision on windows                                                                                                                      |
| Advisors snapshot                               | `SUPABASE_ACCESS_TOKEN` in this session is not accepted by the Management API; the script is ready and the findings were reproduced with direct SQL on the linked schema |
| Load-test execution                             | Requires the large-tenant seed on hosted dev and mocked vendors. Scripts and the matrix are ready                                                                        |

## 7. Operator checklist to finish the plan

1. Dashboard -> Settings -> Infrastructure: move compute to **Micro** (Pro default) or
   **Small** if you want headroom for load tests. Take a backup first.
2. Re-run `bun run perf:supabase:metrics` before and after, compare memory commitment.
3. Confirm Billing -> Spend cap and the Realtime connection limit.
4. Set the five alerts (memory, OOM, connections, 5xx, Realtime connections) and a named
   owner.
5. Deploy this branch through the normal `develop` pipeline; the post-deploy drift gate
   should report parity.
6. Once a seed exists, run the load matrix and record the first failing component.
