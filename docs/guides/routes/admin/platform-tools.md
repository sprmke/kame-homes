---
title: 'Super Admin — AI usage, Rate limits, Audit log, Platform settings — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-27
---

# Super Admin — AI usage, Rate limits, Audit log, Platform settings

Routes:

- `/admin/ai-usage` — platform AI cost console
- `/admin/rate-limits` — authenticated-wrapper rate-limit activity + manual block/unblock
- `/admin/audit` — super-admin action log
- `/admin/platform-settings` — platform operational knobs
- `⌘K` / `Ctrl-K` (any `/admin/*` page) — cross-entity search palette

> **Status:** Documented · shipped in the Super Admin console overhaul, Phase 6 (AI usage / Audit
> log / Platform settings); Rate limits shipped with production-readiness doc 23.

## Progress overview

| Section           | E2E save | Validation | Docs | Notes                                                                                                                                                     |
| ----------------- | -------- | ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI usage          | n/a      | —          | Done | Spend trend + cost-by-feature charts + **Feature health** + top-orgs + quota breaches. Read-only.                                                         |
| Rate limits       | Done     | server     | Done | Active per-user counters near/over the wrapper limit (last hour), manual block/unblock (step-up gated), current enforce state + limit.                    |
| Audit log         | n/a      | —          | Done | Search + paginated list; org-hub **Activity** tab filters to one org.                                                                                     |
| Platform settings | Done     | client     | Done | Signups, maintenance, default plan, support/legal, public rate limit, authenticated rate-limit enforce switch + limit, **Host verification reward** card. |
| ⌘K search palette | n/a      | —          | Done | Fans out over orgs / properties / parkings / tickets; Enter navigates.                                                                                    |

---

## Host-facing knowledge

The AI usage page shows what AI costs the platform and how reliable each AI feature is.

**Common operator questions**

- Q: What does "fallback rate" mean on Feature health?
  A: How often the main AI provider was unavailable and the backup provider answered instead. A rising number usually means the main provider is rate limiting or having an outage.
- Q: Why does a feature show errors but no extra cost?
  A: Failed calls are counted so you can spot problems, but only successful calls add to cost.
- Q: What is p95 latency?
  A: The slowest typical response time. 95 out of 100 calls finished faster than this.

---

## Behavior notes

- **AI usage** (`SuperAdminAiUsagePage`): `super-admin-ai-usage?range=30d|90d|12mo` sums
  `ai_platform_usage_daily` for the trend, `ai_platform_usage_events` for cost-by-feature and the
  top-25-orgs table, and compares each org's today/month call counts against
  `ai_platform_org_settings` (falling back to the platform defaults — 200/day, 5000/month) to flag
  quota breaches. Each org row links to that org's **AI credits** hub section.
  **Feature health** table: per AI feature, calls, failed calls, error rate, fallback rate (share
  of calls served by the backup provider) and p50/p95 latency, from the `status`, `fallback_used`
  and `latency_ms` columns on `ai_platform_usage_events`. Cost-by-feature counts successful calls
  only. See [`ai-platform.md`](../../../architecture/ai-platform.md) §6.
- **Audit log** (`SuperAdminAuditPage` / org-hub `SuperAdminOrgActivitySection`):
  `list-super-admin-audit` reads `super_admin_audit_events`, written fire-and-forget by
  `_shared/superAdminAudit.ts#logSuperAdminAction()` — a write failure there never blocks the
  mutation it's logging. Wired into: org subscription assign (`org-subscriptions-admin`), org
  verification approve/reject/request-changes, parking payout disburse/clawback, platform AI
  kill-switch updates, AI credit-wallet adjustments, and platform settings updates. More call
  sites can be added the same way as new mutations ship.
- **Platform settings** (`SuperAdminPlatformSettingsPage`): singleton `platform_settings` row via
  `platform-settings` GET/PUT. No RLS read path — everything goes through the
  `serveSuperAdmin`-gated function. Signup gate, maintenance banner, and default-plan wiring are
  live. The **Authenticated rate limiting** card holds the doc-23 kill switch
  (`authenticated_rate_limit_enforce`, default off = log-only) and the per-user limit
  (`authenticated_rate_limit_per_min`, default 300/60s — a reasoned, explicitly-unmeasured starting
  point, since no hosted per-user request-rate baseline exists). Flipping it takes effect on the
  next `platform_settings` cache read (≤60s, `_shared/platformSettingsCache.ts`), no deploy needed.
  "View activity" links to `/admin/rate-limits`.
- **Rate limits** (`SuperAdminRateLimitsPage`): `super-admin-rate-limits` GET returns identities
  currently at or near the wrapper-default limit in the last hour
  (`list_active_wrapper_rate_limits` RPC over `request_rate_limits`, collapsed to one row per
  identity), the manual block list (`rate_limit_blocks`), and the current enforce state + limit.
  Blocking an identity (`u:<uuid>` or `ip:<addr>`, matching `identityFromRequest`'s shape) is
  checked ahead of the rolling-window count on every `serveAdmin`/`serveAuthenticated` request
  (`isIdentityBlocked`, 30s isolate-local cache) — an immediate 403 regardless of the current
  count. Step-up gated (`rate_limit_block`); every block/unblock is audited via
  `logSuperAdminAction`. The page does not resolve `u:` ids to a name — cross-reference via
  Organizations/Hosts search if needed. Poll refetch every 30s.
- **⌘K palette** (`SuperAdminCommandPalette`, mounted once in `SuperAdminShell`): debounced
  `super-admin-search?q=` fans out over `organizations`/`properties`/`parkings`/`support_tickets`
  with a small per-source `ilike` limit; results are grouped by type, Enter navigates.
- **Step-up OTP** (`SuperAdminStepUpProvider`, mounted once in `SuperAdminShell`): saving
  `platform-settings` and blocking/unblocking on `super-admin-rate-limits` (like every gated
  `/admin/*` mutation) needs a fresh email verification code — a ~15-min sudo window shared across
  all sensitive actions. Full list and mechanics in
  [`overview.md`](overview.md#step-up-verification-all-admin-pages) and
  `.cursor/rules/admin-auth.mdc` §8.

---

## API reference

| Method  | Endpoint                               | Notes                                                                                                                                                                             |
| ------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `super-admin-ai-usage`                 | `?range=30d\|90d\|12mo` → `totals`, `dailySeries`, `featureBreakdown` (+ `errors`, `errorRatePct`, `fallbackRatePct`, `latencyP50Ms`, `latencyP95Ms`), `topOrgs`, `quotaBreaches` |
| GET     | `super-admin-rate-limits`              | `{ enforceEnabled, limit, activeCounters[], blocks[] }` — counters from the last hour, floor count 1                                                                              |
| POST    | `super-admin-rate-limits`              | `{ action: 'block'\|'unblock', identity, reason? }` — step-up gated (`rate_limit_block`)                                                                                          |
| GET     | `list-super-admin-audit`               | `?q=`, `?actor=`, `?targetType=`, `?targetId=`, `?page=`, `?limit=`                                                                                                               |
| GET     | `org-subscriptions-admin?rewards=true` | Live `source=reward` grants for Host verification reward card                                                                                                                     |
| GET/PUT | `platform-settings`                    | Singleton row; PUT accepts a partial patch; step-up gated (`platform_settings`)                                                                                                   |
| GET     | `super-admin-search`                   | `?q=` (min 2 chars) → grouped `results[]` with `href`                                                                                                                             |

---

## Implementation map

| Concern         | Path                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages           | `ui/src/features/dashboard/super-admin/pages/SuperAdmin{AiUsage,RateLimits,Audit,PlatformSettings}Page.tsx`                                                          |
| Org hub section | `ui/src/features/dashboard/super-admin/pages/SuperAdminOrgActivitySection.tsx`                                                                                       |
| Palette         | `ui/src/features/dashboard/super-admin/components/SuperAdminCommandPalette.tsx`                                                                                      |
| Hooks           | `ui/src/features/dashboard/super-admin/hooks/{useSuperAdminAiUsage,useSuperAdminRateLimits,useSuperAdminAudit,usePlatformSettings,useSuperAdminSearch}.ts`           |
| Edge functions  | `supabase/functions/{super-admin-ai-usage,super-admin-rate-limits,list-super-admin-audit,platform-settings,super-admin-search}/index.ts`                             |
| Rate-limit core | `supabase/functions/_shared/{rateLimit,serveEdge,platformSettingsCache}.ts`                                                                                          |
| Audit writer    | `supabase/functions/_shared/superAdminAudit.ts`                                                                                                                      |
| Migrations      | `supabase/migrations/20261305130000_super_admin_audit_events.sql`, `20261305130100_platform_settings.sql`, `20261316123500_authenticated_rate_limit_enforcement.sql` |
| Routes / nav    | `super-admin/routes/index.tsx`, `super-admin/lib/superAdminPlatformNav.ts` (Platform group)                                                                          |
| CI guard        | `scripts/dev/check-authenticated-rate-limit.sh`                                                                                                                      |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Super Admin Overview](./overview.md) · [Organizations & Organization hub](./orgs.md)
- [`docs/workflow/done/super-admin-audit-log.md`](../../../workflow/done/super-admin-audit-log.md)
- [`docs/workflow/done/super-admin-ai-usage-dashboard.md`](../../../workflow/done/super-admin-ai-usage-dashboard.md)
- [`docs/workflow/done/super-admin-platform-settings.md`](../../../workflow/done/super-admin-platform-settings.md)
- [`docs/workflow/done/super-admin-global-search.md`](../../../workflow/done/super-admin-global-search.md)
- [`docs/workflow/planned/production-readiness-checklist/23-rate-limiting.md`](../../../workflow/planned/production-readiness-checklist/23-rate-limiting.md) — rate-limit plan + exit gate

---

## Pending / follow-ups

- [ ] Add `logSuperAdminAction` to more mutation sites (development CRUD, FAQ CRUD, host settings).
- [ ] AI usage: per-org drill-down page; MRR-style revenue trend needs subscription-event history.
- [ ] ⌘K: recent-searches, keyboard nav polish, mobile entry point (currently keyboard-shortcut only).
- [ ] Rate limits: cost-weighted limiting (AI/email/Meta/maps/payments) is out of scope for this
      page by design — see [`super-admin-service-cost-monitoring.md`](../../../workflow/planned/super-admin-service-cost-monitoring.md).
      Limiter alerting (a sustained limiting spike) is not built; the page is poll-refreshed, not
      pushed.
