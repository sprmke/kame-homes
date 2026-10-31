---
title: 'Guest account Playwright'
status: active
tags: [guides, testing, playwright, account]
updated: 2026-09-11
---

# Guest account Playwright

Mocked guest-auth session for profile, stays, favorites, and vouchers.

## Specs

| Spec                                                   | Tags           | Covers                        |
| ------------------------------------------------------ | -------------- | ----------------------------- |
| `ui/e2e/features/account/accountSmoke.spec.ts`         | `@ci`          | Profile form, stays empty hub |
| `ui/e2e/features/account/favoritesSmoke.spec.ts`       | `@ci`          | Favorites list + empty state  |
| `ui/e2e/features/vouchers/guest/voucherWallet.spec.ts` | `@smoke` `@ci` | Voucher wallet                |

## Harness

- `ui/e2e/features/account/shared/guestFavoritesHarness.ts` — `seedSupabaseAuthSession`, `guest-profile`, `guest-messages`, saved properties REST mock

## Run

```bash
bun x playwright test ui/e2e/features/account ui/e2e/features/vouchers/guest --project=chromium-ci
```

## Manual gaps

Live guest chat threads and OAuth sign-in.
