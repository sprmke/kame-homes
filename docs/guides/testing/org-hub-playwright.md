---
title: 'Org hub Playwright'
status: active
tags: [guides, testing, playwright, org]
updated: 2026-09-11
---

# Org hub Playwright

Mocked E2E for org-level dashboard surfaces (not property-scoped).

## Specs

| Spec                                                     | Tags  | Covers                                          |
| -------------------------------------------------------- | ----- | ----------------------------------------------- |
| `ui/e2e/features/org/orgHubSmoke.spec.ts`                | `@ci` | Dashboard, bookings, properties, team, activity |
| `ui/e2e/features/org/orgSettingsSave.spec.ts`            | `@ci` | Org socials PATCH save                          |
| `ui/e2e/features/org/copyPropertySettingsDryRun.spec.ts` | `@ci` | Copy settings wizard dry-run                    |

## Harness

Same host session as property tests: `installPropertyTeamRbacMocks(page, 'full_access', { orgHub: true })`.

## Run

```bash
bun x playwright test ui/e2e/features/org --project=chromium-ci
```
