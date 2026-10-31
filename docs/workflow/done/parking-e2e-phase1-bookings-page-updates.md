---
stage: done
title: 'Parking E2E — Phase 1d: Bookings Dashboard Updates'
status: implemented
tags: [planning, planned-modules, parking, booking-workflow]
updated: 2026-08-17
---

# Parking E2E — Phase 1d: Bookings Dashboard Updates

Part of the [Parking E2E Phase 0/1 plan set](./parking-e2e-phase1-overview.md). Depends on [Phase 1c](./parking-e2e-phase1-status-workflow.md) and [Doc 3](./parking-e2e-phase1-host-broadcast-notifications.md).

**Goal:** Hosts can see pending broadcast requests (with countdown), Accept/Decline from detail (and list row actions if already patterned), and understand claimed-by-other / no-host terminal states — Operate mode, dense, minimal copy.

---

## Context

`ParkingBookingsPage.tsx` + `ParkingBookingDetailPage.tsx` only know host-created `PENDING_REVIEW → READY_FOR_CHECKIN → COMPLETED`. Org unified bookings (`list-bookings` parking scope) must not break when new statuses appear.

## UX rules (locked)

- **List / kanban:** columns or filters include `PENDING_HOST_ACCEPTANCE` and `NO_HOST_AVAILABLE`.
- **Countdown:** for pending acceptance, show time remaining to `parking_broadcast_expires_at` (tabular nums); warn tone under 2 minutes.
- **Accept / Decline:** primary Accept, outline Decline; both ≥44×44; disable + spinner while mutation pending.
- **Claim race:** on 409, toast “Already claimed” and refresh query — never leave a stuck Accept button.
- **Visibility:** Accept/Decline only if **this parking** has a `pending` broadcast row for the booking (detail loaded in parking context already has `parking.id`).
- **NO_HOST_AVAILABLE / claimed-elsewhere:** read-only summary; no primary CTA.
- **Kanban:** if parking bookings page is list-only today, add filter chips first; add kanban columns only if the page already has a kanban toggle — do not invent a second paradigm. Check `ParkingBookingsPage` at implement time; prefer extending existing view modes.

## Data needs

List/detail payloads must include for parking bookings:

- `parking_broadcast_expires_at`
- `parking_endorsement_note` (detail)
- Whether current parking is a live candidate: either embed `broadcastResponse` for this parking or a lightweight `GET`/`list` field `myBroadcastStatus: 'pending'|'claimed'|…`

Prefer extending existing `list-bookings` / `get-booking` parking responses in edge/databaseService rather than a second list API.

---

### Task 1: Client workflow helpers + mutations

**Files:**

- Create/modify: `ui/src/features/dashboard/parking/lib/parkingWorkflow.ts`
- Modify: `ui/src/features/dashboard/parking/hooks/useParkingBookingMutations.ts`
- Modify: `ui/src/features/dashboard/bookings/lib/bookingStatus.ts` (+ badge tones)

**Interfaces:**

```ts
useClaimParkingBooking(parkingId: string); // → claim-parking-booking
useDeclineParkingBooking(parkingId: string); // → decline-parking-booking
```

- [x] Wire mutations with toast success/error; invalidate booking queries. Accept/Decline now also show an inline spinner (`Button loading` prop) while pending, not just disabled state.
- [ ] Commit.

---

### Task 2: Detail page actions

**Files:**

- Modify: `ui/src/features/dashboard/parking/pages/ParkingBookingDetailPage.tsx`

Replace/extend `NEXT_STATUS` map:

- If `PENDING_HOST_ACCEPTANCE` && my broadcast pending → Accept + Decline (+ optional endorsement note input, short text field).
- Else keep Mark active / Complete / Cancel for post-claim statuses.
- Hide Cancel or keep? **Lock:** guest-pending requests may be Cancelled only by host with `bookings:edit` if product wants abort — allow Cancel → `CANCELLED` and mark broadcasts `expired` (edge must support; if not in Doc 3, add cancel-broadcast cleanup in `transition-parking-booking` or dedicated path). Prefer: Cancel from `PENDING_HOST_ACCEPTANCE` calls decline-all/expire helper so candidates clear.

- [x] Implement UI + endorsement field (optional, max ~500 chars in UI; server 2000).
- [x] Mobile ContextualActionBar / button row meets touch targets. (`min-h-[44px]` on Accept/Decline)
- [ ] Commit.

---

### Task 3: List / filters / countdown

**Files:**

- Modify: `ui/src/features/dashboard/parking/pages/ParkingBookingsPage.tsx`
- Modify: list fetch mapping if statuses filtered client-side
- Org bookings list: ensure new statuses display via shared `StatusBadge` (no crash on unknown)

- [x] Filters include new statuses. (explicit "Awaiting Host" / "No Host Available" chips via `BookingFilters extraStatuses`; stage cards already bucketed them correctly)
- [x] Countdown component (client tick 1s; `aria-live="polite"` on minute changes only to avoid SR noise). (`ParkingBroadcastCountdown` — was previously only on the guest page, now also on host detail, list table, and card grid)
- [x] Empty state one short line. ("No bookings found" — shared with property bookings, satisfies minimal-copy convention)
- [ ] Commit.

---

## Verification

1. Pending request shows Accept/Decline + countdown for candidate host.
2. After other host claims, this host sees claimed state (no Accept).
3. `NO_HOST_AVAILABLE` visible, read-only.
4. 409 path toasts and refreshes.
5. 375px layout + 44×44 targets.
6. `bun run lint && bun run type-check && bun run build`.
