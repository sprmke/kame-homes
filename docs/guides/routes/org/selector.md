---
title: 'Organization hub — operator guide'
status: active
tags: [guides, routes, org]
updated: 2026-10-25
---

# Organization hub — operator guide

Route: `/org`

> **Status:** Documented

## Progress overview

| Section       | E2E save | Validation | Docs       | Notes                    |
| ------------- | -------- | ---------- | ---------- | ------------------------ |
| Auto-redirect | n/a      | n/a        | Documented | No selector UI; hub only |

---

## Overview

Authenticated hosts hitting **`/org`** never see an organization picker. The page loads **`list-organizations`**, then redirects:

| Condition                                                   | Destination                                                                                                                                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One or more usable orgs                                     | **`/org/:slug/dashboard`** — last-used slug from `localStorage` when still accessible, otherwise the first org                                                                                           |
| Last visit was a listing in that org                        | **`/org/:orgSlug/property/:slug`** or **`/org/:orgSlug/parking/:slug`** (dashboard level) — stored listing slug, validated against the org's actual listings; stale slug falls back to the org dashboard |
| Zero orgs, or only plan-limited seats (`planLimited: true`) | **`/onboarding`** — start a new organization                                                                                                                                                             |
| All orgs hard-rejected                                      | **`/verification-rejected`**                                                                                                                                                                             |
| List error                                                  | **`/onboarding`**                                                                                                                                                                                        |

Listing-level landing reuses the stored "last tenant context" (`kame-last-*` keys in `localStorage`, written by `RequireOrgContext` / `RequireParkingContext`). It only applies when the selected org is the one the listing context was saved for; otherwise the org dashboard is used. The hub waits for `list-properties` / `list-parkings` for the selected org only when a listing context is actually stored.

Usable orgs exclude plan-limited seats and hard-rejected host verification. Users may be **assigned** to multiple orgs (owner, org admin, or property member) and switch via the sidebar tenant switcher. They **cannot create** a second owned org — onboarding redirects away when a usable owned org already exists, and **`create-organization`** returns **409** if the caller already owns one (hard-rejected owners may start a new application).

---

## Host-facing knowledge

Visiting the organization hub does not show a list of organizations to pick from. After you sign in, the app sends you straight to your organization dashboard, usually the one you used last. If your last visit was inside a specific property or parking listing, opening Dashboard returns you to that listing instead of the org page. If you belong to more than one organization, switch between them with the tenant menu in the sidebar. If you don’t have an organization yet, you’re sent to onboarding to create one.

**Common host questions**

- Q: Why don’t I see an organization chooser after sign-in?
  A: The app remembers your last organization and opens it automatically. Use the sidebar switcher to change organizations.
- Q: Can I own two separate organizations with one Google account?
  A: No. Each account can own one organization. You can still be invited as an admin to other people’s organizations.
- Q: I only manage one property. Why did I land on an org page?
  A: Property-only members are usually redirected to their assigned property dashboard. If something looks wrong, confirm your team invite was accepted and that a property is assigned to you.

---

## Behavior / edge cases

- **Property-only members** who land on an org dashboard are redirected by **`PropertyMemberOrgRedirect`** to an assigned property. If that org has no properties, try another accessible org; otherwise show access denied (never loop back to `/org` forever).
- Access denied / **Access paused** (**`TenantAccessDenied`**) always offers **Home** → **`/org`**, which re-resolves the landing path (other usable org, or **`/onboarding`** when only plan-limited seats remain).
- Other failed context guards (`RequireOrgContext`, `RequireParkingContext`, delete-org) still navigate to **`/org`**, which re-resolves the landing path.
- Post-sign-in with redirect **`/org`** uses the same **`resolveOrgLandingPath`** helper as this page.

---

## API reference

| Action    | Endpoint                 |
| --------- | ------------------------ |
| List orgs | `GET list-organizations` |

---

## Implementation map

| Concern                | Path                                                      |
| ---------------------- | --------------------------------------------------------- |
| Page                   | `ui/src/features/dashboard/org/pages/OrgSelectorPage.tsx` |
| Landing helper         | `ui/src/features/dashboard/org/lib/orgLanding.ts`         |
| Post-sign-in           | `ui/src/features/dashboard/org/lib/postSignInRouting.ts`  |
| Routes                 | `ui/src/features/dashboard/org/routes/index.tsx`          |
| Create org (one owned) | `supabase/functions/create-organization/index.ts`         |

---

## Testing

| Layer | Path / spec                                                                       | Manual |
| ----- | --------------------------------------------------------------------------------- | ------ |
| E2E   | `ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` redirect paths (`@ci`)    | —      |
| N/A   | Redirect-only route                                                               | —      |
| Unit  | `src/features/dashboard/org/lib/orgLanding.test.ts` — listing-level landing cases | —      |

---

## Related docs

- [Route index](../README.md)
- [Onboarding](../onboarding.md)
- [Org dashboard](./dashboard.md)
- [`docs/PROJECT.md`](../../PROJECT.md)

---

## Pending / follow-ups

- [ ] None
