---
stage: done
title: 'Connect host pay-parking → parking marketplace e2e'
status: done
tags: [planning, parking, booking-workflow, guest-public]
updated: 2026-08-29
---

# Connect host pay-parking → parking marketplace e2e

## Goal

Replace the legacy property **pay parking** path (host **Set up parking** → `PayParkingModal` → public `/properties/:slug/parking/:bookingId` vehicle form + owner BCC) with the **same marketplace UX** guests already use: browse/search → listing detail → Reserve → registration → request status → PayMongo → endorsement, with the property stay linked via `linked_property_booking_id` so the property booking’s parking gate auto-completes.

When a property host adds/sets up parking for a guest, they should land in (or launch) that **search + overall e2e flow**, not the old plate/brand/color + broadcast form.

## Context (today)

| Path                                                | What it does                                                | Marketplace?                       |
| --------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| Host **Set up parking** / **Open parking link**     | `PayParkingModal` + `PayParkingPage` → `submit-pay-parking` | No                                 |
| Host **Open/Copy parking link** (guest-links group) | Opens `/parkings` root only                                 | Browse only; no stay deep-link     |
| Guest self-serve                                    | `/parkings` → Reserve → form → status → pay                 | Yes + optional stay link (Phase 7) |
| Parking dashboard **New booking**                   | Fixed-slot `ParkingRegistrationForm`                        | Submit yes; **no** search/browse   |

Phase 7 intentionally left pay-parking untouched as a compatibility window. Production readiness open question #5: sunset date (or never) for that legacy path — this plan answers **sunset for new setups**, keep read-only/compat for historical rows.

## Scope

### In

- Host property-booking entry: **Set up parking** / pay-parking actions → marketplace find + overall flow
- Guest-facing public pay-parking URL: redirect or restyle into stay-scoped marketplace entry
- Deep link that pre-binds / pre-selects the property stay for linking after guest auth
- Menu label cleanup (duplicate **Open parking link**)
- Docs, route guides, `parking-workflow` / `booking-workflow` notes, production-readiness Q5

### Out (unless a later slice)

- Rebuilding marketplace search UI from scratch (reuse existing `/parkings`, `/search`, detail, form, status)
- Fixing parking-dashboard **New booking** `guest_auth_user_id` = host ownership (related gap; note only — optional Phase B)
- PayMongo Platforms automated payout / Phase 6 ranking
- Dropping legacy DB columns (`parking_owner`, `parking_rate_*`, etc.) in the first ship
- Editing shipped migrations

## Approach

### Product decision (locked for this plan)

**Primary model: guest runs the marketplace flow; host launches it with stay context.**

Rationale: Phase 7 already made payment, claim, endorsement, and auto-complete guest-owned and guest-authenticated. Host-operated “book for guest” without ownership transfer breaks **Pay now** / cancel (same bug as parking **New booking**). Host should **see and share** the real search/e2e UX, not a parallel admin vehicle form.

**Secondary (optional later):** host books on a guest’s behalf only after an ownership-safe path exists (guest account invite / transfer `guest_auth_user_id`).

### Target UX

#### A. Host — property booking detail

1. Overflow / header action renames:
   - **Find parking** (was **Set up parking**) — primary
   - **Open guest parking page** / **Copy guest parking link** — stay-scoped marketplace entry (not legacy pay-parking URL)
   - Remove or demote the second duplicate **Open parking link** that only opens bare `/parkings`
2. **Find parking** opens one of:
   - **Preferred:** new tab / same-window to the **public** parkings browse or unified search, with query params that carry stay context (see deep link below), so the host literally sees the live guest search UX; **or**
   - **Dashboard embed (if product wants stay-in-admin):** a full-height sheet/modal that embeds the same browse/list components used by `ParkingsListPage` / search parkings tab, then Reserve opens the existing `ParkingBookingFormModal` — still requires guest auth for submit, so embed is best as **preview + copy link**, not host submit, until Phase B.
3. First click also ensures `need_parking = true` on the property booking (lightweight patch; **no** legacy rate/date modal required for marketplace — rates live on parking listings / platform settings).

#### B. Guest — stay-scoped entry (replaces `PayParkingPage`)

Deep link shape (illustrative; finalize in implementation):

```text
/parkings?linkStay=<propertyBookingId>
# or location-aware:
/parkings/in/<city>?linkStay=<propertyBookingId>
# optional search:
/search?listing=parkings&linkStay=<propertyBookingId>
```

Behavior:

1. Guest opens link → same browse/search UI as today.
2. After sign-in, if `linkStay` is present and `verifyLinkablePropertyBooking` passes for this guest, the stay is **auto-selected** when they open Reserve / form (skip or pre-fill **Which stay?**).
3. Rest of flow unchanged: match → pay → endorsement → property parking auto-complete.
4. Old URL `/properties/:propertySlug/parking/:bookingId` (and legacy `/bookings/:id/parking`):
   - If booking already has a **linked** marketplace parking booking → redirect to `/parkings/requests/:parkingBookingId` (or booking detail status).
   - Else if guest is eligible → redirect to stay-scoped `/parkings?linkStay=…`.
   - Else (cancelled / not linkable / anonymous preview) → clear message + sign-in / `/parkings` CTA.
5. Public Pages “pay parking” card: update pattern + host preview to the new entry (or marketplace preview), not the vehicle form.

#### C. Legacy compatibility

| Booking state                                 | Behavior                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| New / `need_parking` without marketplace link | Marketplace entry only                                                                                                   |
| Historical with vehicle fields + no link      | Keep **ParkingPanel** legacy fields + manual Mark complete; optional one-time “Switch to marketplace” CTA                |
| Already linked                                | Parking panel live match view (unchanged)                                                                                |
| Admin still needs owner BCC for an old deal   | Keep `parking-broadcast-email` + `ParkingRequestForm` for **unlinked** rows only; do not advertise from **Find parking** |

Sunset for **new** pay-parking setups: this plan. Full deletion of `submit-pay-parking` / `PayParkingPage` UI: follow-up after no in-flight legacy use (or explicit “never delete columns, only hide entry points”).

### Security / auth

- `linkStay` is a capability hint only — server must re-check ownership + linkability on submit (`parkingPropertyLink.ts`), same as today’s chooser.
- Do not allow anonymous submit via this entry (Phase 3 guest auth stays).
- Do not trust client `linkedPropertyBookingId` without `verifyLinkablePropertyBooking`.
- Host opening public browse in a new tab does not grant host the guest’s JWT; host uses **Copy link** for the guest.

### Edge cases

1. **Duplicate labels** — fix in the same change as entry rewrite.
2. **Booking not yet linkable** (`PENDING_REVIEW`) — Find parking can still set `need_parking` and copy a link; form submit stays blocked until status is linkable (existing rule). Surface a short host toast if sharing early.
3. **Already linked** — Find parking opens status / linked panel, not a second search.
4. **Guest email ≠ signed-in user** — same as Phase 7; link fails server-side; guest must use the account that owns the stay.
5. **Host books for guest** — out of Phase A; document the New-booking ownership gap; do not reintroduce legacy pay-parking as the workaround.
6. **Location prefill** — prefer property/development city → `/parkings/in/:location?linkStay=…` when known; else `/parkings?linkStay=…`.
7. **Dates** — still from listing availability / Reserve calendar, not property stay dates (Phase 7 invariant).
8. **Rate modal** — remove as primary path; marketplace pricing applies. Do not write `parking_rate_guest` for new marketplace setups.
9. **Org automation / plan gates** — marketplace path does not use `emailParkingBroadcast`; no change to plan-gated legacy broadcast toggles except docs.

## Implementation tasks

### Phase A — Connect entry points (ship first)

- [x] **A1. Stay-scoped marketplace URL helper**
  - Add `guestParkingFindPath({ bookingId, locationSlug? })` next to `guestPayParkingPath` in `ui/src/features/guest/lib/guestPublicPaths.ts`.
  - Update `useBookingParkingShareLink.ts` to emit that URL (not bare `/parkings`).
- [x] **A2. Consume `linkStay` on guest parkings / search / form**
  - Read query param on `ParkingsListPage` / search / `ParkingDetailPage` / `ParkingRegistrationForm` / `ParkingBookingFormModal`.
  - After auth + `list-linkable-property-bookings`, auto-select matching stay; persist through Reserve → form.
  - Server: no new trust — existing `linkedPropertyBookingId` verify on `submit-parking-booking-request`.
- [x] **A3. Host actions**
  - Rewrite `bookingDetailActions.ts` labels + handlers: **Find parking**, copy/open stay-scoped link; remove duplicate bare `/parkings` rows or merge into one guest-links group.
  - Replace `PayParkingModal` primary path with “ensure `need_parking` + open/copy find-parking link” (thin confirm if needed). Retire rate/date fields from the **primary** setup path.
  - `BookingDetailPage.tsx`: wire new handlers; keep legacy open only behind an explicit “Legacy parking form” if still needed for historical bookings.
- [x] **A4. Public pay-parking route**
  - `PayParkingPage` / `LegacyPayParkingRedirect`: implement redirect matrix in Approach B.4.
  - Soft-deprecate `get-pay-parking` / `submit-pay-parking` for new traffic (keep for historical admin fills until Phase C).
- [x] **A5. Public Pages + emails**
  - Public Pages pay-parking card pattern → stay-scoped find URL / preview.
  - Confirm booking acknowledgement / success / reminder already point at marketplace; align any remaining pay-parking absolute URLs.
- [x] **A6. Docs + rules**
  - Route guides + production-readiness Q5 updated.
- [x] **A7. Verification**
  - Type-check clean for this module; e2e harness includes `parkingBookingId`.

### Phase B — Host-on-behalf ownership

- [x] **B1.** Ownership-safe pay/cancel/endorsement: `parkingGuestOwnership.ts` — caller email matching `guest_email` rebinds `guest_auth_user_id` (covers Admin New booking guests who later sign in).
- [x] **B2/B3.** Dashboard embed / host-operated search **deferred by product lock** — Phase A public new tab + copy link is the host surface; embed would still require guest auth to submit.

### Phase C — Legacy teardown (after A stable)

- [x] **C1.** Guest pay-parking URL is redirect-only (no vehicle form for new traffic).
- [x] **C2.** Host UI advertises **Find parking** / guest parking link — not Set up parking / legacy pay-parking modal.
- [x] **C3.** Keep redirect-only `PayParkingPage` stub; `submit-pay-parking` remains for any residual callers; `PayParkingModal` deprecated unused.
- [x] **C4.** Production-readiness Q5 resolved for new setups.

## Shipped 2026-08-29

Implementation complete for this plan’s locked scope (public new-tab Find parking + `linkStay` + ownership rebind + legacy redirect). Dashboard search embed remains out of scope.

## Docs to update

| Doc                                                                                         | Change                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------- |
| `docs/guides/routes/bookings/parking.md`                                                    | Marketplace entry + redirect matrix   |
| `docs/guides/routes/org/property/bookings-detail.md`                                        | Find parking / labels                 |
| `docs/guides/routes/org/property/public-pages.md`                                           | Pay parking card                      |
| `docs/guides/routes/parkings.md`                                                            | `linkStay` query behavior             |
| `docs/PROJECT.md`                                                                           | Routes / deprecated pay-parking       |
| `.cursor/rules/parking-workflow.mdc`                                                        | Host-assist = stay-scoped marketplace |
| `.cursor/rules/booking-workflow.mdc`                                                        | Pay-parking sunset note               |
| `docs/workflow/in-progress/production-readiness/audits/parking-e2e-production-readiness.md` | Resolve Q5 for new setups             |
| This plan → `/workflow-start` when implementing                                             | Move to `in-progress/`                |

## Open questions

1. ~~Host Find parking surface~~ — **locked:** public new tab + copy link.
2. ~~Location prefill~~ — **locked:** property city when available.
3. ~~Legacy escape hatch~~ — **locked:** hard-cut new entry; redirect-only legacy URLs.

## Related

- Done: [`../done/parking-e2e-phase7-property-booking-migration.md`](../done/parking-e2e-phase7-property-booking-migration.md)
- Overview: [`parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md)
- Tracking: [`parking-e2e-production-readiness.md`](../in-progress/production-readiness/audits/parking-e2e-production-readiness.md) (Q5)
- In progress: Phase 3–5 / 8 docs under `../in-progress/`
