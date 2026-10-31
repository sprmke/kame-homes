---
title: 'Property team RBAC Playwright'
status: active
tags: [guides, testing, team, rbac, playwright]
updated: 2026-08-28
---

# Property team RBAC Playwright

Mocked smoke coverage for property-team granular permissions (Phases 1–7): sidebar nav visibility and route-guard redirects for the three seeded templates.

## Scope

| Spec / file                         | What it covers                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `propertyTeamNavRbac.spec.ts`       | Full Access / Operations / Read Only nav + Finance/Marketing deep-link guards |
| `shared/propertyTeamRbacHarness.ts` | Dev session + `property-access` permission mocks                              |

## Coverage matrix

| Scenario                  | Assertion                                                      |
| ------------------------- | -------------------------------------------------------------- |
| Full Access nav           | Finance, Marketing, Settings, Team visible                     |
| Operations nav            | Marketing + Bookings visible; Finance / Settings / Team hidden |
| Read Only nav             | Marketing / Finance / Settings hidden; Team + Bookings visible |
| Operations → `/finance`   | Redirects off `/finance` (first allowed section)               |
| Read Only → `/marketing`  | Redirects off `/marketing`                                     |
| Operations → `/marketing` | Stays on Marketing (Phase 7 grant)                             |

### Intentional gaps (not automated)

- Per-leaf in-page action gates (booking detail tabs, finance CRUD, marketing publish)
- Invite / custom-role matrix UI
- Plan-entitlement inner gate (`TierBadge` / upgrade modal) with permission present
- Live local Supabase member rows (this suite is fully mocked)
- Parking RBAC (`MANAGER` / `STAFF` / `VIEWER`) — Phase 9

## Runner

```bash
bun run test:e2e:team
bun run test:e2e:team:headed
```

Uses root `playwright.config.ts` (Vite on `http://127.0.0.1:4173`). Browser: `npx playwright install chromium`.

## Mocked auth

Same pattern as parking E2E:

| Storage key              | Role                                         |
| ------------------------ | -------------------------------------------- |
| `kame:e2e-admin-session` | Host JWT for `useAdminSession` / edge client |
| `sb-127-auth-token`      | Supabase auth session shape                  |

`property-access` returns `accessKind: 'member'` plus the template's leaf permission list. Plan entitlements are mocked as Business-tier (all plan gates on) so failures are permission-driven, not plan-driven.

Nav smoke opens **`/bookings`** (same sidebar as the property dashboard) so the suite does not depend on dashboard KPI widgets. Mocks also cover flat `app-settings` / `org-settings` DTOs — incomplete shapes crash settings-completion and blank the shell.

## Related

- Plan: [`docs/workflow/done/granular-team-permissions.md`](../../workflow/done/granular-team-permissions.md)
- Route guide: [`docs/guides/routes/org/property/team.md`](../routes/org/property/team.md)
- Parking Playwright: [`parking-playwright.md`](./parking-playwright.md)
