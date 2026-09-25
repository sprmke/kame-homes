---
title: 'Super Admin — AI usage, Audit log, Platform settings — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-05
---

# Super Admin — AI usage, Audit log, Platform settings

Routes:

- `/admin/ai-usage` — platform AI cost console
- `/admin/audit` — super-admin action log
- `/admin/platform-settings` — platform operational knobs
- `⌘K` / `Ctrl-K` (any `/admin/*` page) — cross-entity search palette

> **Status:** Documented · shipped in the Super Admin console overhaul, Phase 6.

## Progress overview

| Section           | E2E save | Validation | Docs | Notes                                                                                                                                                                   |
| ----------------- | -------- | ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI usage          | n/a      | —          | Done | Spend trend + cost-by-feature charts + **Feature health** + top-orgs + quota breaches. Read-only.                                                                       |
| Audit log         | n/a      | —          | Done | Search + paginated list; org-hub **Activity** tab filters to one org.                                                                                                   |
| Platform settings | Done     | client     | Done | Signups, maintenance, default plan, support/legal, rate limit, **Host verification reward** card (config + live grants list with Revoke via `org-subscriptions-admin`). |
| ⌘K search palette | n/a      | —          | Done | Fans out over orgs / properties / parkings / tickets; Enter navigates.                                                                                                  |

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
  `serveSuperAdmin`-gated function. **Storage + read/write are live; the signup gate, maintenance
  banner, default-plan wiring, and public rate-limit enforcement are follow-ups** — saving a value
  here does not yet change guest-facing behavior. See
  [`docs/workflow/planned/super-admin-platform-settings.md`](../../../workflow/planned/super-admin-platform-settings.md).
- **⌘K palette** (`SuperAdminCommandPalette`, mounted once in `SuperAdminShell`): debounced
  `super-admin-search?q=` fans out over `organizations`/`properties`/`parkings`/`support_tickets`
  with a small per-source `ilike` limit; results are grouped by type, Enter navigates.
- **Step-up OTP** (`SuperAdminStepUpProvider`, mounted once in `SuperAdminShell`): saving
  `platform-settings` here (like every gated `/admin/*` mutation) needs a fresh email
  verification code — a ~15-min sudo window shared across all sensitive actions. Full list and
  mechanics in [`overview.md`](overview.md#step-up-verification-all-admin-pages) and
  `.cursor/rules/admin-auth.mdc` §8.

---

## API reference

| Method  | Endpoint                               | Notes                                                                                                                                                                             |
| ------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `super-admin-ai-usage`                 | `?range=30d\|90d\|12mo` → `totals`, `dailySeries`, `featureBreakdown` (+ `errors`, `errorRatePct`, `fallbackRatePct`, `latencyP50Ms`, `latencyP95Ms`), `topOrgs`, `quotaBreaches` |
| GET     | `list-super-admin-audit`               | `?q=`, `?actor=`, `?targetType=`, `?targetId=`, `?page=`, `?limit=`                                                                                                               |
| GET     | `org-subscriptions-admin?rewards=true` | Live `source=reward` grants for Host verification reward card                                                                                                                     |
| GET/PUT | `platform-settings`                    | Singleton row; PUT accepts a partial patch                                                                                                                                        |
| GET     | `super-admin-search`                   | `?q=` (min 2 chars) → grouped `results[]` with `href`                                                                                                                             |

---

## Implementation map

| Concern         | Path                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pages           | `ui/src/features/dashboard/super-admin/pages/SuperAdmin{AiUsage,Audit,PlatformSettings}Page.tsx`                                   |
| Org hub section | `ui/src/features/dashboard/super-admin/pages/SuperAdminOrgActivitySection.tsx`                                                     |
| Palette         | `ui/src/features/dashboard/super-admin/components/SuperAdminCommandPalette.tsx`                                                    |
| Hooks           | `ui/src/features/dashboard/super-admin/hooks/{useSuperAdminAiUsage,useSuperAdminAudit,usePlatformSettings,useSuperAdminSearch}.ts` |
| Edge functions  | `supabase/functions/{super-admin-ai-usage,list-super-admin-audit,platform-settings,super-admin-search}/index.ts`                   |
| Audit writer    | `supabase/functions/_shared/superAdminAudit.ts`                                                                                    |
| Migrations      | `supabase/migrations/20261305130000_super_admin_audit_events.sql`, `20261305130100_platform_settings.sql`                          |
| Routes / nav    | `super-admin/routes/index.tsx`, `super-admin/lib/superAdminPlatformNav.ts` (Platform group)                                        |

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
- [`docs/workflow/planned/super-admin-audit-log.md`](../../../workflow/planned/super-admin-audit-log.md) — remaining audit-log scope (more call sites, richer viewer)
- [`docs/workflow/planned/super-admin-ai-usage-dashboard.md`](../../../workflow/planned/super-admin-ai-usage-dashboard.md)
- [`docs/workflow/planned/super-admin-platform-settings.md`](../../../workflow/planned/super-admin-platform-settings.md) — consumer wiring remaining
- [`docs/workflow/planned/super-admin-global-search.md`](../../../workflow/planned/super-admin-global-search.md)

---

## Pending / follow-ups

- [ ] Wire `platform_settings` consumers: signup gate, maintenance banner, default plan on org
      create, public rate-limit enforcement.
- [ ] Add `logSuperAdminAction` to more mutation sites (development CRUD, FAQ CRUD, host settings).
- [ ] AI usage: per-org drill-down page; MRR-style revenue trend needs subscription-event history.
- [ ] ⌘K: recent-searches, keyboard nav polish, mobile entry point (currently keyboard-shortcut only).
