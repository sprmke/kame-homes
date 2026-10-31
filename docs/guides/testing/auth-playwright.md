---
title: 'Auth Playwright'
status: active
tags: [guides, testing, playwright, auth]
updated: 2026-09-11
---

# Auth Playwright

Mocked E2E for login pages and unauthenticated redirects. **No real Google OAuth in CI.**

## Specs

| Spec                                               | Tags           | Covers                                         |
| -------------------------------------------------- | -------------- | ---------------------------------------------- |
| `ui/e2e/features/auth/authPagesSmoke.spec.ts`      | `@smoke` `@ci` | `/for-hosts/login`, `/for-guests/login` render |
| `ui/e2e/features/auth/authRedirectSmoke.spec.ts`   | `@smoke` `@ci` | Unauthenticated host → `/for-hosts/login`      |
| `ui/e2e/features/auth/legacyRedirectSmoke.spec.ts` | `@smoke` `@ci` | `/sign-in` → host login                        |

## Run

```bash
bun x playwright test ui/e2e/features/auth --project=chromium-ci
```

## Manual gaps

Google OAuth, email OTP, and super-admin step-up stay manual. See [`super-admin-manual.md`](./super-admin-manual.md).
