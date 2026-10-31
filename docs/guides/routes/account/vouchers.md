---
title: 'Guest Vouchers — operator guide'
status: active
tags: [guides, routes, account, vouchers]
updated: 2026-08-31
---

# Guest Vouchers — operator guide

Route: `/account/vouchers`

> **Status:** Documented.

## Progress overview

| Section    | E2E save | Validation | Docs       | Notes                               |
| ---------- | -------- | ---------- | ---------- | ----------------------------------- |
| Wallet     | ✅       | —          | Documented | Compact ticket rows (Ready + Used)  |
| Book again | ✅       | —          | Documented | Deep-links to property booking form |

---

## Overview

Signed-in guests see next-stay vouchers earned after a completed stay (review + claim). Ready vouchers link to book again at the same property; used vouchers stay listed for history. Wallet cards are compact ticket rows (code + offer + property), not large marketing cards.

---

## Host-facing knowledge

Guests keep vouchers they earned from a previous stay in their account under **Vouchers**. They can apply one when booking the same property again. The discount lowers the stay rate you set at review — it does not change the guest’s downpayment amount.

**Common host questions**

- Q: A guest says they have a voucher but don’t see it on the form.
  A: They must be signed in with the same account/email as the stay that earned it, and they must book the **same** property. Vouchers don’t move between properties.
- Q: Does the voucher change what they pay as downpayment?
  A: No. Downpayment stays as usual. The voucher reduces the booking rate when you review pricing.
- Q: How do I see that a guest used a voucher?
  A: Open the booking → Pricing. You’ll see a **Guest voucher** block and a lower pre-filled booking rate on Review pricing.

---

## Wallet list

### Fields (per card)

| Field    | Storage / source                       | Notes              |
| -------- | -------------------------------------- | ------------------ |
| Offer    | `next_stay_voucher_*` on awarding stay | % off or free stay |
| Property | Linked `properties` row                | Name + Book again  |
| Status   | `next_stay_voucher_redeemed_at`        | Ready vs Used      |

### Load path

1. Page mount → `GET list-guest-vouchers?includeRedeemed=1`
2. Server links bookings by email, then lists awards for `guest_user_id`

---

## API reference

| Endpoint              | Method | Auth      | Notes                                             |
| --------------------- | ------ | --------- | ------------------------------------------------- |
| `list-guest-vouchers` | GET    | Guest JWT | `?property=` / `?propertyId=` / `includeRedeemed` |

---

## Implementation map

| Concern     | Path                                                               |
| ----------- | ------------------------------------------------------------------ |
| Page        | `ui/src/features/guest/account/pages/GuestVouchersPage.tsx`        |
| UI          | `ui/src/features/guest/account/components/GuestVoucherUi.tsx`      |
| Form picker | `ui/src/features/guest/form/components/GuestFormVoucherPicker.tsx` |
| Hook        | `ui/src/features/guest/account/hooks/useGuestVouchersQuery.ts`     |
| API         | `ui/src/features/guest/account/lib/guestAccountApi.ts`             |
| Nav         | `ui/src/features/guest/account/lib/guestAccountNav.ts`             |
| Edge        | `supabase/functions/list-guest-vouchers/`                          |
| Plan        | `docs/workfl../done/voucher-redemption.md`                         |

---

## Testing

| Layer | Path / spec                                                                              | Manual |
| ----- | ---------------------------------------------------------------------------------------- | ------ |
| Unit  | Voucher catalog / wheel helpers in `ui/src/features/guest/vouchers/`                     | —      |
| E2E   | `ui/e2e/features/vouchers/guest/voucherWallet.spec.ts` and related voucher specs (`@ci`) | —      |
| N/A   | —                                                                                        | —      |

---

## Related docs

- [Guest booking form](../form.md)
- [Booking detail](../org/property/bookings-detail.md)
- [SD form / voucher award](../sd-form.md)
