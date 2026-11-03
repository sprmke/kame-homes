---
title: 'App launch resolver — operator guide'
status: active
tags: [guides, pwa, install, routing]
updated: 2026-11-01
---

# App launch resolver — operator guide

Route: `/app` (with `?source=pwa` and `?shortcut=bookings|inbox|checkins`)

> **Status:** Documented.

## Progress overview

| Section            | E2E save | Validation | Docs       | Notes                                                  |
| ------------------ | -------- | ---------- | ---------- | ------------------------------------------------------ |
| Launch resolution  | @pwa     | —          | Documented | Signed-out, host, guest, super admin, offline fallback |
| Shortcut deep link | @pwa     | —          | Documented | `bookings` / `inbox` / `checkins` (Manila date)        |
| Error fallback     | @pwa     | —          | Documented | Offline cold start → last tenant; otherwise host login |

---

## Overview

`/app` has no UI of its own beyond a loading state. It exists so the installed
app (manifest `start_url`) and every manifest shortcut resolve to the right
destination **once**, with the session, instead of landing on the public
marketplace.

## Behaviour

| Viewer state                                   | Destination                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Signed in, member of at least one organization | `resolvePostSignInPath('/org')` → last org + last property/parking, then the shortcut is applied |
| Signed in, super admin, no organization        | `/admin`                                                                                         |
| Signed in guest (no organization)              | `/account`                                                                                       |
| Signed out, this device has hosted before      | `/for-hosts/login?redirect=/app?...`                                                             |
| Signed out, first visit on this device         | `/` (public landing)                                                                             |
| Offline cold start with a known last tenant    | that tenant's dashboard (cached data)                                                            |
| Offline with nothing cached                    | "You're offline" notice                                                                          |

Shortcuts:

| `?shortcut=` | Lands on                                                          |
| ------------ | ----------------------------------------------------------------- |
| `bookings`   | `/org/:org/property/:slug/bookings` (or parking equivalent)       |
| `inbox`      | `/org/:org/property/:slug/inbox` (or parking equivalent)          |
| `checkins`   | the bookings list filtered to today's arrival date in Asia/Manila |

A shortcut never bypasses a required setup step: onboarding, verification-rejected
and the org hub are returned unchanged.

## Edge cases

- **Lost access to the last org** — `resolveOrgLandingPath` falls back to the first accessible org, then onboarding.
- **Last tenant was parking** — resolves the parking dashboard.
- **Session rejected by the server** — treated as signed out with the host-login return path preserved.
- **No open redirect** — `/app` accepts no `next=` parameter, and every redirect it emits is app-relative.

## Access control

No authorization of its own: it only chooses where to send the viewer. Every
destination keeps its existing guards (`RequireAdmin`, property/parking/org
permission gates).

## Implementation map

| Piece           | Path                                                         |
| --------------- | ------------------------------------------------------------ |
| Route           | `ui/src/features/launch/routes.tsx` (`launchRoutes`)         |
| Page            | `ui/src/features/launch/pages/AppLaunchPage.tsx`             |
| Pure resolution | `ui/src/features/launch/lib/launchRouting.ts` (+ `.test.ts`) |
| Manifest wiring | `ui/src/pwa/manifest.ts` (`start_url`, `shortcuts`)          |

## Testing

- Unit: `ui/src/features/launch/lib/launchRouting.test.ts`.
- E2E: `ui/e2e/pwa/pwaFoundation.spec.ts` (`@pwa`) — signed-out routing and shortcut safety, run against a production build.

## Host-facing knowledge

The app always opens where you left off. If you manage one property or parking
space, it opens straight to that dashboard; if you manage several, it opens the
one you used last. The shortcuts on your home screen go directly to bookings,
messages, or today's arrivals.

**Common host questions**

- Q: I installed the app and it opens to a booking list instead of my dashboard. Why?
  A: The app remembers the property or parking space you used last. Open the dashboard you want once and it will be remembered next time.
- Q: The shortcut opens the wrong property. How do I change it?
  A: Shortcuts open your most recently used property or parking space. Switch to the one you want in the app, then use the shortcut again.
- Q: I was signed out after installing. Is something broken?
  A: No. On iPhone the installed app stores its own sign-in, so you may need to sign in once inside the app.
