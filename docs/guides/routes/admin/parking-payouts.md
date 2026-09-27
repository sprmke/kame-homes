---
title: 'Super Admin parking payouts — operator guide'
status: active
tags: [guides, routes, admin, parking]
updated: 2026-09-04
---

# Super Admin parking payouts — operator guide

Route: `/admin/parking/payouts`

> **Status:** Documented · rebuilt on the shared console scaffold — commission/rate config is now a
> `SuperAdminSettingsCard`; the disbursement ledger is a `Card`-wrapped table at ≥`lg` with a
> stacked card list below it (no more 5-column overflow on mobile). Actions and the
> `parking-payouts` GET/PATCH contract are unchanged.

## Progress overview

| Section           | E2E save | Validation | Docs | Notes                                                           |
| ----------------- | -------- | ---------- | ---- | --------------------------------------------------------------- |
| Platform settings | Done     | Server     | Done | Commission % + guest rate + support escalation phone, singleton |
| Payout ledger     | Done     | Server     | Done | Manual disbursement + clawback audit trail                      |

---

## Overview

Two things on one page, per Phase 4 of the parking marketplace build:

1. **Commission & guest rate config** (`platform_parking_settings` singleton) — replaces the
   interim flat stubs (₱400/₱400, 10%) the match engine and payment flow launched with. This is
   also the price cap: a host priced at or above the guest rate for any night is excluded from
   the match pool entirely. Includes a second, independently configurable commission rate
   (default 5%) for bookings made through a host's Phase 8 direct-booking link.
2. **Payout ledger** — every paid parking booking (`parking_payment_transactions`, `status =
'paid'`), with a manual "mark disbursed" and "record clawback" action per row. There is no
   automated payout yet — PayMongo Platforms split-payout requires a business application
   Kame Homes hasn't made; this is the day-one manual path until that ships.

**Access:** `RequireSuperAdmin`.

**Step-up OTP:** saving commission/rate config and every mark-disbursed / record-clawback action need a fresh email verification code (~15-min sudo window) — see [`overview.md`](overview.md#step-up-verification-all-admin-pages) / `.cursor/rules/admin-auth.mdc` §8.

**Browser tab title:** `Kame Homes - Parking payouts`

---

## Behavior

### Commission & guest rate

- **Commission (%)** — taken from the host's gross rate; saved as `commission_pct` (0–1).
- **Direct-link commission (%)** — the reduced rate applied instead of Commission (%) when a
  booking came through a host's Phase 8 direct-booking link; saved as `direct_commission_pct`
  (0–1). Independent of the standard rate — changing one does not move the other.
- **Guest rate — weekday / weekend (₱/night)** — what riders are charged per night, and also the
  price cap hosts are matched against.
- **Save** — PUT `platform-parking-settings`. Changes apply only to bookings **created after**
  saving — an already-paid or in-flight `parking_payment_transactions` row keeps the values that
  were resolved and snapshotted onto it at checkout-creation time, never recomputed
  retroactively.
- The same live values are what a host sees as their rate cap on the parking pricing page
  (piggybacked onto the `parking-pricing` GET response, since hosts can't call this
  super-admin-gated endpoint directly).
- **Support escalation phone (Phase 5)** — a platform-wide contact number surfaced on the guest
  parking status page (`/parkings/requests/:bookingId`) at all times, for a guest who can't reach
  an unresponsive host on-site. Optional; blank hides the line on the guest page.

### Payout ledger

- Lists paid transactions (most recent first): guest, stay dates/nights, listing, org, host
  gross/commission/net payout, disbursement status. A row's commission line shows "Direct link"
  when that booking came through a Phase 8 direct-booking link (reduced commission applied).
- **Mark disbursed** — records `disbursed_at`/`disbursed_by` and an optional reference (e.g. a
  bank transfer or GCash reference number). Confirms the payout was made manually outside the
  platform — this button does not move money.
- **Record clawback** — records an amount + reason (e.g. a chargeback after disbursement).
  Audit trail only; no automated collection happens.
- A transaction can be marked disbursed once and have any number of clawbacks recorded against
  it afterward (both actions require the transaction to be `paid`).

---

## API

| Method | Edge function               | Notes                                                                                                                   |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `platform-parking-settings` | Returns the singleton settings row                                                                                      |
| PUT    | `platform-parking-settings` | Partial update of `commissionPct`/`directCommissionPct`/`guestRateWeekday`/`guestRateWeekend`/`supportEscalationPhone`  |
| GET    | `parking-payouts`           | Lists `status = 'paid'` transactions, most recent first                                                                 |
| PATCH  | `parking-payouts`           | `{action: 'mark_disbursed', transactionId, reference?}` or `{action: 'record_clawback', transactionId, amount, reason}` |

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Layer                                     | Path                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Page                                      | `ui/src/features/dashboard/super-admin/pages/SuperAdminParkingPayoutsPage.tsx`                                                 |
| Hooks                                     | `ui/src/features/dashboard/super-admin/hooks/usePlatformParkingSettings.ts`                                                    |
| Edge                                      | `supabase/functions/platform-parking-settings/index.ts`, `supabase/functions/parking-payouts/index.ts`                         |
| Resolver (server-side reads)              | `supabase/functions/_shared/parkingPlatformSettings.ts`                                                                        |
| Payment amount math (per-night proration) | `supabase/functions/_shared/parkingPaymentOrchestrator.ts`                                                                     |
| Match-engine price cap                    | `supabase/functions/_shared/parkingBroadcastRanking.ts`                                                                        |
| Host-facing cap/commission                | `supabase/functions/_shared/parkingPricing.ts`, `ui/src/features/dashboard/parking/components/ParkingPricingRatesFormCard.tsx` |
| Direct-link channel resolution (Phase 8)  | `supabase/functions/_shared/parkingDirectLink.ts`                                                                              |

---

## Host-facing knowledge

Hosts do not see this page. What affects them: the guest rate cap (visible as the maximum they
can price their listing at, on their own pricing page) and the commission percentage (visible as
the "Service fee" / "You get" breakdown under each rate field). Payout disbursement itself
currently happens manually outside the platform — a host who has been paid for a completed
parking booking should see this reflected by their usual payment channel (bank transfer, GCash,
etc.), not an in-app payout notification.

**Common host questions**

- Q: When do I get paid for a parking booking?
  A: Payouts are currently handled manually by the platform team after the guest's payment is
  confirmed — you'll be paid through your agreed channel, not automatically through the app.
- Q: Why can't I set my rate above a certain amount?
  A: The platform caps host rates at the current guest rate — pricing above it would mean the
  guest is charged less than you're asking, which the platform won't allow.

---

---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |

## Pending / follow-ups

- [ ] Real PayMongo Platforms split-payout (requires a business application to PayMongo — not
      code work)
- [ ] Host KYC onboarding for automated payout
- [ ] Volume eligibility threshold for automated payout
- [ ] Real PayMongo fee schedule (currently a flat commission %, not PayMongo's actual rails fee)
