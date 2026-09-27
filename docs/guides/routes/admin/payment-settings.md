---
title: 'Super Admin payment settings — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-09-04
---

# Super Admin payment settings — operator guide

Route: `/admin/pricing/payment-settings`

> **Status:** Documented · rebuilt on the shared console scaffold (`SuperAdminPage` +
> `SuperAdminSettingsCard`/`SuperAdminSettingsRow`) — enabled rails are now `Switch` rows in a
> `Card`, not raw checkboxes; behavior and the `platform-payment-settings` PUT payload are unchanged.

## Progress overview

| Section          | E2E save | Validation | Docs | Notes                            |
| ---------------- | -------- | ---------- | ---- | -------------------------------- |
| Payment settings | Done     | Server     | Done | Dunning config + rails reference |

---

## Overview

Singleton platform config for property subscription billing dunning (**`platform_payment_settings`**). Super-admin sets grace period and renewal-link lead time; enabled PayMongo rails are stored for ops reference (PayMongo Payment Links expose all rails enabled on the merchant account — not filtered per link via API).

**Access:** `RequireSuperAdmin`.

**Step-up OTP:** saving here needs a fresh email verification code (~15-min sudo window) — see [`overview.md`](overview.md#step-up-verification-all-admin-pages) / `.cursor/rules/admin-auth.mdc` §8.

**Browser tab title:** `Kame Homes - Payment settings`

---

## Behavior

- **Enabled rails** — checkboxes for `qrph`, `paymaya`, `dob`. Saved to **`enabled_payment_methods`**. Activate/disable the corresponding rails in the PayMongo dashboard for checkout to match.
- **Renewal link lead (days)** — how many days before **`current_period_end`** the billing cron creates/emails a renewal Payment Link (default 5).
- **Grace period (days)** — days after period end before **`suspended`** (default 5).
- **Save** — PUT **`platform-payment-settings`**.

---

## API

| Method | Edge function               | Notes                                      |
| ------ | --------------------------- | ------------------------------------------ |
| GET    | `platform-payment-settings` | Returns singleton row                      |
| PUT    | `platform-payment-settings` | Partial update of rails + dunning integers |

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Layer | Path                                                                            |
| ----- | ------------------------------------------------------------------------------- |
| Page  | `ui/src/features/dashboard/super-admin/pages/SuperAdminPaymentSettingsPage.tsx` |
| Hook  | `ui/src/features/dashboard/super-admin/hooks/usePlatformPaymentSettings.ts`     |
| Edge  | `supabase/functions/platform-payment-settings/index.ts`                         |
| Cron  | `platform-billing-cron` reads settings via **`subscriptionOrchestrator`**       |

---

## Host-facing knowledge

Hosts do not see this page. Dunning timing affects when renewal emails arrive and when a listing's dashboard is restricted after non-payment. Guest booking flows are never blocked by billing status.
---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |
