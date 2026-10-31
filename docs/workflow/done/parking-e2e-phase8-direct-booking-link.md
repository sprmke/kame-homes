---
stage: done
title: 'Parking E2E Phase 8 — Shareable Direct-Booking Parking Link'
status: done
tags: [planning, planned-modules, parking]
updated: 2026-08-30
---

# Phase 8 — Direct-Booking Link

Part of [Parking E2E Phase 2+ overview](../planned/parking-e2e-later-phases.md). Intake item #3. Depends on Phases 3, 4, 5 (payment, payout, endorsement automation) — this phase adds a new entry point into the already-built engine, it does not add new matching/payment/payout mechanics.

## Problem

A parking host wants a copyable link they can share directly (outside of any property-booking context) so a guest can book their parking straight from the dashboard-generated link. Same engine, same payment/endorsement flow as Phases 3–5, but at a reduced platform commission since the host sourced the lead themselves.

## Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                               | Detail                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Commission for direct-booking-link bookings = half the standard rate (5% default if standard is 10%), independently configurable from the standard rate                                                                                                                                                                                                                                                                                | Explicit intake ask — reward the host for self-sourcing, not a property-booking-driven lead.                                 |
| 2   | The link is per-listing, copyable from the parking dashboard                                                                                                                                                                                                                                                                                                                                                                           | Matches "shareable parking registration link from host."                                                                     |
| 3   | The flow through the link is otherwise identical to the standard engine — same PayMongo payment, same auto-endorsement, same chat unlock                                                                                                                                                                                                                                                                                               | No parallel booking logic — this is purely a new entry point + a different commission rate tag on the resulting transaction. |
| 4   | **Reconciled during implementation (2026-08-26) — see write-up below.** Originally specced as "no guest portal login required." Actual: the link still requires the same guest sign-in the rest of the marketplace already requires (shipped by Phase 3, after this decision was first written) — an unguessable per-listing token, verified server-side at submit time, is what tags the reduced commission, not the absence of auth. | The abuse surface this decision was written to cover no longer exists in the form assumed — see write-up.                    |
| 5   | The reduced commission is documented on the host parking dashboard (explicit intake ask) so hosts understand why direct bookings net them more                                                                                                                                                                                                                                                                                         | Transparency for hosts.                                                                                                      |

### Decision #4 write-up — why "unauthenticated" was reconciled, not built literally

This phase doc predates Phase 3 shipping (both are dated 2026-08-26, but Phase 3's guest-auth requirement on `submit-parking-booking-request` landed after this decision was first drafted, per the later-phases overview's own dependency ordering — Phase 8 depends on Phase 3). At the time this decision was written, the standard marketplace submit path really was unauthenticated, so a direct link would have introduced a _new_ unauthenticated write surface needing its own defense. By the time Phase 8 was actually implemented, Phase 3 had already made **every** parking submission — standard or direct — guest-authenticated (ownership binding for pay-now/cancel, plus the existing per-account anti-spam in `parkingAntiSpam.ts`). Building Phase 8 as a genuinely anonymous entry point would have meant carving out a _weaker_ auth exception specifically for this one path, which contradicts the reason Phase 3 added guest auth in the first place (ownership + anti-spam), for no real product benefit — nothing in the intake ask actually requires skipping sign-in, only that the host didn't have to do a `PayParkingForm`-style manual submission.

What "direct" actually means here, and what still needed building: the guest still signs in (same as any other parking booking), but arrives at the exact same `/parkings/:slug/form` route used by search results, carrying a `?dl=<token>` marker instead of coming from a search/match result. The token is unguessable (two concatenated UUIDs, ~128 bits of entropy) and generated per-listing on first request from the dashboard — matching it against the pinned parking at submit time is what tags the booking `direct_link` instead of `standard`, which is what actually determines the commission rate. A guest or host cannot game the discount by appending a random query string; verification happens server-side against the stored token, not by trusting a client-supplied flag.

**Anti-spam scope, correspondingly narrower than originally specced:** since guest auth is unconditionally required, the existing per-account limits (`assertParkingSubmitAllowed` — max 3 concurrent pending, 24h cooldown after 3 cancellations) already apply to every direct-link submission exactly as they do to every other submission. The one genuinely new public surface introduced by this phase is the **read-only** `get-public-parking` landing lookup (reused, not new — it already served normal listing pages) — added a per-IP rate limit there (`checkIpRateLimit`, 60 req/60s, same shape as `search-suggestions`) as defense-in-depth against scraping/enumeration, since a direct link is more likely to be shared/scraped than an organic search result. No IP throttle was added to the authenticated submit endpoint itself — that would risk penalizing legitimate guests behind a shared IP (hotel/condo wifi) for a surface that already has an account-level gate.

## Tasks

**Link generation & host dashboard** — done

- [x] Per-listing shareable link, generated and copyable from the parking dashboard. — `parkingDirectLink.ts#ensureParkingDirectBookingToken` (lazy read-or-create, same token-generation pattern as `parkingTeamService.ts`'s existing invite tokens), surfaced through `parking-pricing` GET (`directBookingToken`/`directBookingSlug`) and copied client-side as `${origin}/parkings/:slug/form?dl=<token>` — no new route, reuses the existing guest form page.
- [x] Host-facing documentation/copy on the dashboard explaining the reduced commission (decision #5). — new `ParkingDirectLinkCard.tsx` on `ParkingPricingPage.tsx`, states both rates plainly ("pay X% instead of the standard Y%").

**Booking flow via the link** — done, reusing the existing pinned-listing path rather than a new landing page

- [x] ~~Public landing page~~ — not built as a separate page. `/parkings/:slug/form` already supports a pinned single-listing submission (Phase 2's `pinnedParkingId`, no ranking/matching, single-round) — the `?dl=` token rides along on that same existing route/flow instead of duplicating it. Conflict-check (availability) is unchanged, already enforced by the existing pinned-submit path.
- [x] Reuse Phase 3's payment flow, tagging the resulting transaction with the reduced commission rate. — `parkingPaymentOrchestrator.ts#computeParkingPaymentAmounts` now takes a `bookingChannel` param and selects `platformSettings.directCommissionPct` vs `commissionPct` accordingly; the resolved channel is snapshotted onto both `guest_submissions.parking_booking_channel` (set once, at submit time) and `parking_payment_transactions.booking_channel` (audit trail, same discipline as the existing `commission_pct` snapshot).
- [x] Reuse Phase 5's endorsement automation and chat unlock unchanged. — no changes needed; both key off payment success / `endorsement_sent_at`, neither of which is channel-aware.

**Anti-spam** — done, narrower than originally specced (see decision #4 write-up)

- [x] Per-IP rate limit on `get-public-parking` (the direct link's landing/resolution surface) — `checkIpRateLimit('get-public-parking', ip, 60, 60_000)`, mirrors `search-suggestions`.
- [x] Existing per-account guest submit anti-spam (`assertParkingSubmitAllowed`) already covers the direct-link submit path unconditionally, since guest auth was never actually removed from it (see decision #4 write-up) — no new code needed here, verified by testing both channels through the same endpoint.

**Super-admin config** — done

- [x] `platform_parking_settings.direct_commission_pct` (default 0.05, independently configurable from `commission_pct`), GET/PUT on the existing `platform-parking-settings` endpoint, new input on `SuperAdminParkingPayoutsPage.tsx`. Payout ledger rows show a "Direct link" tag when `booking_channel = 'direct_link'`.

## File map (as-built)

| Path                                                                                       | Change                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261202120000_parking_direct_booking_link.sql`                       | `parkings.direct_booking_token`, `platform_parking_settings.direct_commission_pct`, `guest_submissions.parking_booking_channel`, `parking_payment_transactions.booking_channel` |
| `supabase/functions/_shared/parkingDirectLink.ts`                                          | New — token generation/lookup, channel resolution                                                                                                                               |
| `supabase/functions/_shared/parkingPlatformSettings.ts`                                    | `directCommissionPct` added to the resolver                                                                                                                                     |
| `supabase/functions/platform-parking-settings/index.ts`                                    | `directCommissionPct` GET/PUT                                                                                                                                                   |
| `supabase/functions/_shared/parkingPricing.ts`                                             | `directCommissionPct`/`directBookingToken`/`directBookingSlug` added to the host-facing DTO                                                                                     |
| `supabase/functions/submit-parking-booking-request/index.ts`                               | Accepts `directLinkToken`, resolves + persists `parking_booking_channel`                                                                                                        |
| `supabase/functions/_shared/parkingPaymentOrchestrator.ts`                                 | `computeParkingPaymentAmounts`/`createParkingPaymentTransaction` channel-aware commission + snapshot                                                                            |
| `supabase/functions/get-public-parking/index.ts`                                           | Per-IP rate limit added                                                                                                                                                         |
| `supabase/functions/parking-payouts/index.ts`                                              | `bookingChannel` added to the serialized ledger row                                                                                                                             |
| `ui/src/features/guest/marketing/parkings/hooks/useSubmitParkingBookingRequest.ts`         | `directLinkToken` added to the submit payload                                                                                                                                   |
| `ui/src/features/guest/marketing/pages/ParkingFormPage.tsx`                                | Reads `?dl=` and threads it through to submit                                                                                                                                   |
| `ui/src/features/dashboard/parking/lib/parkingPricingApi.ts`, `parkingPricingDefaults.ts`  | DTO + stub constants for the new fields                                                                                                                                         |
| `ui/src/features/dashboard/parking/components/ParkingDirectLinkCard.tsx`                   | New — copyable link + reduced-commission copy                                                                                                                                   |
| `ui/src/features/dashboard/parking/pages/ParkingPricingPage.tsx`                           | Wires the new card into the sidebar                                                                                                                                             |
| `ui/src/features/dashboard/super-admin/hooks/usePlatformParkingSettings.ts`                | `directCommissionPct`/`bookingChannel` added to types                                                                                                                           |
| `ui/src/features/dashboard/super-admin/pages/SuperAdminParkingPayoutsPage.tsx`             | New commission input + "Direct link" ledger tag                                                                                                                                 |
| `docs/PROJECT.md`, `.cursor/rules/parking-workflow.mdc`                                    | Extended with the Phase 8 summary/section                                                                                                                                       |
| `docs/guides/routes/org/parking/pricing.md`, `docs/guides/routes/admin/parking-payouts.md` | Updated for the new card/field                                                                                                                                                  |

## Edge cases

See overview's "Migration (Phase 7) / Direct link (Phase 8)" section.

- Guest follows the link for a listing that's gone inactive/fully booked — covered by the existing pinned-submit path's own "no candidates" handling (`no_parking_available`), unchanged by this phase.
- Host shares the link for a specific date-range expectation but the link is date-agnostic — unchanged from the existing guest form, guest still picks dates there; not a new gap introduced by this phase.
- Guest/host tries to game the discount by guessing or reusing another listing's token — verified: a fabricated token silently falls back to `standard` (no error, no discount), never trusted client-side.
- Public token/link scraping — covered by the `get-public-parking` per-IP rate limit; the token itself carries no PII and reveals nothing beyond what the listing's normal public page already shows.

## Verification status (2026-08-26)

Static checks (`lint`, `type-check`, `build`) clean.

Functional verification against the real local stack (real guest/host Supabase Auth sessions via OTP, real edge function calls, real Postgres — not mocked):

- **Token generation** — called `parking-pricing` GET as the real seed host (`perezarianna0410@gmail.com`) for a real seed parking; `directBookingToken`/`directBookingSlug`/`directCommissionPct: 0.05` returned correctly, and the token was confirmed persisted on `parkings.direct_booking_token` via direct DB read. A second GET returned the identical token (idempotent, not regenerated).
- **Direct-link submit** — real guest session submitted `submit-parking-booking-request` with the real token; `guest_submissions.parking_booking_channel` correctly recorded `direct_link`.
- **Commission selection (direct)** — `create-parking-payment-checkout` for that booking produced a `parking_payment_transactions` row with `commission_pct: 0.05`, `host_net_total: 285` (on a ₱300 host gross rate — 300 − 15 = 285, arithmetic verified), `booking_channel: direct_link`. The PayMongo Payment Link API call itself failed as expected (no `PAYMONGO_SECRET_KEY` configured locally — same documented limitation as Phases 3/5), but the transaction row and its snapshotted commission fields are written before that call is attempted.
- **Commission selection (standard control)** — the same guest, same listing, no token: `parking_booking_channel: standard`, resulting transaction `commission_pct: 0.10`, `host_net_total: 270` — confirms the two paths are genuinely differentiated, not just always-discounted.
- **Anti-gaming** — submitted with a fabricated token (`"totally-made-up-guessed-token-1234"`); booking succeeded normally but was correctly tagged `standard`, not `direct_link` — confirms the discount cannot be self-granted client-side.
- **Rate limit** — `get-public-parking` still returns 200 for normal single requests after adding the throttle (not verified past the 60-req/60s threshold — a full burst test was not run, low risk given it mirrors an already-shipped, unmodified pattern).
- Test data (3 guest_submissions rows, 2 payment_transactions rows, 1 throwaway auth user) created during verification was deleted afterward.
- **Not verified**: real PayMongo Payment Link creation/webhook for a direct-link transaction (same blanket limitation as every other parking payment phase — no live/sandbox PayMongo keys configured anywhere yet, see [`parking-e2e-production-readiness.md`](../in-progress/production-readiness/audits/parking-e2e-production-readiness.md)); mobile (375px) pass of the new `ParkingDirectLinkCard`.

## Exit criteria

- [x] A test booking via the direct link computes payment at the reduced (5%) commission rate, verified on the transaction row — PayMongo checkout creation itself not verified (no local keys, documented limitation).
- [x] The same listing, submitted without the token, computes the standard (10%) rate — confirms the two paths are correctly differentiated.
- [x] The public landing/resolution surface (`get-public-parking`) is covered by a per-IP rate limit; the authenticated submit path is covered by the pre-existing per-account anti-spam (decision #4 — scope reconciled from "unauthenticated" to "already-authenticated, already-covered").
- [x] Host dashboard clearly documents the commission difference (`ParkingDirectLinkCard.tsx`).
- [ ] Mobile (375px) pass of the new dashboard card — not yet run.

Back to [done index](./README.md) · overview: [`../planned/parking-e2e-later-phases.md`](../planned/parking-e2e-later-phases.md).
