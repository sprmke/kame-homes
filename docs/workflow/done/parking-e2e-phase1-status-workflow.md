---
stage: done
title: 'Parking E2E — Phase 1c: Status Workflow'
status: implemented
tags: [planning, planned-modules, parking, booking-workflow]
updated: 2026-08-17
---

# Parking E2E — Phase 1c: Parking Status Machine (Backend Spine)

Part of the [Parking E2E Phase 0/1 plan set](./parking-e2e-phase1-overview.md). Depends on [Phase 0](./parking-e2e-phase0-registration-dimensions.md).

**Goal:** Formalize parking-only statuses, relax `parking_id` for broadcast requests, and add broadcast claim substrate — without touching property `workflowOrchestrator`.

---

## Context

`transition-parking-booking/index.ts` uses a 4-state inline map and requires `booking.parking_id`. Guest broadcast needs a pre-claim state and nullable `parking_id`. Property machine is saturated with GAF/pet/SD/calendar/sheets — parking already bypasses it by design.

## Status graph

```
PENDING_HOST_ACCEPTANCE → PENDING_REVIEW | NO_HOST_AVAILABLE | CANCELLED
PENDING_REVIEW          → READY_FOR_CHECKIN | CANCELLED
READY_FOR_CHECKIN       → COMPLETED | CANCELLED
NO_HOST_AVAILABLE       → (terminal)
CANCELLED               → (terminal)
COMPLETED               → (terminal)
```

| Entry path                             | Initial status            | `parking_id`                                                                                                                    |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Host `create-parking-booking`          | `PENDING_REVIEW`          | Required (unchanged)                                                                                                            |
| Guest `submit-parking-booking-request` | `PENDING_HOST_ACCEPTANCE` | Null until claim (broadcast) **or** set immediately if single pinned listing still uses broadcast-of-one with claim — see Doc 3 |

**Pinned listing:** still create at `PENDING_HOST_ACCEPTANCE` with `parking_id` null and exactly one broadcast row for that parking (uniform claim path). Do not special-case auto-`PENDING_REVIEW` on submit — host must Accept (or we can auto-accept later as fast-follow; v1 always requires Accept for guest requests).

## Schema

New migration `supabase/migrations/<ts>_parking_booking_broadcast.sql`:

### 1) Widen status CHECK

Latest constraint: `20261007130000_add_imported_booking_status.sql`. Drop/re-add `guest_submissions_status_check` including:

- `PENDING_HOST_ACCEPTANCE`
- `NO_HOST_AVAILABLE`

(keep all existing property statuses).

### 2) Columns on `guest_submissions`

| Column                            | Type                                     | Notes                                                     |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| `parking_request_organization_id` | `UUID NULL REFERENCES organizations(id)` | Required when parking booking is in broadcast / pre-claim |
| `requested_vehicle_type`          | `TEXT NULL`                              | `car` \| `motorcycle`                                     |
| `parking_broadcast_expires_at`    | `TIMESTAMPTZ NULL`                       | Set on guest submit                                       |
| `parking_claimed_at`              | `TIMESTAMPTZ NULL`                       | Set on successful claim                                   |
| `parking_endorsement_note`        | `TEXT NULL`                              | Host access instructions on accept (max 2000 chars)       |

### 3) Relax property/parking exclusivity CHECK

Replace `guest_submissions_property_or_parking_check` with:

```sql
CHECK (
  -- Property stay: property set, parking null
  (property_id IS NOT NULL AND parking_id IS NULL AND parking_request_organization_id IS NULL)
  OR
  -- Parking booking claimed / host-authored: parking set, property null
  (property_id IS NULL AND parking_id IS NOT NULL)
  OR
  -- Parking broadcast pre-claim: neither property nor parking; org required; status locked
  (
    property_id IS NULL
    AND parking_id IS NULL
    AND parking_request_organization_id IS NOT NULL
    AND status = 'PENDING_HOST_ACCEPTANCE'
  )
);
```

### 4) Table `parking_booking_broadcasts`

```sql
CREATE TABLE public.parking_booking_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.guest_submissions(id) ON DELETE CASCADE,
  parking_id UUID NOT NULL REFERENCES public.parkings(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response TEXT NOT NULL DEFAULT 'pending'
    CHECK (response IN ('pending', 'claimed', 'declined', 'expired')),
  UNIQUE (booking_id, parking_id)
);

CREATE INDEX parking_booking_broadcasts_booking_response_idx
  ON public.parking_booking_broadcasts (booking_id, response);

CREATE INDEX parking_booking_broadcasts_parking_pending_idx
  ON public.parking_booking_broadcasts (parking_id)
  WHERE response = 'pending';
```

RLS: enable RLS; **no** broad anon policies. Writes via service role in edge functions. Host reads only through edge (`verifyParkingTeamAccess`).

### 5) Indexes for expiration cron

```sql
CREATE INDEX guest_submissions_parking_broadcast_expiry_idx
  ON public.guest_submissions (parking_broadcast_expires_at)
  WHERE status = 'PENDING_HOST_ACCEPTANCE';
```

---

### Task 1: Migration

**Files:** Create `supabase/migrations/<ts>_parking_booking_broadcast.sql`

- [x] Write full SQL per sections above (status CHECK list must copy **all** existing values + two new). (`20261017120000_parking_booking_broadcast.sql`, fixed up in `20261017130000_parking_broadcast_terminal_check_fix.sql`)
- [ ] `bun run db:migrate`.
- [ ] Commit.

---

### Task 2: `parkingStatusMachine.ts`

**Files:**

- Create: `supabase/functions/_shared/parkingStatusMachine.ts`
- Modify: `supabase/functions/transition-parking-booking/index.ts` — replace inline `ALLOWED`
- Create: `ui/src/features/dashboard/parking/lib/parkingWorkflow.ts` — labels + allowed transitions for UI

**Interfaces:**

```ts
export const PARKING_STATUSES = [
  'PENDING_HOST_ACCEPTANCE',
  'PENDING_REVIEW',
  'READY_FOR_CHECKIN',
  'COMPLETED',
  'CANCELLED',
  'NO_HOST_AVAILABLE',
] as const;

export type ParkingStatus = (typeof PARKING_STATUSES)[number];

export function canTransition(from: ParkingStatus, to: ParkingStatus): boolean;
export function availableTransitions(from: ParkingStatus): ParkingStatus[];
```

Side effects stay **out** of this module (Doc 3 owns notify/claim). `transition-parking-booking` continues to allow only post-claim hops (`PENDING_REVIEW` onward) for hosts with `bookings:edit`; it must **reject** transitions from `PENDING_HOST_ACCEPTANCE` (those go through claim/decline/expire functions).

- [x] Implement machine + wire `transition-parking-booking`.
- [x] Extend `bookingStatus.ts` / `StatusBadge` labels:

| Status                    | Label             | Tone          |
| ------------------------- | ----------------- | ------------- |
| `PENDING_HOST_ACCEPTANCE` | Awaiting host     | amber/warning |
| `NO_HOST_AVAILABLE`       | No host available | muted         |

- [ ] Commit.

---

## Critical files

- Pattern: `supabase/functions/_shared/statusMachine.ts` (shape only)
- Constraint precedent: `supabase/migrations/20260731120000_guest_submissions_parking_id.sql`
- Status CHECK precedent: `supabase/migrations/20261007130000_add_imported_booking_status.sql`
- RBAC: `supabase/functions/_shared/parkingScope.ts`, `orgAuth.ts#verifyParkingTeamAccess`

## Verification

1. Migration applies; insert pre-claim row with null `parking_id` + org id + `PENDING_HOST_ACCEPTANCE` succeeds.
2. Same row with `PENDING_REVIEW` and null `parking_id` **fails** CHECK.
3. `canTransition('PENDING_HOST_ACCEPTANCE','COMPLETED')` false; `…→'PENDING_REVIEW'` true.
4. Host-authored `create-parking-booking` still works.
5. `bun run lint && bun run type-check && bun run build`.
