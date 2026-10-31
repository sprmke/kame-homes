---
title: 'Dashboard modules Playwright'
status: active
tags: [guides, testing, playwright, dashboard]
updated: 2026-09-11
---

# Dashboard modules Playwright

Mocked property dashboard shell loads (finance, pricing, maintenance, settings, notifications, templates, team, public pages, activity).

## Specs

| Spec                                                      | Tags           | Covers                              |
| --------------------------------------------------------- | -------------- | ----------------------------------- |
| `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` | `@ci`          | Property module shells listed above |
| `ui/e2e/features/bookings/propertyBookingProceed.spec.ts` | `@smoke` `@ci` | Booking detail + Proceed workflow   |
| `ui/e2e/features/marketing/marketingStudioSmoke.spec.ts`  | `@ci`          | Marketing studio tabs               |
| `ui/e2e/features/inbox/inboxThreadListSmoke.spec.ts`      | `@ci`          | Inbox thread list                   |

## Harness

- `ui/e2e/features/team/shared/propertyTeamRbacHarness.ts` — host session + edge mocks (`installPropertyTeamRbacMocks`)

## Run

```bash
bun x playwright test ui/e2e/features/dashboard --project=chromium-ci
```

## Manual gaps

OTP-gated payment fields, Meta channel connect, Polotno canvas, and custom-pages editor save: see [`custom-pages-module-manual.md`](./custom-pages-module-manual.md) and route guides.
