---
stage: planned
title: 'Parking E2E — Production Readiness (Open Questions, Gaps, Remaining Work)'
status: tracking
tags: [planning, planned-modules, parking, payments, production-readiness]
updated: 2026-08-30
---

# Parking E2E — Production Readiness

Not a phase to implement — a consolidated checklist of everything that stands between the current parking marketplace build and real users transacting real money on it. Cross-references the phase docs; **the phase docs remain the source of truth for implementation detail, this doc is the "can we launch yet" view.**

Source docs: [`parking-e2e-later-phases.md`](./parking-e2e-later-phases.md) (overview + locked decisions) · [`../done/parking-e2e-phase1-overview.md`](../done/parking-e2e-phase1-overview.md) · [`../done/parking-e2e-phase2-match-engine.md`](../done/parking-e2e-phase2-match-engine.md) · [`../done/parking-e2e-phase3-payment-pricing.md`](../done/parking-e2e-phase3-payment-pricing.md) · [`../done/parking-e2e-phase4-payout-admin-config.md`](../done/parking-e2e-phase4-payout-admin-config.md) · [`../done/parking-e2e-phase5-endorsement-communication.md`](../done/parking-e2e-phase5-endorsement-communication.md) · [`../done/parking-e2e-phase7-property-booking-migration.md`](../done/parking-e2e-phase7-property-booking-migration.md) · [`./parking-e2e-phase6-ranking-trust-safety.md`](./parking-e2e-phase6-ranking-trust-safety.md) · [`../done/parking-e2e-phase8-direct-booking-link.md`](../done/parking-e2e-phase8-direct-booking-link.md) · [`../in-progress/parking-property-parity.md`](../in-progress/parking-property-parity.md) · [`.cursor/rules/parking-workflow.mdc`](../../../.cursor/rules/parking-workflow.mdc).

## TL;DR status (2026-08-26)

The parking marketplace is **code-complete for a single guest to search, match, pay, get endorsed, chat, self-serve from a property booking, or book directly through a host-shared link** — but it has **never processed a real payment**, has **no automated split payout**, and has **zero test coverage past the original Phase 0/1 broadcast/accept flow**. Do not point real guests/hosts at it for money-moving flows until the items in "Hard blockers" below close.

| Phase                                 | Status                | One-line gap                                                                                                                                                           |
| ------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0/1 — registration, broadcast, accept | ✅ done               | none                                                                                                                                                                   |
| 2 — match engine, price ranking       | ✅ done               | none                                                                                                                                                                   |
| 3 — PayMongo payment                  | 🚧 shipped, held open | never run against real PayMongo keys                                                                                                                                   |
| 4 — payout & admin config             | 🚧 shipped, held open | real split payout blocked on PayMongo Platforms business process                                                                                                       |
| 5 — endorsement & chat                | 🚧 shipped, held open | webhook trigger + mobile pass unverified                                                                                                                               |
| 6 — behavioral ranking & trust/safety | 📋 not started        | non-refundable banner split out & shipped ([#140](https://github.com/sprmke/kame-homes/issues/140)); ranking engine itself needs live Phase 2/5 data first (by design) |
| 7 — property-booking migration        | ✅ done               | none                                                                                                                                                                   |
| 8 — direct-booking link               | 🚧 shipped, held open | mobile pass unverified; real PayMongo unverified (same as 3/5)                                                                                                         |
| Parking↔property parity (org plans)   | ✅ done (2026-09-09)  | `requireOrgFeature`/`useOrgPlan` real org entitlement checks replaced the interim ungate for Telegram + AI assistant                                                   |
| Automated test coverage               | ⚠️ stale              | Playwright suite predates Phases 2–7 entirely                                                                                                                          |

---

## Hard blockers (cannot go live with real money until resolved)

These require **business/compliance action outside this codebase**, not more code:

1. **PayMongo Platforms application never started.** No confirmed exact per-transaction fee schedule, no confirmed ₱75/month-per-sub-account figure, no Platforms access granted. Until this exists, all payout is manual disbursement — workable for a small pilot, not for scale. Owner: whoever manages the PayMongo relationship. See [`phase4`](../done/parking-e2e-phase4-payout-admin-config.md) task 4.0.
2. **No live `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` configured anywhere** (not in `supabase/.env.local`, not in dev/prod secrets). Every payment-link-creation, webhook-fulfillment, and signature-verification code path has only been exercised with simulated payloads against the local DB — **the real PayMongo API call has literally never executed.** This is the single biggest unknown before launch: real API request/response shapes, real webhook signature verification, real error codes (declined card, insufficient funds, expired link) are all unverified assumptions.
3. **Host KYC/onboarding flow for split payout doesn't exist.** Even once Platforms access is granted, there's no UI for a host to submit ID + selfie + business info. Manual disbursement is the only path until this is built (and until #1 above justifies building it).

**Recommended pilot path:** launch with manual PayMongo Payment Links + manual disbursement (already built), a small number of trusted hosts, and close #2 first (get sandbox/live keys into an environment and run one real transaction end-to-end) before opening it up broadly.

---

## Verification gaps (code exists, never proven against the real thing)

| Item                                                                        | Phase | What's missing                                                                                                                              |
| --------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Real PayMongo Payment Link creation                                         | 3     | Needs live/sandbox `PAYMONGO_SECRET_KEY`                                                                                                    |
| Real PayMongo webhook signature verification + delivery                     | 3, 5  | Needs live/sandbox `PAYMONGO_WEBHOOK_SECRET`, and either a real PayMongo test transaction or the PayMongo CLI/dashboard's webhook simulator |
| Endorsement email fires exactly once off a **real** payment-success webhook | 5     | Currently only proven off a simulated webhook payload                                                                                       |
| Mobile (375px) walkthrough of Phase 5's status-page blocks + chat sheet     | 5     | Explicitly unchecked in the phase doc's exit criteria                                                                                       |
| Duplicate webhook delivery idempotency under real PayMongo retry behavior   | 3     | `processed_paymongo_events` dedupe logic only unit-level verified, not against PayMongo's actual retry cadence/payload                      |

---

## Deferred by design (explicit, documented, intentional — not bugs)

Each of these was a conscious scope cut in its phase doc, not an oversight. Listed here so nothing gets silently forgotten before launch sign-off:

- **IP/device-level throttle on public submit** (Phase 3) — **resolved, not needed after all.** The original plan assumed Phase 8's direct link would be a genuinely unauthenticated entry point requiring its own throttle; when Phase 8 was actually built (2026-08-26), guest auth was kept on the submit path (Phase 3's requirement never conflicted with the direct-link ask — see Phase 8 doc decision #4's write-up), so the existing per-account anti-spam already covers it. A per-IP rate limit was added to the read-only `get-public-parking` landing lookup as defense-in-depth against link scraping, which is the actual new surface Phase 8 introduced.
- **Admin manual refund/override path** (Phase 3) — deferred because no real payment has ever succeeded, so there's nothing to refund against yet. **Must exist before real payments flow**, even though the guest-facing policy is "non-refundable" — the platform still needs to fix its own errors (double charge, wrong amount).
- **Real automated split payout via PayMongo Platforms** (Phase 4) — see Hard blocker #1/#3 above.
- **Auto-accept only checked on the initial dispatch batch**, not on re-batches after a decline/timeout (Phase 5) — accepted v1 scope; a host who's on the second or later batch never gets auto-accepted even with the toggle on.
- **Guest↔host chat is scoped to `(parking, guest)`, not per-booking** (Phase 5) — a guest with multiple sequential bookings at the same parking shares one thread across all of them. Accepted v1 limitation.
- **Phase 7's linkability rule has a residual gap**: a property booking sitting at a legacy `PENDING_GAF`/`PENDING_PARKING_REQUEST`/`PENDING_PET_REQUEST` status has no same-status auto-complete edge in either direction — the attempt is caught/logged, not applied. Pre-existing behavior, not a regression, but worth a support-runbook note.
- **Legacy property-booking manual parking path** — **new setups** use the marketplace find flow (`parking-pay-parking-marketplace-connect`). Legacy `/properties/:slug/parking/:bookingId` redirects to `/parkings?linkStay=…`. `submit-pay-parking` / `ParkingRequestForm` remain for historical unlinked rows only; no new host entry points.

---

## Not-yet-started phases

- **Phase 6 — Behavioral ranking & trust/safety.** Needs Phase 2/5 to run in production long enough to accumulate real response-time and incident data before it's meaningful (by design — see Phase 6 doc decision #4's cold-start rationale). Its non-refundable policy banner was split out and shipped separately ([GitHub #140](https://github.com/sprmke/kame-homes/issues/140), 2026-08-26) rather than waiting on the ranking-engine half — see below. What remains is purely the ranking algorithm + transparency explainer, still blocked on live data.

---

## Org-plan / entitlement gap — RESOLVED 2026-09-09

From [`parking-property-parity.md`](../in-progress/parking-property-parity.md): an organization with **parking listings and zero properties** used to have no real entitlement resolution path — `PARKING_INTERIM_UNGATED_FEATURES` in `useFeatureGate.ts` was a stopgap that ungated Telegram notifications and the AI dashboard assistant for parking-only orgs rather than actually checking a subscription (a real revenue leak once parking payments and other tiers matter). Fixed: new `requireOrgFeature(organizationId, feature)` (server, `_shared/planEntitlements.ts`, built on the already-existing `resolveOrgEntitlements`/`getActiveOrgSubscription`) and the client's existing `useOrgPlan`/`deriveOrgEntitlementsFromPlan` path (no property proxy either way) now gate parking's Telegram enable and AI assistant on the org's real plan, same as any org-only page.

---

## Test coverage gap

`docs/guides/testing/parking-playwright.md` (dated 2026-08-20, i.e. **before Phases 2–7 shipped**) only covers: guest submit, host accept/decline/expiry, and a side-by-side demo — all Phase 0/1 broadcast mechanics. **Zero automated coverage exists for:**

- Payment checkout creation, payment TTL expiry/release, guest cancel-during-payment-window (Phase 3)
- Commission/payout ledger, guest-rate cap enforcement (Phase 4)
- Endorsement auto-send, resend/retry, auto-accept toggle, guest↔host chat unlock, contact reveal (Phase 5)
- Property-booking self-serve linking, host-assist share link, auto-complete gate, pre-arrival reminder cron (Phase 7)
- Direct-link token generation, channel resolution/tagging, reduced-commission checkout (Phase 8)

Everything above was verified **manually**, once, by whoever built each phase (documented in each phase doc's "Verification status" section) — none of it is regression-protected. The Phase 7 doc's own "Bug found and fixed during mobile verification" (a Radix `Select` auto-select race) is a concrete example of the kind of bug that only manual verification catches today and a future refactor could silently reintroduce. **Before broad launch, extend the Playwright suite (or at minimum a scripted smoke pass) to cover the payment→endorsement→chat happy path and the cancel/expire/decline unhappy paths.**

---

## Open product questions (need a decision, not more research)

| #   | Question                                                                                                                                                                                                         | Why it matters                                                                                                                                                                                                                                                           | Where it's flagged                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 1   | What's the real PayMongo Platforms fee schedule and per-host eligibility threshold?                                                                                                                              | Determines whether commission economics work at low volume — see Hard blocker #1                                                                                                                                                                                         | Phase 4 task 4.0                   |
| 2   | What's an acceptable pilot scale for manual disbursement before it becomes an operational burden?                                                                                                                | Manual disbursement is the only real payout path at launch                                                                                                                                                                                                               | Phase 4                            |
| 3   | Rolling-window size for response-time ranking (e.g. last 20 matches vs last 90 days) and the cold-start default?                                                                                                 | Needed before Phase 6 can start                                                                                                                                                                                                                                          | Phase 6 decision #3/#4             |
| 4   | Exact tie-break weighting between incident-history and response-speed signals?                                                                                                                                   | Explicitly left TBD in Phase 6's own decision table                                                                                                                                                                                                                      | Phase 6 decision #1                |
| 5   | Sunset date (or explicit "never") for the legacy property-booking manual parking path?                                                                                                                           | **Resolved 2026-08-29** — **new setups** use marketplace only (`parking-pay-parking-marketplace-connect`). Legacy pay-parking URL redirects to `linkStay` / request status. Columns + `submit-pay-parking` retained for historical rows; host entry is **Find parking**. | Phase 7 + pay-parking connect      |
| 6   | ~~Should the Phase 6 non-refundable banner ship on its own, ahead of the ranking-engine half of that phase?~~ **Resolved 2026-08-26 — yes, shipped as [#140](https://github.com/sprmke/kame-homes/issues/140).** | It's guest-facing payment policy copy, arguably a pre-launch requirement independent of ranking maturity                                                                                                                                                                 | This doc, "Not-yet-started phases" |
| 7   | Does a parking-only org (no property) get billed at all before `resolveOrgEntitlements` ships, or do we accept the free ride for the pilot?                                                                      | Direct revenue-leak vs. blocking pilot onboarding                                                                                                                                                                                                                        | `parking-property-parity.md`       |

---

## Pre-launch checklist

Use this as the actual go/no-go gate — check every box before opening parking payments to real hosts/guests beyond an internal pilot:

- [ ] Sandbox `PAYMONGO_SECRET_KEY`/`PAYMONGO_WEBHOOK_SECRET` configured in at least the dev environment; one real end-to-end payment (checkout → webhook → endorsement) completed and verified.
- [ ] Admin manual refund/override path built (currently deferred — see above).
- [x] Non-refundable policy copy shipped at pre-payment/payment-success/status-page — [#140](https://github.com/sprmke/kame-homes/issues/140), 2026-08-26.
- [x] `resolveOrgEntitlements(organizationId)` ships (via `requireOrgFeature`) and `PARKING_INTERIM_UNGATED_FEATURES` is removed — done 2026-09-09.
- [ ] Phase 5's mobile (375px) walkthrough of the status-page blocks + chat sheet completed.
- [ ] At minimum a scripted smoke pass (ideally Playwright) covers payment→endorsement→chat happy path and cancel/expire/decline unhappy paths.
- [x] IP/device throttle on the direct-link landing surface (`get-public-parking`) shipped 2026-08-26; the direct-link submit path itself was kept guest-authenticated (never went unauthenticated), so no separate throttle was needed there.
- [ ] Mobile (375px) pass of the Phase 8 direct-link dashboard card — not yet run.
- [ ] Decide and communicate the manual-disbursement pilot scale limit (open question #2) to whoever is operationally handling payouts.
- [ ] Manual QA checklist from [`parking-property-parity.md`](../in-progress/parking-property-parity.md#verify-in-qa-manual) re-run once org-plan gating changes land.

---

## Explicitly not a blocker

For clarity — these are fine to launch without, they're just not built yet and shouldn't be confused with the items above:

- Phase 6's behavioral ranking algorithm itself (price-only ranking from Phase 2 is a fully functional v1).
- Real PayMongo Platforms split payout (manual disbursement is a legitimate, documented interim path — see Phase 4 decision #1).

Back to [planned index](./README.md).
