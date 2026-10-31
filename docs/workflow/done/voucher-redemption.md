---
title: 'Next-stay voucher redemption — guest wallet + booking apply'
status: done
tags: [vouchers, guest-account, booking, pricing]
updated: 2026-08-31
stage: done
kind: plan
---

# Next-stay voucher redemption

## Goal

Guests can see vouchers they earned after a stay, apply one when booking again at the **same property**, and hosts see the discount on booking pricing.

## Decisions (locked)

| Topic           | Decision                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope           | Same **property** only (true next-stay). Not org-wide (v1).                                                                                                           |
| Wallet          | `/account/vouchers` — list unredeemed awards linked via `guest_user_id` (+ email backfill).                                                                           |
| Apply UX        | Guest **opts in** on the booking form (not forced). Shows eligible vouchers after dates are set; selecting one updates the stay-price estimate and is sent on submit. |
| Price math      | Guest sees estimate from public weekday/weekend rates × nights. Host `ReviewPricingForm` pre-fills **net** stay rate; gross + discount shown as lines.                |
| FREE-STAY       | 100% of **stay rate** (full stay estimate / host booking_rate), not one night.                                                                                        |
| One per booking | At most one voucher on a redeeming booking.                                                                                                                           |
| Auth            | Form already requires guest auth; apply requires signed-in owner of the awarding booking.                                                                             |
| Host            | Pricing summary always shows applied voucher when present (not only COMPLETED award block).                                                                           |

## Data model

On awarding booking (`guest_submissions`):

- Keep `next_stay_voucher_code` / `_amount` / `_awarded_at`
- Add `next_stay_voucher_redeemed_at`, `next_stay_voucher_redeemed_booking_id`

On redeeming booking:

- `applied_voucher_source_booking_id`
- `applied_voucher_code`
- `applied_voucher_percent` (1–100)
- `applied_voucher_discount_php` (nullable until host sets rates; filled at review / transition)

## APIs

- `GET list-guest-vouchers` — JWT guest; link-by-email then list awards
- `submit-form` — optional `appliedVoucherSourceBookingId`; validate + stamp + mark source redeemed
- Stamp `guest_user_id` on claim when JWT present (hardening)

## Out (later)

- Org-wide vouchers
- Auto-force best voucher
- Transfer / stack multiple vouchers
- Guest payment amount = final host rate (still host-finalized)
- Apply voucher on `submit-form-completion` (OTA completion links)

## Production hardening (2026-08-31)

- Pre-validate voucher **before** `processFormData` (no orphan booking on bad voucher)
- Post-save race → booking still succeeds with `voucherWarning` (not hard fail)
- Cancel redeeming booking → restore award to wallet (`releaseAppliedVoucherOnCancel`)
- Legacy peso awards stamp provisional `applied_voucher_discount_php` at redeem
- Guest form maps `VOUCHER_*` errors; single list-guest-vouchers query (no duplicate fetch)
