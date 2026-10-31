---
title: 'Property guest rewards — Reviews, Vouchers, Superhost card + voucher config'
status: done
tags: [settings, vouchers, reviews, superhost, sd-form]
updated: 2026-08-30
stage: done
kind: plan
follow_ups: scratch-card-reveal-v2
---

# Property guest rewards + voucher config

## Goal

Split **External reviews**, **Vouchers**, and **Superhost** out of the property Settings **Socials** card into a dedicated **Reviews & vouchers** card. Hosts configure next-stay vouchers as clear **% off** prizes (not peso amount/weight).

## Scope

### In

- Settings nav: section `guest-rewards` (**Reviews & vouchers**) after Socials
- Compact voucher card + **Manage** modal (same pattern as Superhost / Amenities)
- Prize model: `{ code, percentOff, chancePercent }` — `chancePercent` is a **relative weight**; odds computed in UI (no sum-to-100 required)
- Platform defaults: all presets 5/10/15/20/25/50% + free stay (weights 25/34/20/12/5/3/1)
- Guest reel / copy show `% off`; claim stores percent in `next_stay_voucher_amount`
- Legacy peso awards (`KAME-*`) still display as ₱; legacy stored amount/weight JSON ignored → defaults

### Out

- Org-level voucher defaults
- Automatic redemption of % off on the next booking → see [`voucher-redemption.md`](../done/voucher-redemption.md)
- Restoring `main_social_platform`
- Host-selectable voucher reveal animation → **Follow-ups** below

## Data model

```ts
type PropertyVoucherPrize = {
  code: string; // OFF-10, FREE-STAY
  percentOff: number; // 1–100; 100 = free stay
  chancePercent: number; // relative weight (roll = weight / sum(weights))
};

// app_settings
vouchers_enabled: boolean; // default true
voucher_prizes: PropertyVoucherPrize[]; // [] = platform defaults
```

## Host UI

- Summary: Gift icon · “Next-stay vouchers” · “Off” or “N prizes · 5–50% off · free stay” · **Manage**
- Modal: Enable · full preset catalog (checkbox per discount) · Weight steppers · live Odds · Preview savings · distribution bar · Reset defaults · Done
- Section Save persists via `app-settings` PATCH

## Follow-ups

→ **Done:** [`./voucher-reveal-styles.md`](./voucher-reveal-styles.md)

- [x] **Voucher reveal style** — property setting (Reviews & vouchers) so hosts pick how guests experience the award on `/sd-form` and guest-review
- [x] **Slot scroll / reel** — selectable default style
- [x] **Spin the wheel** — circular wheel animation landing on the rolled prize
- [x] **Flip card** — lightweight alternative (v1 third style)
- [ ] **Other styles** (scratch card, etc.) — deferred v2 (see voucher-reveal-styles §8)

## Docs

- `docs/guides/routes/org/property/settings.md`
- `docs/guides/routes/sd-form.md`
- `docs/architecture/edge-functions.md` (claim notes)
