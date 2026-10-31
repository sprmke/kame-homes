---
stage: planned
title: 'Parking E2E Phase 6 — Behavioral Ranking, Transparency & Trust/Safety'
status: planned
tags: [planning, planned-modules, parking]
updated: 2026-08-26
---

# Phase 6 — Ranking Transparency & Trust/Safety

Part of [Parking E2E Phase 2+ overview](./parking-e2e-later-phases.md). Depends on Phase 2 (price ranking baseline) and Phase 5 (chat/response-time signal source) having run in production long enough to accumulate real data — this phase is explicitly sequenced _after_ the others ship, not bundled into Phase 2.

## Problem

The user wants the full three-tier ranking priority (price → smooth-arrival/incident-free history → response speed) and wants the ranking logic explained to hosts, plus the non-refundable policy surfaced clearly to guests. None of the behavioral signals exist in the schema today — they must be captured first, then ranked on.

## Decisions

| #   | Decision                                                                                                                                                                | Detail                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Ranking priority order: (1) price ascending, (2) incident-free/smooth-arrival history, (3) response speed                                                               | Exact tie-break weighting between (2) and (3) TBD — start with price as the dominant sort key and (2)/(3) as tie-breakers among similarly-priced hosts, not a blended weighted score, to keep the model explainable.                       |
| 2   | "Smooth arrival, no issues" is captured via a post-checkout admin or guest-reported incident flag, not inferred                                                         | No existing signal for this — needs an explicit capture point (e.g., admin marks an issue on a completed booking, or a short guest post-stay prompt).                                                                                      |
| 3   | Response speed = time between offer-notified and accept/decline, aggregated per host over a rolling window                                                              | `notified_at`/`responded_at` already exist per-broadcast (Phase 1 schema) — this is the one signal that can be mined retroactively once enough volume exists.                                                                              |
| 4   | New hosts get a neutral/default score for signals (2) and (3) until they accumulate enough matches (cold-start grace period)                                            | Avoids permanently penalizing new hosts with no history.                                                                                                                                                                                   |
| 5   | Ranking formula is explained to hosts in plain language ("price, then track record, then response speed") — the literal scoring weights are not published               | Prevents gaming while still satisfying the transparency ask.                                                                                                                                                                               |
| 6   | Non-refundable policy is displayed at every guest decision point that involves money: before payment, on the payment confirmation, and on the status page after payment | Explicit intake ask ("strictly non-refundable"). **Split out and shipped 2026-08-26** ([GitHub #140](https://github.com/sprmke/kame-homes/issues/140)) — see below, this did not need to wait for the rest of Phase 6's live ranking data. |

## Tasks

**Signal capture**

- [ ] Incident flag: schema + admin (and/or guest post-stay) capture point for "issue on this booking" (double-parked, no-show, damage, etc.) tied to the host, not just the booking.
- [ ] Response-time aggregation job: rolling-window average response latency per host, computed from existing `notified_at`/`responded_at` (retroactively minable) plus ongoing data.
- [ ] Decide and document the rolling window size (e.g., last 20 matches or last 90 days) and the cold-start default (overview + this doc's decision #4).

**Ranking engine v2**

- [ ] Extend Phase 2's price-only ranking to break ties using incident-free history, then response speed, per decision #1.
- [ ] Cold-start handling: new hosts default to "no negative signal" rather than worst-case, so they aren't buried behind established hosts indefinitely.
- [ ] Anti-gaming check: response-time metric must not reward hosts for declining fast rather than genuinely engaging — confirm the scoring only credits _accepts_, not fast declines (overview edge case).

**Transparency & policy UI**

- [ ] Host-facing "how ranking works" explainer (plain-language priority order, no exact formula) — likely on the parking pricing or dashboard page.
- [x] ~~Guest-facing non-refundable banner/copy at: pre-payment confirmation, payment success, and ongoing status page.~~ **Shipped 2026-08-26, split from this phase** ([#140](https://github.com/sprmke/kame-homes/issues/140)) — `ParkingRequestStatusView.tsx`'s single status component covers all three touchpoints in practice: the banner shows right above **Pay Now** while `status === 'PENDING_PAYMENT'` (pre-payment), and persistently whenever the booking is paid (`PENDING_REVIEW`/`READY_FOR_CHECKIN`/`COMPLETED`) — since this app has no separate "payment confirmation" page (PayMongo redirects back to this same status view), that one persistent condition satisfies both the "payment confirmation" and "status page after payment" touchpoints. Verified in-browser at desktop and 375px mobile, both states.

## File map (propose — ground-truth during `/superpowers-plan`)

| Path                                                                                             | Change                                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `supabase/migrations/<ts>_parking_host_incident_flags.sql`                                       | Incident capture table                           |
| `supabase/migrations/<ts>_parking_host_response_metrics.sql`                                     | Aggregated response-time table/materialized view |
| `supabase/functions/_shared/parkingBroadcast.ts` (Phase 2's ranking helper)                      | Extend with tie-break signals                    |
| `supabase/functions/compute-parking-host-metrics/index.ts` (cron)                                | New — periodic aggregation job                   |
| `ui/src/features/dashboard/parking/pages/ParkingPricingPage.tsx` (or a new ranking-info surface) | "How ranking works" explainer                    |
| `ui/src/features/guest/marketing/parkings/pages/ParkingRequestStatusPage.tsx`                    | Non-refundable messaging                         |

## Edge cases

See overview's "Trust & safety / ranking (Phase 6)" section — cold start, metric gaming via fast declines, formula opacity vs transparency balance.

## Exit criteria

- Retroactive response-time aggregation runs correctly against existing Phase 1/2 broadcast data without requiring new data first.
- New host (zero history) ranks correctly relative to established hosts under the cold-start rule, verified with a seed test.
- [x] Non-refundable copy appears at all three specified guest touchpoints — shipped 2026-08-26, see above.
- Host-facing ranking explainer renders without exposing exact weights/formula.
