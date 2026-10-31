---
title: 'Plans Playwright'
status: active
tags: [guides, testing, playwright, plans]
updated: 2026-09-11
---

# Plans Playwright

Mocked org Plans & Billing checkout and downgrade flows (PayMongo redirect stubbed).

## Specs

| Spec                                                 | Tags  | Covers                                                        |
| ---------------------------------------------------- | ----- | ------------------------------------------------------------- |
| `ui/e2e/features/plans/org/orgPlanCheckout.spec.ts`  | `@ci` | Upgrade review, PayMongo handoff, return URLs, resume payment |
| `ui/e2e/features/plans/org/orgPlanDowngrade.spec.ts` | `@ci` | Paid→paid, paid→Free, past_due/suspended gates                |

## Harness

- `ui/e2e/features/plans/shared/orgPlanHarnessShared.ts` — session, org plan payloads
- `ui/e2e/features/plans/shared/orgPlanCheckoutHarness.ts` — checkout mocks + PayMongo stub
- `ui/e2e/features/plans/shared/orgPlanDowngradeHarness.ts` — downgrade mocks

Setup Guide auto-open is suppressed via dismissed `setupGuide` in org fixtures.

## Run

```bash
bun run test:e2e:plans
bun x playwright test ui/e2e/features/plans --project=chromium-ci
```

## Manual gaps

Real PayMongo settlement and webhook confirmation.
