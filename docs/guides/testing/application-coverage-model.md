---
title: 'Application coverage model'
status: active
tags: [guides, testing, coverage]
updated: 2026-09-23
---

# Application coverage model

Kame Homes does **not** use a single “100% Vitest line coverage on `ui/src/**`” bar. The app is a Vite SPA: most files are React pages and components. Unit tests run in **Vitest Node** (no DOM). Page layout, sections, and interactive elements are covered by **Playwright** journeys.

## Three layers (full application)

| Layer         | What it covers                                                                                 | Command                                   |
| ------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **UI unit**   | Pure logic in `**/lib/*.ts`, `utils/**` (validators, gates, formatters, workflow mirrors)      | `bun run test`                            |
| **UI E2E**    | Public marketing, guest flows, org/property/parking dashboards (load, key actions, a11y smoke) | `bun run test:e2e:smoke`, `test:e2e:ci`   |
| **Edge unit** | Booking workflow, plan entitlements, orchestrator branches                                     | `bun run test:edge`, `test:edge:handlers` |

Together these cover **functionality behind** every major route. They do **not** duplicate every button and field as a Vitest case.

## What “100%” means here

| Claim                                                                  | Accurate?                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every lib/utils module has a colocated `.test.ts` (or types-only skip) | **Yes** — `node scripts/dev/lib-unit-test-inventory.mjs` → 0 missing                                                                                                                                                                                   |
| Every route has **some** automated check (unit logic and/or E2E smoke) | **Most routes** — see route guide **Testing** sections and [`publicPagesSmoke.spec.ts`](../../../ui/e2e/features/public/publicPagesSmoke.spec.ts), [`dashboardModulesSmoke.spec.ts`](../../../ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts) |
| Vitest **line** coverage 100% on all `.tsx` pages                      | **No** — out of scope; would need jsdom + Testing Library or exhaustive E2E per field                                                                                                                                                                  |
| Vitest line coverage 100% on all `lib/`                                | **Target for incremental work** — run `bun run test:coverage:lib`; deepen files flagged by `lib-behavioral-coverage-audit.mjs`                                                                                                                         |

## Public vs dashboard

| Surface                                                           | Unit (Vitest)                                                      | E2E                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| Public marketing (`/`, `/properties`, `/search`, `/for-hosts`, …) | `features/guest/marketing/**/lib`, `guest/form`, `guest/search`, … | `@smoke` public pages spec                             |
| Guest operational (form, calendar, SD, parking pay, account)      | Matching `features/guest/**/lib`                                   | Guest-form, parking, account specs                     |
| Org / property / parking dashboard                                | `features/dashboard/**/lib`                                        | Org hub, dashboard modules, bookings, team RBAC, plans |
| Super admin                                                       | `features/dashboard/super-admin/lib`                               | Admin shell / approvals smoke                          |

## Scripts

| Script                              | Purpose                          |
| ----------------------------------- | -------------------------------- |
| `lib-unit-test-inventory.mjs`       | Missing colocated tests          |
| `lib-behavioral-coverage-audit.mjs` | Branching libs still export-only |
| `deepen-lib-unit-tests.mjs`         | Append safe behavioral cases     |
| `enrich-lib-unit-tests.mjs`         | Per-export describe scaffolding  |

## Hooks and browser-only code

`ui/src/hooks/*` and Polotno/PDF canvas helpers stay **Playwright** or manual unless we add a jsdom Vitest project. That is intentional (see [`comprehensive-unit-test-coverage.md`](../../workflow/done/comprehensive-unit-test-coverage.md)).
