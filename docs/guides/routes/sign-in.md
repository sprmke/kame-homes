---
title: 'Sign-in (legacy redirect)'
status: active
tags: [guides, routes, auth]
updated: 2026-08-17
---

# Sign-in (legacy redirect)

Route: `/sign-in` → **`/for-hosts/login`**

> **Status:** Documented — legacy URL only; host sign-in lives at **`/for-hosts/login`**. See [auth.md](./auth.md).

## Progress overview

| Section         | E2E save | Validation | Docs       | Notes                                      |
| --------------- | -------- | ---------- | ---------- | ------------------------------------------ |
| Legacy redirect | —        | —          | Documented | `/sign-in` → `/for-hosts/login`            |
| Redirect query  | —        | —          | Documented | Preserves **`?redirect=`** on target login |

---

## Overview

Old bookmarks and external links may still point to **`/sign-in`**. The app immediately replaces that URL with the current host login page at **`/for-hosts/login`**. No form renders on **`/sign-in`** itself.

When a **`?redirect=`** query param is present, it is forwarded so that after Google sign-in the host lands on the page they originally requested (dashboard, settings, etc.).

Guest sign-in is **not** served here — guests authenticate through the checkout modal on listing and booking pages. See [auth.md](./auth.md).

---

## Host-facing knowledge

If someone shared an old "sign in" link with you, it still works. You'll land on the current host login page automatically.

**Common host questions**

- Q: Is my old "sign-in" bookmark still valid?
  A: Yes. It redirects to the host login page; sign in with Google there as usual.
- Q: I expected a password field on the old sign-in link, but the page changed. What happened?
  A: Host sign-in moved to the For Hosts login page and uses Google only; the old link is just a shortcut that sends you there.
- Q: Can guests use the old sign-in link to log in?
  A: No, that path is for hosts. Guests sign in only when booking or saving a listing, through the popup on those pages.

---

## Behavior

| Input                          | Result                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| `GET /sign-in`                 | **302/replace** navigate to **`/for-hosts/login`**           |
| `GET /sign-in?redirect=/org/…` | Same redirect; **`redirect`** param copied to host login URL |

No server round-trip beyond the SPA route — **`LegacySignInRedirect`** renders **`Navigate`** with **`replace`**.

---

## Implementation map

| Concern  | Path                                                                   |
| -------- | ---------------------------------------------------------------------- |
| Redirect | `ui/src/features/guest/auth/components/LegacySignInRedirect.tsx`       |
| Target   | `hostLoginPath()` in `ui/src/features/guest/auth/lib/hostAuthPaths.ts` |
| Routes   | `ui/src/features/guest/auth/routes/index.tsx`                          |

---

## Testing

| Layer | Path / spec                                                | Manual |
| ----- | ---------------------------------------------------------- | ------ |
| E2E   | `ui/e2e/features/auth/legacyRedirectSmoke.spec.ts` (`@ci`) | —      |

---

## Related docs

- [Guest & host auth](./auth.md)
- [For hosts landing](./for-hosts.md)
- [Route index](./README.md)
- [`docs/architecture/routing.md`](../../architecture/routing.md)
