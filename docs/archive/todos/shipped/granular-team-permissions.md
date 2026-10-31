# Granular team permissions (property RBAC)

|             |                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **Shipped** | 2026-08-28                                                                                               |
| **Plan**    | [`docs/workflow/done/granular-team-permissions.md`](../../../workflow/done/granular-team-permissions.md) |
| **Labels**  | type:feature, team, rbac                                                                                 |

## Description

Property team access rebuilt from coarse `MANAGER` / `STAFF` / `VIEWER` page-level ids to **Owner \| Admin** + seeded templates (**Full Access** / **Operations** / **Read Only**) and a granular leaf catalog (~80 ids) across bookings, finance, pricing, maintenance, marketing, notifications, templates, public pages, settings, team, and inbox. Server catalog, client mirror, and AI Dashboard Assistant tools stay aligned (D14). Plan entitlements compose with RBAC via D16–D17.

## Shipped notes

- **Phases 0–7:** role simplification, migrations + expansion maps, module-by-module edge + UI cutover through Marketing Studio.
- **Phase 8:** docs/QA cleanup; Playwright smoke (`bun run test:e2e:team`); enforcement gap pass (Admin full-catalog assign + reject `[]`; Public Pages / Progress pricing / dashboard widgets / Team+Inbox leaf UI; Help ungated; parent-tree sensitive confirm).
- **Advisors (local SQL 2026-08-28):** team tables RLS on with zero policies (edge `service_role` pattern); anon/authenticated have no SELECT/DML; indexes present; Phase 7 marketing helper functions dropped.
- **Deferred:** Phase 9 parking RBAC parity (stub until parking E2E later phases finalize). Phase 7 Marketing heuristic may over-grant custom/partial members vs Q5 — accepted historical risk, no strip migration.

## Verify

```bash
bun run type-check
bun run test:e2e:team
```
