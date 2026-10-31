---
title: 'Public operational guest pages — multi-tenant readiness'
status: done
tags: [workflow, done, guest-form, multi-tenancy, public-ui]
updated: 2026-08-09
stage: done
kind: plan
---

# Public operational guest pages — multi-tenant readiness

> **For agentic workers:** Follow tasks in order. Checkbox (`- [ ]`) syntax for tracking. Counterpart shipped work: [`../done/guest-form-configurable-sections.md`](../done/guest-form-configurable-sections.md).

## Context

Operational guest pages (`/properties/:propertySlug/...`) still show **Kame Home / Monaco 2604 / Azure North** in shared shell UI (`KameFormBrandHeader`, `MainLayout` hero/footer) and Azure-specific instructional copy in the guest form and pay-parking flow.

Guest form **logic** was generalized in guest-form-configurable-sections (section toggles, capacity, check times, Direct source). This plan completes **branding + copy** for prod multi-tenant readiness.

**Scope (locked):** Operational property flows only — calendar, form, success, sd-form, guest-review, pay-parking, stay-guide, property chat.

**Hero banner (locked):** Org **brand color** gradient band in `MainLayout` (no image upload).

---

## Locked decisions

| #   | Decision                                                                                           |
| --- | -------------------------------------------------------------------------------------------------- |
| D1  | Scope = operational property flows only                                                            |
| D2  | Hero band = org brand color gradient (no hero image)                                               |
| D3  | Header eyebrow = derived `{property.name} · {residence_name}`                                      |
| D4  | Extend `get-guest-payment-info` as primary branding payload                                        |
| D5  | Instructional copy: residence defaults → optional `properties.settings.guestFormCopy` override     |
| D6  | Preserve Azure/Kame copy when new keys unset                                                       |
| D7  | Rename `KameFormBrandHeader` → `GuestFormBrandHeader`                                              |
| D8  | Configurable items C7–C15 approved with plan defaults (dev/residence defaults + property override) |

---

## Audit summary

| Route                      | Hardcoded items                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------- |
| All `MainLayout` pages     | ~~Hero image~~ → brand-color band; footer was `© 2024 Kame Home — Azure North`     |
| All `KameFormBrandHeader`  | Eyebrow `Monaco 2604 · Azure North`, alt `Kame Home`                               |
| `/form`                    | Azure parking/pet/GAF copy; schema default `Monaco 2604`; Facebook contact strings |
| `/success`                 | Azure GAF note                                                                     |
| `/sd-form`                 | `Thanks for staying at Kame Home!`                                                 |
| `/parking/:bookingId`      | Azure last-minute warning; Facebook error copy                                     |
| `/stay-guide`, `/messages` | Already dynamic                                                                    |

---

## File map

| File                                                  | Role                                     |
| ----------------------------------------------------- | ---------------------------------------- |
| `supabase/functions/_shared/guestFormSettings.ts`     | Branding resolver (property + org join)  |
| `supabase/functions/_shared/orgSettings.ts`           | Org operator settings                    |
| `supabase/functions/_shared/appSettings.ts`           | Extend `GuestPaymentInfoDto`             |
| `ui/src/components/branding/GuestFormBrandHeader.tsx` | Dynamic header props                     |
| `ui/src/layouts/MainLayout.tsx`                       | Brand-color header band + dynamic footer |
| `ui/src/features/guest/form/lib/guestFormBranding.ts` | Residence-aware instructional copy       |
| Guest form / success / sd / pay-parking components    | Wire branding + copy                     |
| Route guides + `docs/PROJECT.md`                      | Docs                                     |

---

## Tasks

- [x] Task 1: `MainLayout` brand-color header band (org hero upload removed)
- [x] Task 2: `guestFormSettings` + extend `get-guest-payment-info`
- [x] Task 3: `GuestFormBrandHeader` + `MainLayout`
- [x] Task 4: Guest form copy + tower default + contact labels
- [x] Task 5: Success, SD form, pay-parking + booking endpoints
- [x] Task 6: Docs + `type-check` / `lint` / `build` + manual smoke

---

## Verification

1. Kame Home / Azure: visual parity when copy overrides unset (Azure dev defaults seeded in code).
2. Second test property: eyebrow shows property + residence; no Monaco strings.
3. Org brand color updates all operational pages under that org's properties.
4. Pay parking: dynamic eyebrow + org hero (screenshot case fixed).
5. `curl get-guest-payment-info?property=<slug>` returns branding fields.

All verified 2026-08-09 (`bun run type-check`, `lint`, `build`; route guides + `docs/PROJECT.md` updated; loading skeletons no longer use legacy `KameFormBrandHeader`).

---

## Completion status

**Done** — shipped 2026-08-03 through 2026-08-09 (Task 6 closed 2026-08-09).

**Restore note (2026-08-03):** After a shell-redesign attempt + revert wiped chrome, operational branding was re-applied on the existing `MainLayout` path (brand-color band, no cover image / texture, `GuestFormBrandHeader` + dynamic footer). The separate shell redesign plan remains in `docs/workflow/planned/property-public-pages-shell-redesign.md` and was **not** re-executed in that restore.

### Post-ship delta (2026-08-09)

- **Task 6:** Route guides updated (`sd-form.md`, `bookings/parking.md`); `docs/PROJECT.md` operational branding section; `GuestPageSkeletons` uses neutral header skeleton (removed legacy `KameFormBrandHeader.tsx`).
- **D5 (`guestFormCopy`):** Per-property JSONB override not shipped — instructional copy uses **`guestFormBranding.ts`** templates keyed off `residenceName` / org name from **`get-guest-payment-info`** (Azure/Kame parity when residence matches seeded defaults).
- **Hero image migration:** `guest_hero_image_url` was never added; brand-color band only — no migration required.
