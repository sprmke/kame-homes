---
name: multi-tenancy
description: Organizations, properties, parkings, scoped routes, and API paths. Use when adding org/property/parking features, scoping edge functions, or public ?property= links.
---

# Multi-tenancy (GFM)

## Model

- **Organization** — owner + org admins + invited members; **`host_modes`** (`property` \| `parking`)
- **Property** — belongs to org; team members with JSONB permissions
- **Parking** — one row = one slot; belongs to org; v1 org-owner access only (no `parking_members`)
- **Routes:**
  - Property: `/org/:orgSlug/property/:propertySlug/...`
  - Parking: `/org/:orgSlug/parking/:parkingSlug/...`
  - Org: `/org/:orgSlug/parkings`, `/org/:orgSlug/properties`, …

## UI scoping

| Helper                      | Purpose                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `usePropertyIdParam`        | Resolve property UUID from route                                  |
| `appendPropertyId`          | Add `?property_id=` to edge URLs                                  |
| `scopedFunctionsUrl`        | Base functions URL + property scope                               |
| `useParkingIdParam`         | Resolve parking UUID from route                                   |
| `appendParkingId`           | Add `?parking_id=` to edge URLs                                   |
| `scopedParkingFunctionsUrl` | Base functions URL + parking scope                                |
| `tenantPaths.ts`            | `parkingSectionPath`, `orgParkingsPath`, last-tenant localStorage |
| `guestPublicPaths.ts`       | Public `/?property=<slug>` links                                  |

## Edge scoping

**Property:**

```typescript
import { resolveAdminPropertyId } from '../_shared/propertyScope.ts';
```

**Parking:**

```typescript
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
```

Public guest:

```typescript
import { resolvePublicPropertyId } from '../_shared/propertyScope.ts';
// get-public-parking resolves by slug directly
```

Defaults to legacy Monaco property when param omitted (backlog: require explicit property).

## Data

- `guest_submissions.property_id` — property stay bookings only (not parking inventory)
- Per-property `app_settings`, Telegram settings, Gmail integration
- Per-parking `parking_settings` (payment, integrations, notification templates)
- Cron jobs iterate properties (`propertyCron.ts`)

## Org nav visibility

Sidebar shows **Properties** / **Parkings** when `host_modes` includes the type or org has ≥1 row of that type (`adminSidebarNav.ts` + `AdminLayout.tsx`).

## Post-sign-in routing

`postSignInRouting.ts` — parking-only orgs → `/org/:slug/parking/:park/dashboard` or `/org/:slug/parkings`.

## Legacy redirects

`LegacyAdminRedirect.tsx` — flat `/bookings` → org/property paths.

## Docs

- `docs/PROJECT.md` — multi-tenancy + parking schema/API
- `docs/guides/routes/org/parkings.md`
- `docs/guides/routes/org/parking/settings.md`
- `docs/guides/routes/onboarding.md`

## Rule

`.cursor/rules/security.mdc`
