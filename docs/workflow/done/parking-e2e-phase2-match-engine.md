---
stage: done
title: 'Parking E2E Phase 2 — Match Engine (Conflict-safe Availability + Ranked Batch Dispatch)'
status: done
tags: [planning, planned-modules, parking]
updated: 2026-08-26
---

# Phase 2 — Match Engine

Part of [Parking E2E Phase 2+ overview](./parking-e2e-later-phases.md). Depends on Phase 0/1 (done).

## Problem

Today: `findParkingBroadcastCandidates()` returns every ACTIVE org-scoped parking matching vehicle type with no date conflict, then notifies all of them at once — first click wins. This is fair only in the sense that it's simple; it's not price-optimized, doesn't consider check-in/check-out edge overlaps beyond a basic conflict check, and floods every host regardless of fit. The user wants a Grab-style flow: find the best available candidate for the exact date/time window, offer to a small ranked batch, and expand the search only if nobody responds.

## Decisions

| #   | Decision                                                                                                                                                                                                                                                                | Detail                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ranking v1 = price only, ascending `host_gross` (the host's own configured rate for the matching night(s))                                                                                                                                                              | See margin model in the overview — cheapest eligible host is both best-for-guest and most profitable for the platform.                                                             |
| 2   | Hosts priced above the guest rate cap (Phase 3 D5) are excluded from the pool entirely, not just ranked last                                                                                                                                                            | A match at guest_price ≤ host_gross is a guaranteed loss.                                                                                                                          |
| 3   | Batched dispatch: offer to the top N=3 ranked candidates simultaneously (**locked, overview D15** — fixed constant, not admin-configurable in v1), first-accept-within-window wins among the batch; if the whole batch times out/declines, dispatch the next batch of 3 | Balances "not annoying/blasting everyone" against match speed — a pure 1-at-a-time waterfall is slower and risks a slow host stalling the whole search.                            |
| 4   | Batch offer window: reuse Phase 1's TTL asymmetry — 15 min if check-in is today (Asia/Manila), 1 hr otherwise, but **per batch**, not per whole search                                                                                                                  | Keeps existing guest-facing countdown UX pattern; total search time scales with number of batches needed.                                                                          |
| 5   | Check-in/check-out conflict check treats same-day back-to-back as a conflict unless separated by a **30 min turnover buffer** (**locked, overview D15** — fixed platform-wide constant, not per-host in v1)                                                             | Prevents accidentally shrinking host inventory availability when it isn't necessary, while still respecting the physical reality that a car needs time to actually leave the spot. |
| 6   | A host with multiple parking spots is only offered once per guest request (their best-fit / cheapest spot), never multiple simultaneous offers for the same request                                                                                                     | Avoids self-competing notifications to the same person.                                                                                                                            |

## Tasks

**Availability / conflict engine**

- [x] Extend the existing date/vehicle-type candidate query with an explicit check-in/check-out overlap check using guest-selected times, not just date boundaries (audit current logic in `_shared/parkingBroadcast.ts` for date-only vs datetime granularity). — **Scope decision (2026-08-26):** the guest form never collected per-booking times (only dates), so this uses each listing's own standard check-in/check-out time (`parkings.settings.checkInTime`/`checkOutTime`, already existed) instead of inventing guest-selected times. Confirmed with the user before implementation.
- [x] Apply the locked 30 min same-day turnover buffer (fixed constant, decision #5) in the conflict filter.
- [x] Dedupe multi-spot hosts to their single best-fit candidate spot per request.
- [x] Apply the guest-rate price cap exclusion (D5 in overview) — stubbed with a hardcoded flat ₱400 default (`STUB_GUEST_PARKING_RATE_WEEKDAY`/`_WEEKEND` in `parkingPricing.ts`) since Phase 3's guest rate config doesn't exist yet; replace when Phase 3 ships.

**Ranking engine v1**

- [x] New helper (mirror `parkingBroadcast.ts` conventions) that sorts conflict-safe candidates ascending by `host_gross` for the specific night(s)/day-type mix of the request. — `parkingBroadcastRanking.ts`, average nightly rate across the stay.
- [x] Tie-break rule for equal-priced hosts — ascending `parkings.created_at` (earliest-listed spot wins), documented in `.cursor/rules/parking-workflow.mdc`.

**Batched dispatch**

- [x] Rework `fanOutParkingBroadcast()` (or a new sibling) to dispatch in ranked batches of N instead of all-at-once `Promise.all`.
- [x] Batch-expiry job (extend `expire-parking-broadcasts` cron) to detect a fully-expired/declined batch and trigger the next batch, or terminal `NO_HOST_AVAILABLE` when candidates are exhausted. — `advanceOrTerminateParkingBatch`, also called from decline-all-in-batch.
- [x] Preserve the existing atomic single-guarded-`UPDATE` claim mechanism for the within-batch race (do not weaken the concurrency guarantee that shipped in Phase 1). — unchanged; batch-advance uses an analogous guard scoped by `parking_broadcast_batch_number`.
- [x] Guest-facing status page: show "searching" progress across batches without exposing ranking internals (no host names/prices until matched). — see Guest search UX below for the full on-demand redesign.

**Guest search UX**

- [x] Redesign the guest-facing search/status flow toward the on-demand ("looking for your parking...") feel the user asked for — live status transitions: searching → offered-to-host(s) → matched → (Phase 3) pending payment. Shipped: pulsing ring around the status icon, a pulsing-dot "Searching for a host nearby" / "Checking more hosts nearby" indicator, and a headline tweak ("Looking for a parking host"), all `motion-reduce`-aware. "Offered-to-host(s)" has no separate visible sub-state by design — ranking internals (which/how many hosts) are never exposed to the guest, so "searching" covers it.
- [x] Countdown/progress indicator per batch, consistent with Phase 1's `aria-live` + reduced-motion patterns. — countdown already reset per batch; added a linear time-remaining bar under it (`transition-[width]` + `motion-reduce:transition-none`) that visibly restarts on each new batch. Current 3-step ring also pulses while searching.

## File map (as-built)

| Path                                                                                                                       | Change                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `supabase/functions/_shared/parkingBroadcast.ts`                                                                           | Turnover-buffer-aware conflict check, `resolveNextParkingBatch`, batch-stamped fan-out                   |
| `supabase/functions/_shared/parkingBroadcastRanking.ts` (new)                                                              | Price ranking, tie-break, guest-rate cap stub, multi-spot host dedupe                                    |
| `supabase/functions/_shared/parkingBroadcastExpireCron.ts`                                                                 | `advanceOrTerminateParkingBatch` (shared batch-resolution brain) + batch-scoped TTL sweep                |
| `supabase/functions/_shared/parkingBroadcastActions.ts`                                                                    | Decline scoped to current batch, delegates to `advanceOrTerminateParkingBatch`                           |
| `supabase/functions/_shared/parkingPricing.ts`                                                                             | `STUB_GUEST_PARKING_RATE_WEEKDAY`/`_WEEKEND` interim cap constants                                       |
| `supabase/functions/submit-parking-booking-request/index.ts`                                                               | First batch via `resolveNextParkingBatch`, `parking_pinned_id` on insert                                 |
| `supabase/functions/get-parking-booking-status/index.ts`                                                                   | `batchNumber` in the guest status response                                                               |
| `supabase/migrations/20261115120600_parking_broadcast_batching.sql`                                                        | `batch_number`, `host_gross_at_broadcast` on broadcasts; `parking_broadcast_batch_number` on submissions |
| `supabase/migrations/20261115120700_parking_broadcast_pinned_id.sql`                                                       | `parking_pinned_id` on `guest_submissions` (pinned requests stay single-round)                           |
| `ui/src/features/guest/marketing/parkings/hooks/useParkingBookingStatus.ts`, `.../components/ParkingRequestStatusView.tsx` | `batchNumber` plumbed through; minimal "still looking" line (fuller redesign still open)                 |
| `.cursor/rules/parking-workflow.mdc`                                                                                       | Extended canonical spec with ranked batched dispatch section                                             |
| `docs/guides/routes/parkings.md`, `docs/guides/routes/org/parking/bookings.md`                                             | Batching behavior + updated host-facing Q&A                                                              |

## Edge cases

See overview's "Matching (Phase 2)" section — overlap-boundary conflicts, all-hosts-priced-above-cap, multi-spot dedupe, partial-batch-response races.

## Exit criteria

- Two-org seed test still passes (org isolation unchanged from Phase 1).
- Simulated 5-host pool, varying prices: confirm top-3 cheapest get the first batch, 4th/5th get a later batch only if needed.
- Claim race within a batch still resolves to exactly one 200 / rest 409, same guarantee as Phase 1.
- Same-day turnover buffer correctly allows/blocks back-to-back bookings per the configured value.
- Mobile 375px walkthrough of the redesigned search/status UX.
