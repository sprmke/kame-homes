---
stage: done
title: 'Owner-owned parking as default for property stays'
status: done
tags: [planning, parking, booking-workflow, guest-public]
updated: 2026-08-29
---

# Owner-owned parking as default for property stays

## Goal

When a **property org also owns parking listing(s)**, arranging parking for a property stay should **default to the host’s own available slot** (conflict-aware), while always offering an escape hatch to **search other parkings** via the existing marketplace e2e (`linkStay` → browse → Reserve → pay → endorsement → property gate auto-complete).

Continuation of [`parking-pay-parking-marketplace-connect.md`](../done/parking-pay-parking-marketplace-connect.md) (Find parking → marketplace) and Phase 7 stay linking.

## Context (today)

| Case                        | Behavior                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Host **Find parking**       | Always opens stay-scoped marketplace browse (`/parkings?linkStay=…`)                                                           |
| Guest Reserve on a listing  | Pinned submit (`parking_pinned_id`) → broadcast/claim → pay                                                                    |
| Org owns property + parking | No special path — own slots compete in public search like any other                                                            |
| Availability                | `findParkingBroadcastCandidates` already does ACTIVE + vehicle type + date overlap + 30‑min turnover buffer **within one org** |
| Same-owner Accept           | Host must still Accept their own pinned request (noisy for self-dealing)                                                       |

## Scope

### In

- Detect org-owned parkings for the property booking’s org
- Prefer **available** own listing(s) as default entry (host + guest share links)
- Explicit **Search other parkings** → existing marketplace find path
- Conflict / multi-slot / already-linked / unavailable edge cases
- Same-owner UX: skip pointless “wait for host accept” when guest books the org’s own slot (auto-claim or host-instant path)
- Docs / route guides / `parking-workflow` notes

### Out (unless later slice)

- Cross-org “preferred partner” parkings
- Changing marketplace ranking (Phase 6)
- Host completing pay/cancel as the guest without ownership rebind (still deferred from pay-parking connect Phase B)
- Editing shipped migrations

### Shipped later in Phase 3 (was deferred, now done)

- Complimentary / zero-pay own parking (`complimentaryOwnerParking`)
- Preferred listing setting (`preferredOwnerParkingId`)
- Host multi-slot confirm sheet
- Guest acknowledgement + parking-reminder CTAs prefer own-default when available

## Approach

### Product decisions (recommended locks)

1. **“Owns parking” = same `organization_id` as the property** (`parkings.organization_id` = `properties.organization_id`). Not a separate user graph — matches multi-tenant model (`host_modes` can include both `property` and `parking`).
2. **Guest still runs the e2e submit/pay path** (auth + `guest_auth_user_id` + `linked_property_booking_id`). Host **launches / shares**; does not impersonate guest pay.
3. **Default entry when ≥1 own slot is available for the stay window** → pinned form deep link:
   ```text
   /parkings/:ownSlug/form?linkStay=<propertyBookingId>&checkInDate=…&checkOutDate=…
   ```
   Prefill dates from the **property stay** (guest can still change on Reserve/form if product allows; server re-checks availability).
4. **“Search other parkings”** → existing `guestParkingFindPath` (browse/search with `linkStay`). Always visible when parking is needed, even if own slot is available.
5. **Unavailable own inventory** (all conflicted / inactive / wrong vehicle) → fall back to marketplace find only; surface a short host note that own slots are booked for those dates.
6. **Same-owner pinned submit** → **auto-claim to `PENDING_PAYMENT`** (no Telegram/email fan-out to self). Guest pays → endorsement + property auto-complete unchanged. Reuses claim write path with a trusted server branch (org owner of pinned parking === org of linked property booking).
7. **Multiple own slots available** → pick best default by stable ranking:
   1. Same `residence_name` (case-insensitive) as the property when both set
   2. Else earliest `parkings.created_at`
      Host UI lists alternates (“Use Slot B”) when >1 available; guest share link uses the ranked default unless host picks another.

### Host UX (property booking detail)

When `need_parking` setup / **Find parking**:

| Condition                                 | Primary                                                  | Secondary                 |
| ----------------------------------------- | -------------------------------------------------------- | ------------------------- |
| Already linked marketplace booking        | Open linked request status / panel (unchanged)           | —                         |
| ≥1 own parking available for stay dates   | **Use your parking** (open/copy pinned+`linkStay`+dates) | **Search other parkings** |
| Own parkings exist but **none available** | **Search other parkings**                                | Note: own slots busy      |
| No org parkings                           | **Find parking** (marketplace only — current)            | —                         |

Optional thin confirm sheet (not a rate modal): show chosen slot name + dates + Copy / Open / Search others.

### Guest UX

- Shared **Use your parking** link → signed-in form with stay auto-selected (`linkStay`) and dates prefilled → submit pins own listing → **auto-claim** → Pay now → endorsement → property parking gate clears.
- Shared **Search other parkings** link → current marketplace browse with `linkStay`.
- Guest self-serve from acknowledgement / reminders: if org has an available own default, success/reminder CTAs may deep-link to that pinned form; otherwise marketplace find. (Same helper as host.)

### Server

New (or extend) edge helper, e.g. `resolveOwnerDefaultParkingForPropertyStay`:

Inputs: `propertyBookingId` (and/or `propertyId` + check-in/out), caller auth (host property-scoped **or** guest with linkability).

Returns:

```ts
{
  hasOrgParkings: boolean;
  available: Array<{ id, slug, name, residenceName, … }>; // conflict-filtered
  defaultParking: { id, slug, name } | null;
  unavailableReason?: 'none_owned' | 'all_conflicted' | 'none_active';
}
```

Reuse `findParkingBroadcastCandidates` (or extract shared occupancy filter) with:

- `organizationId` = property’s org
- `checkInDate` / `checkOutDate` = property stay dates (YYYY-MM-DD)
- `requestedVehicleType` — host path may omit and treat any ACTIVE slot; guest form still sends vehicle type at submit. For **default pick**, prefer slots that accept **car** if unknown, or return all available and let form validate.

**Auto-claim branch** in `submit-parking-booking-request` (after insert, when `parking_pinned_id` set):

- Load pinned parking + linked property booking (if any).
- If both orgs match **and** linked stay’s property org === parking org → call shared claim-to-`PENDING_PAYMENT` (no broadcast fan-out / or fan-out skipped).
- Else existing broadcast path.

Idempotency: same as claim (status-guarded update). Do not auto-claim cross-org pins.

### Security

- Default-parking resolution for **hosts**: `resolveScopedPropertyAccess` / booking belongs to property.
- For **guests**: only after `verifyLinkablePropertyBooking` (or public-safe subset: slug + availability without leaking other guests’ plates).
- Auto-claim only when org IDs match; never trust client `autoClaim: true`.
- `linkStay` remains a hint; submit still verifies linkability + ownership.

## Edge cases (must cover)

1. **Own slot booked by another parking guest** for overlapping dates / turnover buffer → not offered as default; marketplace secondary.
2. **Partial overlap** with stay (e.g. slot free for first 2 nights only) → treat as unavailable for default; host must search or shorten dates manually on form (no silent partial book).
3. **Multiple own slots** → ranked default + host picker for alternates.
4. **Own slot inactive / archived** → exclude.
5. **Vehicle type mismatch** at submit → existing 422; default list should prefer compatible types when guest vehicle known from property booking fields.
6. **Already linked** → never offer second default; open status.
7. **Concurrent claim** on own slot between share and guest submit → existing occupancy check on submit → `no_parking_available` / conflict; host can Search others.
8. **Property stay not yet linkable** (`PENDING_REVIEW`) → can still copy Use-your-parking link; submit blocked until linkable (existing rule); toast if host shares early.
9. **Guest email ≠ signed-in account** → link fails server-side (unchanged).
10. **Org has parking but hostModes UI only shows property** — still resolve by `organization_id` inventory, not UI mode flags.
11. **Same person Accept noise** — auto-claim eliminates self-notify; ensure no Telegram/email to parking hosts for this branch.
12. **Payment / endorsement failure** — existing Phase 3/5 recovery (retry endorsement, pay TTL); property gate only clears on successful payment fulfill.
13. **Cancel own-slot booking** — existing cancel + occupancy frees slot for next default resolution.
14. **Host opens Use-your-parking while signed in as host** — public form still requires **guest** auth for submit; Copy link for guest remains primary (same as Find parking today).
15. **Legacy unlinked parking panel** — unchanged; do not route historical vehicle-form rows through auto-default.

## Implementation tasks

### Phase 1 — Resolve + host entry (ship first)

- [x] **1.1** Shared resolver `_shared/ownerDefaultParking.ts` (+ thin edge `resolve-owner-default-parking` or fold into `get-linked-parking-booking` / booking GET). Reuse occupancy from `parkingBroadcast.ts`.
- [x] **1.2** UI hook `useOwnerDefaultParking(booking)` for booking detail.
- [x] **1.3** Rewrite Find parking actions in `bookingDetailActions.ts` / `BookingDetailPage`: **Use your parking** / **Search other parkings** / fallback **Find parking**.
- [x] **1.4** Path helpers: `guestParkingOwnDefaultPath({ slug, bookingId, checkIn, checkOut })` preserving `linkStay` + dates on form URL.
- [x] **1.5** Share-link hook: when default exists, primary copy/open = own form; guest-links group also offers Search others.
- [x] **1.6** Docs: bookings-detail, parkings, parking.md, `parking-workflow.mdc`, `PROJECT.md` snippet.

### Phase 2 — Auto-claim same-org pin + guest CTAs

- [x] **2.1** `submit-parking-booking-request`: skip fan-out notify + auto `PENDING_PAYMENT` when same-org pinned + linked property stay (**locked:** require linked property booking).
- [x] **2.2** Guest legacy pay-parking redirect + `get-pay-parking` prefer own-default URL when available; acknowledgement + parking-reminder CTAs use `resolveGuestParkingCtaAbsoluteUrl` (own-default form when available, else `/parkings?linkStay=…`).
- [x] **2.3** Local e2e smoke (2026-08-29): large-org resolve (chunked PostgREST `.in()`); residence ranking; busy slot excluded; same-org linked pin → `PENDING_PAYMENT`; cross-org + unlinked pin → `PENDING_HOST_ACCEPTANCE`.

### Phase 3 — Polish

- [x] Host confirm sheet with slot picker when multiple available (`OwnerParkingConfirmSheet`).
- [x] Property settings: optional “Preferred parking listing” (`preferredOwnerParkingId`).
- [x] Complimentary / zero-pay own parking (`complimentaryOwnerParking` → `fulfillComplimentaryOwnerParking`; claim skips awaiting-payment email when complimentary will fulfill).

## Docs to update

| Doc                                                                | Change                             |
| ------------------------------------------------------------------ | ---------------------------------- |
| `docs/guides/routes/org/property/bookings-detail.md`               | Use your parking / Search others   |
| `docs/guides/routes/parkings.md`                                   | Own-default deep link + auto-claim |
| `docs/guides/routes/bookings/parking.md`                           | Host matrix                        |
| `.cursor/rules/parking-workflow.mdc`                               | Same-org auto-claim branch         |
| `docs/PROJECT.md`                                                  | Short parking bullet               |
| This plan → `in-progress/` via `/workflow-start` when implementing |

## Open questions

Prefer empty after lock — recommendations above are the defaults unless you override:

1. **Auto-claim only when `linkedPropertyBookingId` is set?** — **Yes (recommended)** so random marketplace guests pinning the host’s public slot still get normal Accept.
2. **Complimentary own parking (skip PayMongo)?** — **Yes (Phase 3)** via property setting `complimentaryOwnerParking` (default off).
3. **Preferred listing setting?** — **Yes (Phase 3)** via `preferredOwnerParkingId`.
4. **Default vehicle assumption when host shares before guest vehicle known?** — Prefer slots accepting `car`, or show all available and let form validate.

## Exit criteria

- [x] Org with available own parking: host primary action uses that slot; guest `linkStay` form works; pay clears property parking gate.
- [x] Org own parking fully booked for stay: host/guest land on marketplace search, not a dead pin.
- [x] Search other parkings always reachable and uses existing e2e.
- [x] Same-org linked pin does not spam Accept notifications; lands in `PENDING_PAYMENT`.
- [x] Cross-org / unlinked pins unchanged.
- [x] Edge matrix covered in local smoke (2.3) + Deno rank unit tests; Phase 3 polish shipped (picker, preferred listing, complimentary); complimentary skip-pay email + guest email/reminder CTAs closed.
- [x] Docs updated in the same change.

## Production-readiness note (large orgs)

`findParkingBroadcastCandidates` occupancy and owner-default pinned lookups chunk PostgREST `.in()` via `postgrestInChunks` — orgs with 100+ parkings no longer fail owner-default resolve with **URI too long**.
