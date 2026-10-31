---
title: 'Booking workflow Playwright'
status: active
tags: [guides, testing, playwright, bookings]
updated: 2026-09-10
---

# Booking workflow Playwright

Mocked E2E for host booking detail and guest form entry.

## Specs

| Spec                                                      | Tags           | Covers                                    |
| --------------------------------------------------------- | -------------- | ----------------------------------------- |
| `ui/e2e/features/bookings/propertyBookingProceed.spec.ts` | `@smoke` `@ci` | Host Proceed `PENDING_REVIEW` → documents |
| `ui/e2e/features/guest-form/guestFormLoad.spec.ts`        | `@smoke`       | Guest-authed form step 1 loads            |
| `ui/e2e/features/guest-form/guestFormSubmit.spec.ts`      | `@smoke` `@ci` | Guest submit mocked → success             |
| `ui/e2e/features/guest-form/guestCalendarSmoke.spec.ts`   | `@ci`          | Calendar + booked dates mock              |
| `ui/e2e/features/guest-form/sdFormSubmit.spec.ts`         | `@ci`          | SD refund form load                       |
| `ui/e2e/features/guest-form/stayGuideToken.spec.ts`       | `@ci`          | Stay guide token happy + 404              |

## Harness

- Host booking mocks: `ui/e2e/features/parking/shared/propertyBookingParkingHarness.ts`
- Guest form mocks: `ui/e2e/features/guest-form/shared/guestFormHarness.ts` (requires `seedSupabaseAuthSession(page, 'guest')`)
- Shared intercept: `ui/e2e/shared/interceptEdge.ts`

## Run

```bash
bun run test:e2e:smoke
bun x playwright test ui/e2e/features/bookings --project=chromium-ci
```

## Manual gaps

Real workflow emails, Resend inbound GAF approval, and calendar/sheet side effects stay manual. See booking-workflow rule § side effects.
