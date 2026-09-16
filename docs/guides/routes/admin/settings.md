---
title: 'Super Admin AI Management — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-04
---

# Super Admin AI Management — operator guide

Route: `/admin/settings`

> **Status:** Documented · page wrapped in `SuperAdminPage`; the three cards no longer orphan the
> third in a 2-col grid (Platform AI is full-width, Assistant + Credit wallet share a row). The
> **Credit wallet** card now also appears in the org hub's **AI credits** section, prefilled with
> that org's id (`AiCreditWalletCard initialOrgId`).

## Progress overview

| Section                | E2E save | Validation | Docs | Notes                                                                 |
| ---------------------- | -------- | ---------- | ---- | --------------------------------------------------------------------- |
| Platform AI            | Done     | Server     | Done | Kill switch + feature allowlist + default quotas + credit unit fields |
| AI credit wallet       | Done     | Server     | Done | Super-admin manual top-up / adjustment per org                        |
| AI dashboard assistant | Done     | Server     | Done | Independent platform kill switch                                      |

---

## Overview

Platform-wide AI controls for the super-admin team. Sidebar and overview label: **AI Management**. Changes apply across all organizations and properties immediately. Three cards: Platform AI, AI credit wallet, and AI dashboard assistant.

Host-facing announcements are managed per development on **`/admin/developments/:slug`** — see [Development Settings](./development-detail.md). Platform-wide notices for all hosts live on **[Announcements](./announcements.md)** (`/admin/announcements`).

**Access:** `RequireSuperAdmin` consumes the server-derived `list-organizations.isSuperAdmin` capability. Every API independently enforces `SUPER_ADMIN_EMAILS`.

---

## Host-facing knowledge

These controls are internal to the platform team. Hosts do not see or manage them.

**Common host questions**

- Q: Why did AI features stop working for my organization?
  A: The platform team may have disabled AI platform-wide, removed the feature from the allowed list, or your organization may have hit usage limits when quota enforcement is on. Contact support if you need help.
- Q: Can I turn on the AI voice receptionist for my property?
  A: Only when the platform team has enabled the voice receptionist feature globally. Per-property settings live in your property dashboard once the platform switch is on.

---

## Platform AI

| Control                  | Effect                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enabled**              | Master kill switch for all AI features across the platform                                                                                                                                                                                                                                |
| **Enforce quotas**       | When on, org-level and per-property AI usage quotas are enforced                                                                                                                                                                                                                          |
| **Allowed features**     | Per-feature allowlist (`allowed_features`). Empty array = all allowed when enabled. A non-empty list is exclusive — features not listed (e.g. `import_column_map`) degrade or fail closed. Toggle rows cover every `AiFeature` id (booking AI review maps to the three summary features). |
| **Default quotas**       | Daily calls, monthly calls, and daily USD cost limits inherited by orgs without overrides                                                                                                                                                                                                 |
| **Credit unit (USD)**    | Super-admin-only — USD value of one AI credit (`credit_unit_usd`; working default `0.001`)                                                                                                                                                                                                |
| **Voice cost/min (USD)** | Super-admin-only — per-minute Gemini Live estimate for voice receptionist billing (`voice_receptionist_cost_per_minute_usd`)                                                                                                                                                              |

Voice receptionist is controlled by the **Allowed features** list — add or remove `voice_receptionist` to gate the product. The old standalone voice kill switch endpoint was removed.

### Save path

1. Toggle or edit in UI → `PATCH ai-platform-global-settings`
2. Persists `ai_platform_global_settings` singleton row (including credit conversion fields)

---

## AI credit wallet

Super-admin tool to inspect and manually adjust an org's **purchased top-up** balance (`ai_platform_org_credit_wallet`), atomically updated via a row-locked `adjust_ai_platform_org_credit_wallet` RPC. Separate from the monthly/daily credit allowance quotas on org Settings — once an org exceeds its allowance, `assertOrgAndPropertyAiQuota` checks this wallet and draws it down automatically (`recordAiUsage` inserts a `usage_debit` ledger row) if it has a positive balance; empty wallet fails the call. The default allowance limits ship deliberately generous (not real pricing — see the linked plan doc), so this wallet only actually gets drawn on for orgs with a tightened per-org/per-property override today. No UI yet to edit an org's own credit-limit overrides or the platform-wide defaults — only this manual top-up/adjustment tool.

| Control        | Effect                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| **Org lookup** | Enter org UUID or slug → **Load**                                                         |
| **Balance**    | Current `balance_credits`                                                                 |
| **Ledger**     | Recent `ai_platform_org_credit_ledger` rows (usage debits, purchases, manual adjustments) |
| **Adjust**     | POST non-zero `creditsDelta` (+ add / − subtract) with optional description               |

### Save path

1. Load org → `GET ai-platform-credit-wallet?org_id=` or `?org_slug=`
2. Adjust → `POST ai-platform-credit-wallet` with `{ creditsDelta, description? }`

---

## AI dashboard assistant

| Control     | Effect                                              |
| ----------- | --------------------------------------------------- |
| **Enabled** | Platform-wide kill switch for the dashboard chat AI |

Independent of Platform AI. Org-level opt-in still lives on organization Settings.

### Save path

1. Toggle in UI → `PATCH dashboard-assistant-global-settings`
2. Persists the platform assistant singleton row

---

## API reference

| Action                                 | Endpoint                                            |
| -------------------------------------- | --------------------------------------------------- |
| Read / update platform AI              | `GET` / `PATCH ai-platform-global-settings`         |
| Read / adjust org credit wallet        | `GET` / `POST ai-platform-credit-wallet`            |
| Read / update dashboard assistant kill | `GET` / `PATCH dashboard-assistant-global-settings` |

---

## Implementation map

| Concern    | Path                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page       | `ui/src/features/dashboard/super-admin/pages/SuperAdminSettingsPage.tsx`                                                                                                      |
| Cards      | `AiPlatformKillSwitchCard.tsx`, `AiCreditWalletCard.tsx`, `AiDashboardAssistantKillSwitchCard.tsx`                                                                            |
| Hooks      | `useAiPlatformGlobalSettings.ts`, `useAiCreditWallet.ts`, `useAiDashboardAssistantSettings.ts`                                                                                |
| Edge       | `supabase/functions/ai-platform-global-settings/`, `ai-platform-credit-wallet/`, `dashboard-assistant-global-settings/`                                                       |
| Nav        | `ui/src/features/dashboard/super-admin/lib/superAdminPlatformNav.ts`                                                                                                          |
| Paths      | `ui/src/features/dashboard/super-admin/lib/superAdminPaths.ts`                                                                                                                |
| Routes     | `ui/src/features/dashboard/super-admin/routes/index.tsx`                                                                                                                      |
| Migrations | `supabase/migrations/20261022140000_ai_credit_foundation.sql`, `20261022150000_ai_credit_limits.sql`, `20261022160000_ai_credit_foundation_hardening.sql` (atomic wallet RPC) |

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

---

## Related docs

- [Super Admin Overview](./overview.md)
- [`docs/architecture/edge-functions.md`](../../../architecture/edge-functions.md) — AI edge function inventory
- [`docs/archive/operations/ai-platform-billing.md`](../../../archive/operations/ai-platform-billing.md)
- [`docs/workflow/done/ai-usage-metering-credits-foundation.md`](../../../workflow/done/ai-usage-metering-credits-foundation.md) — credit conversion formula, wallet/ledger design, Phase 1–3 status

---

## Pending / follow-ups

- [ ] Drop legacy `voice_receptionist_global_settings` table in a follow-up migration after verifying the platform switch is seeded on hosted environments.
- [ ] No UI yet to edit `default_daily_credit_limit`/`default_monthly_credit_limit` (platform-wide) or an org's `daily_credit_limit`/`monthly_credit_limit` override — settable only via direct API/DB today. Deliberately deferred until real pricing numbers replace the current generous working defaults.
