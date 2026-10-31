---
title: 'Pattern B mock form routes — removal + parking operational shell'
status: done
tags: [workflow, public-ui, parking]
updated: 2026-08-27
stage: done
kind: reference
---

# Pattern B mock form routes — removal + parking operational shell

## Problem

Two parallel public form shells existed:

| Pattern             | Routes                                                                 | Shell                                                        | Data                      |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| **A (operational)** | `/properties/:slug/form`, `/parkings/:slug/form`, …                    | `MainLayout` + `GuestFormBrandHeader` + brand band           | Live edge functions       |
| **B (PMA stub)**    | `/properties/:slug/forms/:formId`, `/developments/:slug/forms/:formId` | `FormPageWrapper` + `FormPageToolbar` + `PropertyPageHeader` | `mockForms` + fake submit |

Pattern B was never linked from production flows except one dead fallback on development parking cards (missing `detailSlug`). Parking briefly shared `FormPageWrapper` with an optional real `onSubmit`; that was superseded by a dedicated `ParkingFormPage`.

## Shipped (2026-08-27)

### Pattern B removal

- Deleted routes, pages, and mock stack: `PropertyFormPage`, `DevelopmentFormPage`, `FormPageWrapper`, `FormPageToolbar`, `PublicFormRenderer`, `FormFieldRenderer`, `PropertyPageHeader`, `mockForms.ts`, guest-forms templates/types.
- Kept `FormSuccess.tsx` + new `parkingFormCopy.ts` for live parking success state.
- `ParkingSlotCard` fallback reserve link → `/developments/:slug/parking` (not mock forms).
- Removed `formId` from development parking slot types and mappers.
- Route guides, `routing.md`, README index, page-title inventory, public-ui skills updated.

### Parking operational shell (Pattern A)

- **`ParkingFormPage`** — `MainLayout` + `GuestFormBrandHeader`, page title + favicon, real `ParkingRegistrationForm` submit.
- **`ParkingRequestStatusPage`** — same shell; `get-parking-booking-status` extended with branding fields (`parkingName`, `residenceName`, `coverImage`, `brandColor`, `logoUrl`).
- **`MarketingLayoutShell`** — focused flow hides nav/footer for `/parkings/:slug/form` and `/parkings/requests/:bookingId`.

## Public route audit (post-cleanup)

All guest-facing routes verified against `ui/src/features/guest/**/routes`:

| Area                  | Routes                                                                                 | Shell                                     |
| --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| Marketing browse      | `/`, `/search`, `/properties*`, `/developments*`, `/parkings` (list/detail)            | `MarketingLayoutShell` + nav/footer       |
| Parking operational   | `/parkings/:slug/form`, `/parkings/requests/:bookingId`                                | `MainLayout` (focused — no marketing nav) |
| Property operational  | `/properties/:slug/calendar                                                            | form                                      | success                        | sd-form      | guest-review | messages | parking/:id` | `GuestPublicLayout` → `MainLayout` |
| Stay guide / document | `/properties/:slug/stay-guide`, `…/document`                                           | Standalone pages                          |
| Auth                  | `/for-hosts/login                                                                      | register`, `/for-guests/login             | register`, `/sign-in` redirect | `AuthLayout` |
| Account               | `/account/*`                                                                           | Inside marketing shell                    |
| Legacy                | `/calendar`, `/form`, `/success`, `/sd-form`, `/guest-review`, `/bookings/:id/parking` | Redirects to property-scoped paths        |

No remaining code or e2e references to `/forms/:formId`.

## Verification

- `cd ui && bun run type-check` — pass
- Grep — no imports of removed Pattern B symbols in `ui/src`

## Related

- [`public-operational-guest-pages-multi-tenant.md`](./public-operational-guest-pages-multi-tenant.md) — property operational shell baseline
- [`parkings.md`](../../guides/routes/parkings.md) — parking form + status routes
- [`../wont-do/property-public-pages-shell-redesign.md`](../wont-do/property-public-pages-shell-redesign.md) — cancelled sibling-route redesign (forms route note retired)
