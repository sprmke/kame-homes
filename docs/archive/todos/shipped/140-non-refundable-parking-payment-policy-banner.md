# [3.5] Non-refundable parking payment policy banner

|             |                                                         |
| ----------- | ------------------------------------------------------- |
| **GitHub**  | [#140](https://github.com/sprmke/kame-homes/issues/140) |
| **Shipped** | 2026-08-26                                              |
| **Labels**  | priority:p1, type:feature                               |

## Description

Guest-facing non-refundable messaging at every point in the parking booking flow that involves money: before payment (checkout confirmation), on payment success, and persistently on the ongoing status page (`/parkings/requests/:bookingId`). Split out of Phase 6 (`docs/workflow/planned/parking-e2e-phase6-ranking-trust-safety.md` decision #6) — this is guest-facing policy copy, not the ranking-engine half of that phase, so it doesn't need to wait for live ranking data. Flagged as a pre-launch gap in `docs/workflow/planned/parking-e2e-production-readiness.md` — right now a guest can pay for parking with no on-screen notice that it's non-refundable.

## Shipped notes

Guest-facing non-refundable notice on the parking status page (ParkingRequestStatusView.tsx): shown above the Pay Now button (PENDING_PAYMENT) and persistently on every paid status (PENDING_REVIEW/READY_FOR_CHECKIN/COMPLETED). One component, two mount points — covers pre-payment, payment-confirmation, and ongoing-status-page per the original ask, since this app has no separate payment-confirmation page. Split out of the planned Phase 6 trust/safety doc (decision #6), which stays open for the ranking-engine half only. Verified in-browser (desktop + 375px mobile) against real local Supabase data. Files: ui/src/features/guest/marketing/parkings/components/ParkingRequestStatusView.tsx.
