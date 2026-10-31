---
title: 'Accept team invite — operator guide'
status: active
tags: [guides, routes, auth]
updated: 2026-08-17
---

# Accept team invite — operator guide

Route: `/accept-invite?token=…` (optional `scope=org|property|parking`)

> **Status:** Documented

## Progress overview

| Section        | E2E save | Validation  | Docs       | Notes                                     |
| -------------- | -------- | ----------- | ---------- | ----------------------------------------- |
| Preview        | —        | Token       | Documented | Public `get-team-invite-preview`          |
| Google sign-in | —        | Session     | Documented | Required before Accept                    |
| Accept         | Done     | Email match | Documented | Org / property / parking accept endpoints |
| Post-accept    | —        | —           | Documented | Lands on matching dashboard               |

---

## Overview

Standalone page for accepting an org, property, or parking team invitation from an email link. Shows org branding and invite details, requires Google sign-in, then an explicit **Accept** tap (no auto-accept on load). Invite email must match the signed-in Google account.

---

## Host-facing knowledge

When you invite a teammate, they get an email with a link to this page. They sign in with Google, review the invite, and tap Accept. After that they land in the right dashboard for the invite (organization, property, or parking).

**Common host questions**

- Q: My teammate opened the link but nothing happened. Why?
  A: They must sign in with the same Gmail address the invite was sent to, then tap Accept. The page does not join them automatically just by opening the link.
- Q: What if they use a different Google account?
  A: Accept fails until they switch to the invited email (or you send a new invite to the account they actually use).
- Q: Where do they go after accepting?
  A: Organization invites open the org dashboard; property invites open that property; parking invites open that parking dashboard.

---

## Query params

| Param   | Required | Behavior                                                                                                                 |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `token` | Yes      | Opaque invite token from the email link                                                                                  |
| `scope` | Optional | `org` · `property` · `parking` — selects which accept API to call; when omitted, UI tries property then parking then org |

Missing/invalid token → error state (invitation not found).

---

## Behavior

1. Load preview via **`get-team-invite-preview`** (public; no JWT).
2. Header: org logo + name; property/parking location line when applicable; role label in body.
3. Signed out → **Continue with Google** (return URL preserves token/scope).
4. Signed in → review card + **Accept** button.
5. Accept calls one of: `accept-org-invite` · `accept-property-invite` · `accept-parking-invite`.
6. On success: invalidate team/org/access queries; set last tenant context; navigate to:
   - Org → `/org/:orgSlug/dashboard`
   - Property → `/org/:orgSlug/property/:propertySlug`
   - Parking → `/org/:orgSlug/parking/:parkingSlug`

Email mismatch, expired, cancelled, or already-accepted invites surface as errors/toasts.

---

## API reference

| Action          | Endpoint                                    |
| --------------- | ------------------------------------------- |
| Preview         | `GET get-team-invite-preview?token=&scope=` |
| Accept org      | `POST accept-org-invite` `{ token }`        |
| Accept property | `POST accept-property-invite` `{ token }`   |
| Accept parking  | `POST accept-parking-invite` `{ token }`    |

---

## Implementation map

| Concern      | Path                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Page         | `ui/src/features/dashboard/team/pages/AcceptInvitePage.tsx`                                    |
| API client   | `ui/src/features/dashboard/team/lib/acceptInviteApi.ts`                                        |
| Route        | `ui/src/features/dashboard/team/routes/index.tsx`                                              |
| Edge preview | `supabase/functions/get-team-invite-preview/`                                                  |
| Edge accept  | `supabase/functions/accept-org-invite/` · `accept-property-invite/` · `accept-parking-invite/` |

---

## Testing

| Layer | Path / spec                                              | Manual            |
| ----- | -------------------------------------------------------- | ----------------- |
| E2E   | `ui/e2e/features/auth/acceptInviteSmoke.spec.ts` (`@ci`) | Real invite email |

---

## Related docs

- [Route index](./README.md)
- [Org team](./org/team.md) — invite creation / resend / cancel
- [Property team](./org/property/team.md)
- [Parking team](./org/parking/team.md)
- [`docs/PROJECT.md`](../PROJECT.md)

---

## Pending / follow-ups

- [x] Covered as its own route guide (was previously only described inside team guides)
