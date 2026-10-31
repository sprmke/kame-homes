---
name: supabase-auth
description: Supabase Auth for admin Google OAuth, session JWT, allow list, org/property RBAC. Use for sign-in, RequireAdmin, edge verifyAdminJwt, verifyPropertyAccess, or team permissions.
---

# Supabase auth (GFM)

## Admin sign-in

- Route: **`/for-hosts/login`** → `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Legacy: **`/sign-in`** redirects to host login (preserves `?redirect=`)
- Client: `ui/src/lib/supabase/client.ts` (singleton)
- Guard: `ui/src/features/dashboard/bookings/components/RequireAdmin.tsx`

## Allow list

- Server: `ADMIN_ALLOWED_EMAILS` in edge env — `_shared/auth.ts#verifyAdminJwt` (org owners bypass)
- Server: `SUPER_ADMIN_EMAILS` — `serveSuperAdmin`, `isSuperAdminEmail` in `_shared/orgAuth.ts`
- Client UX: `list-organizations.isSuperAdmin` — `RequireSuperAdmin`, `ModeSwitcher` Admin tab

See `.cursor/rules/admin-auth.mdc`.

## Org / property RBAC

| Helper                   | File                                 |
| ------------------------ | ------------------------------------ |
| `verifyPropertyAccess`   | `_shared/orgAuth.ts`                 |
| `resolveAdminPropertyId` | `_shared/propertyScope.ts`           |
| Property permissions     | `_shared/propertyTeamPermissions.ts` |
| Org permissions          | `_shared/orgTeamPermissions.ts`      |

Platform superadmin: `SUPER_ADMIN_EMAILS` stays server-only; the UI consumes the
boolean capability returned by `list-organizations`.

## Edge pattern

```typescript
import { serveAdmin } from '../_shared/serveEdge.ts';

serveAdmin('my-function', async (req, user) => {
  const ctx = await resolveAdminPropertyId(req, user);
  // ...
});
```

`verify_jwt = false` in `config.toml` — **always** call auth helpers in handler body.

## UI session for API

```typescript
import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
```

Reuses the cached session JWT. Refreshes only when the access token is near expiry (single-flight). Signs out on a dead session, not on Auth 429s.

## Guest routes

Public browse (listings, calendar) uses **anon key** — no session required. Gated guest surfaces (`/form`, parking `/form`, `/messages`, account) open **`GuestAuthModal`** when anonymous.

## Docs

- `docs/guides/routes/sign-in.md`
- `docs/guides/routes/org/team.md`
