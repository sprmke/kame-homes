---
stage: done
title: 'Parking E2E Phase 4 — Split Payout & Super-Admin Commission Config'
status: done
tags: [planning, planned-modules, parking, payments, super-admin]
updated: 2026-08-30
---

# Phase 4 — Split Payout & Admin Config

Part of [Parking E2E Phase 2+ overview](./parking-e2e-later-phases.md). Depends on Phase 3 (payment must exist before there's anything to pay out).

## Problem

The platform needs to (a) actually get paid its commission, (b) get the host their net share, and (c) let a super-admin tune the commission % and guest rate without a code deploy. **Research (2026-08-26) confirmed PayMongo does offer real split payout via "PayMongo Platforms"** (parent/child merchant accounts, automated splitting) — see the overview's research section for full findings, sources, and what still needs direct confirmation (exact fees, onboarding lead time).

## Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                             | Detail                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Updated 2026-08-26 — capability confirmed, not a feasibility spike anymore.** Task 4.0 is now: get PayMongo's exact fee schedule (per-transaction + the reported ₱75/month per activated sub-account) directly from PayMongo, apply for Platforms access (their own multi-step onboarding, has lead time), and lock a real-vs-manual eligibility threshold before finalizing commission economics. | Prevents committing to per-host sub-accounts before confirming they aren't a net loss at low booking volume — see overview's cost caveat.                                                                      |
| 1   | Target path: **PayMongo Platforms child accounts** for hosts above the volume eligibility threshold (decision #7); out-of-band manual disbursement (mirrors the existing manual SD-refund pattern) for hosts below it, or until Platforms access is actually set up                                                                                                                                  | Real payout removes the operational burden of manual disbursement at scale once live; manual stays as the always-available fallback and the day-one path while Platforms onboarding (task 4.0) is in progress. |
| 2   | Default commission = 10%, admin-configurable                                                                                                                                                                                                                                                                                                                                                         | Explicit intake ask.                                                                                                                                                                                           |
| 3   | Guest rate (weekday/weekend) is admin-configurable from the same new page, stored separately from each host's own `parking_settings` listing rate                                                                                                                                                                                                                                                    | Overview D13, confirmed by user 2026-08-26 — the existing per-host pricing module is untouched; this is a new, independent platform-level value.                                                               |
| 4   | Commission % and guest rate are **snapshotted onto the transaction row at match/payment time**, never recomputed retroactively if admin changes the config later                                                                                                                                                                                                                                     | Overview edge case — avoids retroactively changing payouts for in-flight bookings.                                                                                                                             |
| 5   | New singleton config table + `serveSuperAdmin` edge function, following the exact `platform_payment_settings` template (not extending that table — different domain)                                                                                                                                                                                                                                 | Matches the repo's established per-domain-singleton pattern; confirmed via research, no generic settings table exists to extend instead.                                                                       |
| 6   | Payout ledger is auditable per booking (host_gross, commission_pct, host_net, disbursed status/date) even in the manual-disbursement path                                                                                                                                                                                                                                                            | Needed for admin reconciliation and for the host-facing payout history (Phase 5/6 UI).                                                                                                                         |
| 7   | New: hosts only get a real PayMongo Platforms child account (and its ₱75/month cost) after crossing a booking-volume eligibility threshold (exact number TBD once real fees are confirmed); hosts below it stay on manual disbursement indefinitely, not just temporarily                                                                                                                            | Avoids the per-host monthly sub-account fee outweighing commission revenue for low-volume hosts (overview cost caveat).                                                                                        |

## Tasks

**PayMongo Platforms setup (blocked on business/compliance action, not code — 2026-08-26)**

- [ ] Get PayMongo's exact per-transaction fee schedule (card, GCash, Maya, GrabPay, bank transfer) and confirm the reported ₱75/month-per-activated-sub-account cost directly from PayMongo (docs 404'd on these specifics during research — see overview). **Requires directly contacting PayMongo — not a code/AI task.**
- [ ] Model host payout economics against expected booking volume using the real fees; use this to set the volume eligibility threshold from decision #7 (e.g., "N accepted bookings before a host gets a real sub-account"). **Depends on the item above.**
- [ ] Apply for PayMongo Platforms access early (their 3-step process: platform signup + our own KYC/compliance docs + API integration with their support team) — start this in parallel with Phase 2/3 build work given the apparent lead time, don't block on it. **Requires directly contacting PayMongo — not a code/AI task.**
- [ ] Design the host-facing Platforms child-account onboarding flow (KYC form: personal + business details, gov't ID + selfie capture) for hosts who cross the eligibility threshold — net-new UI, nothing like this exists in the codebase today. **Deferred until Platforms access is actually granted — building this UI ahead of a confirmed integration target would be speculative.**

**Super-admin config page** — ✅ shipped 2026-08-26 (buildable subset)

- [x] Migration: `platform_parking_settings` singleton table (id=1 constraint, `commission_pct`, `guest_rate_weekday`, `guest_rate_weekend`, `updated_at`/`updated_by`, RLS + trigger — mirror `platform_payment_settings` migration shape exactly). — `supabase/migrations/20261129120000_parking_platform_settings.sql`.
- [x] New edge function `supabase/functions/platform-parking-settings/index.ts` — `serveSuperAdmin`-gated GET/PUT, partial-patch semantics like `platform-payment-settings/index.ts`.
- [x] New hook `ui/.../super-admin/hooks/usePlatformParkingSettings.ts` (TanStack Query).
- [x] New page `ui/.../super-admin/pages/SuperAdminParkingPayoutsPage.tsx` (renamed from the ticket's original `SuperAdminParkingSettingsPage.tsx` — settings is a section within the combined payouts page, matching the route guide's own naming, see Decisions above) — commission % input, guest weekday/weekend rate inputs, validation (0–100% range, positive rates).
- [x] Registered path in `superAdminPaths.ts` (`/admin/parking/payouts`), route in `super-admin/routes/index.tsx`, nav entry in `superAdminPlatformNav.ts`.
- [x] New route guide `docs/guides/routes/admin/parking-payouts.md`.

**Payout ledger & disbursement** — ✅ shipped 2026-08-26 (manual path; real-payout path blocked, see above)

- [x] Extended `parking_payment_transactions` (Phase 3) with `disbursed_at`/`disbursed_by`/`disbursement_reference`/`disbursement_method` (`manual` | `paymongo_platforms`) and `clawback_amount`/`clawback_reason`/`clawback_at`/`clawback_by` — decided to extend the existing table rather than add a companion `parking_payouts` table (it's already the 1:1 record per paid booking with the snapshotted amounts; a separate table would just duplicate those columns and risk drift).
- [x] Manual path: admin UI to mark a payout as disbursed — built into the new `parking-payouts` page/edge function rather than the `finance/` module (that module is property-vertical-scoped; parking is a platform-level ledger, not a per-property one).
- [ ] Real-payout path (once Platforms access + host onboarding exist): route the split automatically at payment time for eligible hosts via PayMongo Platforms' split API, and record the resulting disbursement on the same ledger. **Blocked on the PayMongo Platforms setup tasks above.**
- [x] Weekday/weekend proration for bookings spanning both night types (overview edge case) — `parkingPaymentOrchestrator.ts#computeParkingPaymentAmounts` now walks each occupied night individually and sums the per-night guest/host rate, replacing Phase 3's averaged-rate × nights approach.
- [x] Chargeback/dispute clawback mechanism — `clawback_amount`/`clawback_reason`/`clawback_at`/`clawback_by` on `parking_payment_transactions`, recorded via the `parking-payouts` PATCH `record_clawback` action. Audit trail only (no automated collection) — sufficient for the manual-disbursement path; the real-payout path's clawback handling is deferred with it.

**Guest-amount privacy audit** — ✅ done 2026-08-26

- [x] Audited every host-facing surface (booking detail, pricing page, calendar, emails) — confirmed **zero** existing references to `host_gross`/`guest_charge_total`/`parking_payment_transactions` in host-facing UI; no parking CSV/export exists yet to audit. The only new surface exposing these fields is the super-admin payout ledger, which is exempt from D8 (D8 restricts host-facing surfaces, not the platform operator).

## File map (as shipped 2026-08-26 — buildable subset)

| Path                                                                                                     | Change                                                                                        |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261129120000_parking_platform_settings.sql`                                       | New singleton table + payout ledger columns on `parking_payment_transactions`                 |
| `supabase/functions/_shared/parkingPlatformSettings.ts`                                                  | New — `resolveParkingPlatformSettings()` resolver                                             |
| `supabase/functions/platform-parking-settings/index.ts`                                                  | New — mirrors `platform-payment-settings/index.ts`                                            |
| `supabase/functions/parking-payouts/index.ts`                                                            | New — GET ledger, PATCH mark-disbursed/record-clawback                                        |
| `supabase/functions/_shared/parkingBroadcastRanking.ts`                                                  | `isPriceCappedOut` now takes live guest rates; ranking resolves config once                   |
| `supabase/functions/_shared/parkingPaymentOrchestrator.ts`                                               | `computeParkingPaymentAmounts` resolves live config + per-night proration                     |
| `supabase/functions/_shared/parkingPricing.ts`                                                           | Live cap enforcement + `guestRateCapWeekday`/`guestRateCapWeekend`/`commissionPct` on the DTO |
| `ui/src/features/dashboard/super-admin/pages/SuperAdminParkingPayoutsPage.tsx`                           | New page (settings card + ledger table)                                                       |
| `ui/src/features/dashboard/super-admin/hooks/usePlatformParkingSettings.ts`                              | New hook (settings + ledger queries/mutations)                                                |
| `ui/src/features/dashboard/super-admin/lib/superAdminPaths.ts`, `superAdminPlatformNav.ts`               | New route/nav entries                                                                         |
| `ui/src/features/dashboard/super-admin/routes/index.tsx`                                                 | New route registration                                                                        |
| `ui/src/features/dashboard/parking/components/ParkingPricingRatesFormCard.tsx`, `ParkingPricingPage.tsx` | Cap/commission props now live, fed from `parking-pricing` GET                                 |
| `docs/guides/routes/admin/parking-payouts.md`                                                            | New route guide                                                                               |

## Edge cases

See overview's "Payout (Phase 4)" section — mid-flight commission changes, weekday/weekend proration, chargeback clawback, guest-amount leak audit. All addressed by the buildable subset above except the real-payout path (blocked on PayMongo Platforms business/compliance work).

## Exit criteria

- [ ] Real PayMongo fee schedule + Platforms application status documented, with the volume eligibility threshold set from real numbers (not a guess). **Blocked — requires directly contacting PayMongo.**
- [x] Admin can change commission % and guest rates from `/admin/parking/payouts`; change does not affect already-paid transactions (verified locally: PUT settings → new checkout picks up new values, existing paid transaction's snapshotted values untouched).
- [x] A booking spanning weekday + weekend nights computes host payout correctly, prorated (verified locally end-to-end: Thu weekday + Fri weekend booking → guest ₱750/host ₱700 gross, not the old averaged figure).
- [x] Full audit checklist passes: no host-facing surface leaks the guest-paid amount (re-ran the grep after all changes — still zero).
- [x] `bun run lint && bun run type-check && bun run build` clean.
