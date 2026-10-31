---
title: 'Parking Playwright'
status: active
tags: [guides, testing, parking, playwright]
updated: 2026-08-30
---

# Parking Playwright

Feature-scoped Playwright coverage for the standalone parking marketplace flow (Phases 1–8) plus legacy property pay-parking redirects and property-booking linked parking / Find parking (`linkStay`). The suite is organized to mirror the app's parking domains instead of keeping all E2E files in one flat folder.

## Scope

| Spec                                            | What it covers                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `guest/parkingGuestRequest.spec.ts`             | Guest submit → waiting screen; mocked payment after accept                                       |
| `guest/parkingMarketplaceEdgeCases.spec.ts`     | `no_parking_available`; stay picker + **`linkStay` auto-select**                                 |
| `guest/guestFormParkingCta.spec.ts`             | Guest form success → **Need parking?** CTA links to `/parkings`                                  |
| `host/parkingHostClaim.spec.ts`                 | Host accept → **Awaiting Payment** (Phase 3)                                                     |
| `host/parkingHostNewBooking.spec.ts`            | Host **New booking** modal on parking dashboard                                                  |
| `flows/parkingGuestHostOutcomes.spec.ts`        | Expire, decline, cancel while searching                                                          |
| `flows/parkingGuestHostSideBySide.spec.ts`      | **Two-window demo** — full happy path, decline, cancel after accept, direct link                 |
| `legacy/payParkingFlow.spec.ts`                 | Legacy `/properties/:slug/parking/:bookingId` **redirects** to find/`linkStay` or request status |
| `property/propertyBookingLinkedParking.spec.ts` | Parking panel match + host **Find parking** popup (`linkStay` or linked request)                 |
| `live/parkingGuestHostLocal.spec.ts`            | Local Supabase accept path (requires `./dev.sh`)                                                 |
| `shared/parkingFlowHarness.ts`                  | Shared mocks + helpers                                                                           |
| `shared/payParkingFlowHarness.ts`               | Legacy pay-parking redirect mocks                                                                |
| `shared/propertyBookingParkingHarness.ts`       | Property booking + linked parking + owner-default mocks                                          |
| `shared/parkingLiveLocalHarness.ts`             | Local stack helpers                                                                              |
| `shared/parkingSideBySideHelpers.ts`            | Side-by-side browser launch + demo pacing                                                        |

## Coverage matrix

| Scenario                                                     | Spec                                      | Notes                                                          |
| ------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------- |
| Marketplace submit → host accept → guest pay → complete      | Side-by-side + `parkingGuestRequest`      | Payment mocked via `create-parking-payment-checkout`           |
| Host decline / request expire / guest cancel while searching | `parkingGuestHostOutcomes` + side-by-side |                                                                |
| Cancel after host accept (awaiting payment)                  | Side-by-side                              |                                                                |
| Direct booking link (`?dl=`)                                 | Side-by-side                              | Host pricing card + guest form                                 |
| `no_parking_available` on submit                             | `parkingMarketplaceEdgeCases`             |                                                                |
| Link marketplace request to property stay                    | `parkingMarketplaceEdgeCases`             | Manual stay picker                                             |
| Host-shared `linkStay` auto-selects stay                     | `parkingMarketplaceEdgeCases`             | Confirm step without tapping stay card                         |
| Guest form success → find parking CTA                        | `guestFormParkingCta`                     | Post-submit when `needParking: true`                           |
| Legacy pay-parking → marketplace find / linked request       | `payParkingFlow`                          | Redirect-only; vehicle form retired                            |
| Property booking linked parking panel                        | `propertyBookingLinkedParking`            | Host sees match status + host contact, not legacy owner fields |
| Host **Find parking** → `linkStay` / linked request popup    | `propertyBookingLinkedParking`            | Unlinked vs already matched                                    |
| Host new parking booking modal                               | `parkingHostNewBooking`                   |                                                                |
| Real local Supabase submit + accept                          | `parkingGuestHostLocal`                   | No guest auth / no PayMongo yet                                |

### Intentional gaps (not automated)

- Real PayMongo Payment Link + webhook settlement
- Payment window expiry / resume-search UX
- Endorsement resend button
- IP/device anti-spam, super-admin payout ledger
- Guest chat sheet open assertion (mock exists; not asserted in chromium-only specs)
- Seeded guest account on local live stack (use mocked suite for full guest flows)

## Runner setup

- Repo config: `playwright.config.ts`
- Root scripts:
  - `bun run test:e2e:parking` — mocked chromium suite (excludes live local)
  - `bun run test:e2e:parking:headed`
  - `bun run test:e2e:parking:side-by-side` — **two headed windows** (guest + host)
  - `bun run test:e2e:parking:side-by-side:slow`
  - `bun run test:e2e:parking:side-by-side:video` / `:slow:video`
  - `bun run test:e2e:parking:free-workflow` / `:headed` / `:slow` / `:slow:video` — Free-tier manual Automation Triggers
  - `bun run test:e2e:parking:local` — real local Supabase (`PLAYWRIGHT_LOCAL_LIVE=1`)
  - `bun run test:e2e:parking:screens` / `:screens:local`
- Browser install: `npx playwright install chromium`

The config boots the Vite app automatically on `http://127.0.0.1:4173` and keeps Playwright artifacts under `test-results/playwright/`.

## Mocked auth (dev-only)

Parking dashboard routes normally require a real Supabase host session. For Playwright-only local runs, the UI accepts dev-only localStorage session payloads:

| Role               | Storage key              | Read by                                                                                                            |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Host / admin       | `kame:e2e-admin-session` | `useAdminSession`, `edgeClient`, parking bookings fetches                                                          |
| Host Supabase auth | `sb-127-auth-token`      | `fetchPropertyEntitlements`, `fetchBookingAiReview`, other `supabase.auth.getSession()` callers on property routes |
| Guest              | `kame:e2e-guest-session` | `useGuestSession`, guest edge calls (`submit-parking-booking-request`, pay-now, cancel)                            |

Both E2E keys are enabled only when the Vite app runs in dev mode (`ui/src/lib/e2e/adminSession.ts`, `ui/src/lib/e2e/guestSession.ts`).

## Side-by-side demo

`bun run test:e2e:parking:side-by-side` launches two headed Chromium windows:

1. **Guest** — registration form (3-step), request status, Pay Now, confirmation
2. **Host** — parking bookings list/detail, accept, awaiting payment, mark active, complete

Both windows share the same mocked parking-request state, so host actions update the guest status view in the same run.

### Scenarios (side-by-side file)

| Test                | Flow                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Full marketplace    | Submit → host accept → guest pay → endorsement/contact/chat → host mark active → complete |
| Host decline        | Guest waiting → host decline → guest no-host                                              |
| Cancel after accept | Guest awaiting payment → cancel request                                                   |
| Direct link         | Host pricing card + guest submit via `?dl=` token                                         |

### Slow / demo pacing

```bash
bun run test:e2e:parking:side-by-side:slow
bun run test:e2e:parking:free-workflow:slow
```

`PLAYWRIGHT_SLOW_MO` is applied in `playwright.config.ts` for normal chromium runs (Free workflow, etc.). `slowMo` only delays Playwright _actions_ — navigations, expects, and newly opened tabs stay instant unless `PLAYWRIGHT_DEMO_PAUSE_MS` holds the screen. Free-workflow `:slow` uses both, and pauses on popup windows (`Find parking`, etc.).

Presets:

| Script                                | `PLAYWRIGHT_SLOW_MO` | `PLAYWRIGHT_DEMO_PAUSE_MS` |
| ------------------------------------- | -------------------- | -------------------------- |
| `test:e2e:parking:side-by-side:slow`  | `600`                | `2000`                     |
| `test:e2e:parking:free-workflow:slow` | `1200`               | `3000`                     |

Even slower (manual tuning):

```bash
PLAYWRIGHT_SLOW_MO=1000 PLAYWRIGHT_DEMO_PAUSE_MS=3000 bun run test:e2e:parking:side-by-side
PLAYWRIGHT_SLOW_MO=2000 PLAYWRIGHT_DEMO_PAUSE_MS=5000 bun run test:e2e:parking:free-workflow:headed
```

Record video (saved under `test-results/playwright/` — there is no `--video=on` CLI flag):

```bash
bun run test:e2e:parking:side-by-side:video
bun run test:e2e:parking:side-by-side:slow:video
```

Step through interactively:

```bash
PLAYWRIGHT_INSPECT=1 bun run test:e2e:parking:side-by-side
```

## Mocked API coverage (harness)

`installParkingFlowMocks` intercepts:

- **Phase 1:** submit, status poll, claim, decline, broadcast status, list-bookings, transition
- **Phase 3:** `create-parking-payment-checkout` (simulates PayMongo redirect back to status page), `cancel-parking-booking`
- **Phase 5:** endorsement fields on status payload, `request-parking-endorsement`, guest web chat resume/start/messages
- **Phase 7:** `list-linkable-property-bookings`, `get-linked-parking-booking`
- **Phase 8:** `parking-pricing` (direct link token), `directLinkToken` on submit
- **Property admin shell:** `list-organizations`, `list-properties`, `property-access`, `property-entitlements`, `get-booking-ai-review`, `get-booking-ai-assistant-audit`, `notifications-list`, `guest_submissions` REST

Claim sets **`PENDING_PAYMENT`** (not `PENDING_REVIEW`). Payment mock flips to **`PENDING_REVIEW`** with endorsement sent + host contact reveal.

## Local Supabase-backed flow

`bun run test:e2e:parking:local` runs against the live local stack:

- Requires `./dev.sh` (or equivalent local Supabase + UI)
- Seeded parking org `kame-homes`, slug `monaco-level-2-slot-27`
- Host: `sprmke.dev@gmail.com` via local Supabase Auth
- Cleans up generated booking rows by guest email before/after

**Note:** the local layer currently covers submit + host accept → guest **awaiting payment**. Real PayMongo checkout is not exercised (same production-readiness gap as manual QA).

## Screen captures

```bash
bun run test:e2e:parking:screens
```

Writes PNGs to `ui/screen-tmp/parking-e2e/` (gitignored). Helper: `shared/parkingScreenCapture.ts`.

## Current limitations

- Real PayMongo Payment Link / webhook is not verified in any automated layer (mock checkout only).
- Local live layer does not sign in a guest account yet — guest form requires auth; use mocked suite for full guest flows until a seeded guest test user is wired.
- Side-by-side flow is Chromium-specific (explicit window size/position).
- IP/device anti-spam and super-admin payout ledger are not covered.
