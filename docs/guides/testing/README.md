---
title: 'Testing index'
status: active
tags: [guides, testing]
updated: 2026-09-11
---

# Testing index

Sitewide pyramid for Kame Homes. Plan: [`docs/workflow/done/sitewide-automated-testing.md`](../../workflow/done/sitewide-automated-testing.md).

## Pyramid

| Layer                           | Command                            | CI                   |
| ------------------------------- | ---------------------------------- | -------------------- |
| UI unit (Vitest)                | `bun run test`                     | every PR             |
| Edge unit (Deno `_shared`)      | `bun run test:edge`                | every PR             |
| Edge handlers                   | `bun run test:edge:handlers`       | every PR             |
| Playwright smoke                | `bun run test:e2e:smoke`           | PR + develop         |
| Playwright phone + tablet smoke | `bun run test:e2e:smoke`           | every PR             |
| Playwright CI suite             | `bun run test:e2e:ci`              | develop              |
| Post-deploy                     | `./scripts/deploy/ci-smoke.sh dev` | after develop deploy |
| Full local parity               | `bun run ci:quality`               | before push          |

## Layout

```
ui/src/<feature>/lib/*.test.ts
supabase/functions/_shared/*_test.ts
supabase/functions/tests/*.test.ts
ui/e2e/shared/
ui/e2e/features/<domain>/
docs/guides/testing/
```

## Playwright tags

Vitest intentionally stays Node-only for deterministic helpers, validators, and
client/server mirrors. Rendered component behavior is covered by mocked
Playwright journeys so the repo does not maintain a second DOM simulation layer.
The smoke command runs every `@smoke` journey on desktop, 375×812 phone, and
768×1024 tablet projects. Primary public, guest-form, booking, and super-admin
routes assert that the document does not overflow horizontally and that visible
interactive controls have an accessible name.

| Tag      | Meaning                                    |
| -------- | ------------------------------------------ |
| `@smoke` | Fast PR gate (< ~8 min total)              |
| `@ci`    | Mocked domain suite on develop             |
| `@live`  | Local Supabase (`PLAYWRIGHT_LOCAL_LIVE=1`) |
| `@demo`  | Headed/video; never CI                     |

## Domain guides

| Doc                                                                      | Domain                              |
| ------------------------------------------------------------------------ | ----------------------------------- |
| [`booking-workflow-playwright.md`](./booking-workflow-playwright.md)     | Guest form + host booking workflow  |
| [`parking-playwright.md`](./parking-playwright.md)                       | Parking marketplace                 |
| [`property-team-rbac-playwright.md`](./property-team-rbac-playwright.md) | Property team nav RBAC              |
| [`org-hub-playwright.md`](./org-hub-playwright.md)                       | Org dashboard, properties, team     |
| [`dashboard-modules-playwright.md`](./dashboard-modules-playwright.md)   | Property module shells              |
| [`guest-account-playwright.md`](./guest-account-playwright.md)           | Profile, stays, favorites, vouchers |
| [`plans-playwright.md`](./plans-playwright.md)                           | Checkout + downgrade                |
| [`voucher-reveal-playwright.md`](./voucher-reveal-playwright.md)         | Voucher reveal + wallet             |
| [`auth-playwright.md`](./auth-playwright.md)                             | Auth pages + redirects (no OAuth)   |
| [`onboarding-playwright.md`](./onboarding-playwright.md)                 | Host onboarding wizard (mocked)     |
| [`admin-playwright.md`](./admin-playwright.md)                           | Super-admin shell + approvals queue |
| [`public-marketing-playwright.md`](./public-marketing-playwright.md)     | Landing, search, listings, legal    |
| [`super-admin-manual.md`](./super-admin-manual.md)                       | Super admin OTP + payouts           |
| [`cost-abuse-verification.md`](./cost-abuse-verification.md)             | Cost/abuse/security dev verify      |

Manual-only (existing):

| Doc                                                                            | Domain                 |
| ------------------------------------------------------------------------------ | ---------------------- |
| [`ai-dashboard-assistant-manual.md`](./ai-dashboard-assistant-manual.md)       | Live Gemini assistant  |
| [`contract-expiry-lifecycle-manual.md`](./contract-expiry-lifecycle-manual.md) | Contract expiry        |
| [`smart-search-intents-manual.md`](./smart-search-intents-manual.md)           | Search intents deep QA |
| [`stay-guide-manual.md`](./stay-guide-manual.md)                               | Stay guide showcase    |
| [`custom-pages-module-manual.md`](./custom-pages-module-manual.md)             | Public pages editor    |
| [`image-upload-optimization-manual.md`](./image-upload-optimization-manual.md) | Media OCR/perf         |
| [`property-showcase-manual.md`](./property-showcase-manual.md)                 | Showcase templates     |

## Coverage inventory

| Domain            | Unit                                        | E2E                                                                                     | Manual                   |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| Booking workflow  | `statusMachine_test.ts`, `workflow.test.ts` | `ui/e2e/features/bookings/`, `guest-form/`                                              | workflow emails          |
| Parking           | `parkingStatusMachine_test.ts`              | `ui/e2e/features/parking/` (guest `@ci`, outcomes `@ci`)                                | PayMongo live            |
| Plans / billing   | `planPresentation.test.ts`, entitlements    | `ui/e2e/features/plans/org/*` (`@ci`)                                                   | PayMongo checkout        |
| Team RBAC         | catalog drift + permission expansion tests  | `ui/e2e/features/team/`                                                                 | auth parity seed (below) |
| Org hub           | org permissions helpers                     | `ui/e2e/features/org/` (dashboard, bookings, properties, team, settings)                | —                        |
| Guest account     | profile validation                          | `ui/e2e/features/account/` (favorites, profile, stays `@ci`)                            | OAuth, chat live         |
| Vouchers          | `voucherRevealWheel.test.ts`                | `ui/e2e/features/vouchers/`                                                             | —                        |
| Assistant         | `assistantToolCatalog.test.ts`              | `ui/e2e/features/assistant/`                                                            | live Gemini              |
| Auth              | validators                                  | `ui/e2e/features/auth/` (pages, redirect, legacy routes, accept-invite `@ci`)           | Google OAuth             |
| Public / search   | intent helpers                              | `ui/e2e/features/public/` (landing, list, for-hosts, search, legal, developments `@ci`) | smart-search manual      |
| Redirects         | —                                           | `legacyRouteRedirectSmoke.spec.ts`, `legacyRedirectSmoke.spec.ts`                       | —                        |
| Dashboard modules | finance/pricing/settings units              | `ui/e2e/features/dashboard/` (finance, team, public-pages, activity `@ci`)              | OTP payment              |
| Onboarding        | reserved-name validators                    | `ui/e2e/features/onboarding/` (`@ci`)                                                   | verification upload      |
| Super admin       | `superAdminVerification_test.ts`            | `ui/e2e/features/admin/` (overview + approvals queue `@ci`)                             | OTP, payouts             |
| Crons / webhooks  | lead-window, signature units                | —                                                                                       | scheduled jobs           |

Route guides: each **`docs/guides/routes/*.md`** includes a **Testing** section (unit path / E2E spec / manual).

### Auth parity seed (production-readiness doc 21)

Hosted no-seed smoke: `supabase/functions/tests/adversarialAuthLive.test.ts` (cd-dev deploy job).

Seeded role × endpoint table (local or hosted with real JWTs):

1. Copy `supabase/functions/tests/fixtures/auth-parity-seed.example.json` to `auth-parity-seed.local.json` (gitignored).
2. Fill query params and export JWT env vars named in each case.
3. Run `AUTH_PARITY_FIXTURE=supabase/functions/tests/fixtures/auth-parity-seed.local.json SUPABASE_URL=... SUPABASE_ANON_KEY=... deno test --allow-net --allow-env --allow-read supabase/functions/tests/authParitySeed.test.ts`

CI runs the harness with fixture unset (one passing skip marker test).

## Same change as code

When you ship behavior:

1. Add or update the matching unit or E2E test.
2. Update the route guide **Testing** row.
3. Run `bun run ci:quality` before push.

Agents: invoke skill **`testing`** and rule **`.cursor/rules/testing.mdc`**.

## Flake policy

- CI retries Playwright twice (`playwright.config.ts`).
- Quarantine with `@flaky` only with a tracked issue; never skip silently.
- `@live` and `@demo` never block PR or develop deploy.
