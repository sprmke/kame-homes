---
stage: done
title: 'Parking E2E — Phase 1a (Host Side): Broadcast, Claim, Notify'
status: implemented
tags: [planning, planned-modules, parking, booking-workflow, integrations]
updated: 2026-08-17
---

# Parking E2E — Phase 1a (Host Side): Broadcast, Claim, Notify

Part of the [Parking E2E Phase 0/1 plan set](./parking-e2e-phase1-overview.md). Depends on [Phase 1c](./parking-e2e-phase1-status-workflow.md).

**Goal:** Find eligible parkings in one org, notify their hosts, let the first Accept win atomically, expire or all-decline into `NO_HOST_AVAILABLE`.

---

## Context

No first-to-claim pattern exists. Legacy `sendParkingBroadcast` (`emailService.ts`) is a passive BCC for **property** stay parking sub-status — do not reuse for this vertical.

## Candidate query

Parkings where **all** hold:

1. `organization_id = $parking_request_organization_id`
2. `status = 'ACTIVE'`
3. `accepted_vehicle_types @> ARRAY[$requested_vehicle_type]::text[]`
4. If submit pinned a `parkingId`, restrict to that id only
5. No conflicting parking booking: another `guest_submissions` with same `parking_id`, overlapping stay dates, and `status NOT IN ('CANCELLED','NO_HOST_AVAILABLE')`

Date overlap: reuse existing parking stay-date helpers / same semantics as `create-parking-booking` availability checks.

**Out of scope:** dimension-fit scoring, tower-vs-bay preference, cross-org search (Phase 2a/2b).

## TTL

```ts
function parkingBroadcastTtlMs(checkInDateManila: string /* YYYY-MM-DD */): number {
  const today = /* Asia/Manila calendar date */;
  return checkInDateManila === today ? 15 * 60_000 : 60 * 60_000;
}
```

Set `parking_broadcast_expires_at = now() + ttl` on submit (Doc 4).

## Fan-out (`parkingBroadcast.ts`)

For each candidate:

1. Insert `parking_booking_broadcasts` (`response = 'pending'`).
2. **Telegram:** if parking telegram settings `enabled` && `notify_on_reservation_request`, send via credentials from `resolvePropertyTelegramCredentials('parking', { parkingId })` using `reservation_request_template`. Wire this path here if unused today.
3. **Email:** new `sendParkingReservationRequestEmail({ to, parkingName, deepLink, guestName, dates, expiresAt })` — **per recipient**, not BCC blast. Deep link → dashboard `ParkingBookingDetailPage` for that parking/booking.
4. Set `notified_at`.

If Telegram/email fails for one candidate, log and continue others (do not roll back the booking); surface partial-failure in function logs.

Placeholders to add for Telegram if missing: `expires_at`, `booking_id` short ref, dashboard URL — keep template sanitize limits in `telegramParking.ts`.

## Atomic claim — `claim-parking-booking`

`serveAuthenticated` + `verifyParkingTeamAccess(req, parkingId, 'bookings:edit')`.

```sql
UPDATE guest_submissions
SET
  status = 'PENDING_REVIEW',
  parking_id = $claimingParkingId,
  parking_claimed_at = now(),
  parking_endorsement_note = NULLIF(trim($note), '')
WHERE id = $bookingId
  AND status = 'PENDING_HOST_ACCEPTANCE'
  AND parking_request_organization_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM parking_booking_broadcasts b
    WHERE b.booking_id = $bookingId
      AND b.parking_id = $claimingParkingId
      AND b.response = 'pending'
  )
RETURNING *;
```

- 0 rows → **409** `{ error: 'already_claimed' }` (or expired).
- On success: set this broadcast `claimed` + `responded_at`; set all other broadcasts for booking to `expired`.
- Optional guest email “Parking confirmed” (lightweight) — include in same change if template cost is low; otherwise Doc 4 status page alone is enough for v1 guest feedback (Realtime). Prefer **send guest confirmation email** for production readiness.

## Decline — `decline-parking-booking`

- Mark this parking’s broadcast `declined` + `responded_at`.
- If **no** remaining `pending` rows for the booking → transition booking to `NO_HOST_AVAILABLE`, expire nothing else needed, notify guest once.
- Else leave booking `PENDING_HOST_ACCEPTANCE`.

## Expiration cron — `expire-parking-broadcasts`

Follow `docs/archive/operations/scheduled-jobs-and-testing.md` (`pg_cron` + `pg_net`). Handler: `serveCronPost` + optional cron secret.

Every 1–5 minutes:

1. Select bookings `status = 'PENDING_HOST_ACCEPTANCE' AND parking_broadcast_expires_at < now()`.
2. For each: mark remaining `pending` broadcasts `expired`; set status `NO_HOST_AVAILABLE`.
3. Guest email once; use idempotent guard (e.g. only transition if still `PENDING_HOST_ACCEPTANCE` in same UPDATE).

**v1:** no second broadcast round.

---

### Task 1: Shared broadcast module + emails

**Files:**

- Create: `supabase/functions/_shared/parkingBroadcast.ts`
- Modify: `supabase/functions/_shared/emailService.ts`
- Modify: `supabase/functions/_shared/telegramParking.ts` (send helper if missing)
- Add HTML under `supabase/functions/_shared/email-templates/` + `static_files` on callers

- [x] Implement `findParkingBroadcastCandidates`, `fanOutParkingBroadcast`, guest+host email helpers. Notification deep links now point at the specific booking (`/org/:orgSlug/parking/:parkingSlug/bookings/:bookingId`), not the bookings list — Telegram appends it as plain text (no CTA affordance there); fan-out failure now rolls back the orphaned booking row instead of leaving it stuck.
- [ ] Commit.

---

### Task 2: Claim + decline edge functions

**Files:**

- Create: `supabase/functions/claim-parking-booking/index.ts`
- Create: `supabase/functions/decline-parking-booking/index.ts`
- Modify: `supabase/config.toml` (`verify_jwt = false` for authenticated handlers that use app JWT verify pattern matching siblings)

**Interfaces:**

```ts
// POST claim-parking-booking
{ bookingId: string; parkingId: string; endorsementNote?: string }

// POST decline-parking-booking
{ bookingId: string; parkingId: string }
```

- [x] Implement + local curl smoke with two hosts. (atomic claim implemented — first Accept wins via guarded `UPDATE ... WHERE status='PENDING_HOST_ACCEPTANCE'`, decline-all terminates immediately; live two-host curl smoke not re-run this session)
- [ ] Commit.

---

### Task 3: Expiration cron

**Files:**

- Create: `supabase/functions/expire-parking-broadcasts/index.ts`
- Document SQL snippet for `pg_cron` in migration or `supabase/snippets/` + ops note in runbook link from overview

- [x] Idempotent expire path. **Now scheduled**: `public.sync_parking_broadcast_expire_cron_job()` (migration `20261018120000_parking_broadcast_expire_cron.sql`, every 5 min) — this was the one item in the whole module that was silently unscheduled in every environment; production activation still requires the migration to actually run against hosted Supabase (`kamewave`-gated per repo rules).
- [ ] Commit.

---

## Critical files

- `supabase/functions/_shared/telegramParking.ts`
- `supabase/functions/_shared/emailService.ts` (~`sendParkingBroadcast` as **anti-pattern** reference)
- `supabase/functions/_shared/orgAuth.ts` — `verifyParkingTeamAccess`
- `ui/.../ParkingBookingDetailPage.tsx` — actions land in Doc 5

## Verification

1. Two candidates → two pending rows + Telegram/email (sandbox/logs).
2. A claims → 200; B claims → 409; B’s row `expired`.
3. All decline → `NO_HOST_AVAILABLE` before TTL; guest emailed once.
4. TTL expire with zero claims → same terminal + guest email; cron re-run no duplicate email.
5. Org B never a candidate for org A.
6. `bun run lint && bun run type-check && bun run build`.
