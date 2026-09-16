---
title: 'Guest & host auth — operator guide'
status: active
tags: [guides, routes, auth]
updated: 2026-09-14
---

# Guest & host auth — operator guide

Routes:

- `/for-hosts/login` · `/for-hosts/register`
- `/for-guests/login` · `/for-guests/register`
- `/sign-in` — legacy redirect → `/for-hosts/login` (preserves `?redirect=`)
- `/for-guests/*` (any other path) — redirects to `/for-guests/login`

> **Status:** Documented — host and guest sign-in are both fully wired to Supabase: email OTP (two-step: email → code) + Google OAuth (both audiences). No passwords anywhere, no Facebook (removed — not supported). Guest checkout keeps its own contextual modal (unchanged) in addition to the standalone pages below.

## Progress overview

| Section                | E2E save | Validation | Docs       | Notes                                                                                                                                                |
| ---------------------- | -------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth layout            | —        | —          | Documented | Split panel + form; host left uses shared **`HostWorkspaceSidePanel`** (`auth` variant)                                                              |
| Host login/register    | ✅       | Client     | Documented | Email OTP + Google OAuth — same component/flow for both modes                                                                                        |
| Guest login/register   | ✅       | Client     | Documented | Email OTP + Google OAuth — standalone pages (new)                                                                                                    |
| Guest checkout auth    | ✅       | Client     | Documented | Modal on form/messages entry, calendar Proceed, Reserve, save heart                                                                                  |
| Guest account nav      | ✅       | —          | Documented | Avatar on explore when signed in; real "Sign In" link when not                                                                                       |
| Host dashboard profile | ✅       | Client     | Documented | Sidebar account menu → **Profile** modal (same form as `/account/profile`)                                                                           |
| Mode switcher          | —        | —          | Documented | Global curtain; admin sidebar + marketing/auth triggers                                                                                              |
| Mobile shell           | —        | —          | Documented | No bottom tab bar by default — `AuthLayout` is its own top-level route, not nested in `MarketingLayoutShell` (verified 2026-09-10, not just assumed) |

---

## Overview

Guests can sign in two ways, both real and both landing in the same Supabase Auth session:

1. **Contextual checkout modal** (`GuestAuthModal`) — appears when a guest opens a gated surface (booking form, messages, reserve, contact host, **Contact ticket**, save) or commits an action that needs a session.
2. **Standalone pages** (`/for-guests/login`, `/for-guests/register`) — reachable directly (nav "Sign In" link, deep links, bookmarks), same email-OTP + Google flow as the modal, just as a full page.

Guests can browse listings and pick dates without signing in. Opening **`/properties/:slug/form`**, **`/parkings/:slug/form`**, or **`/messages`** directly requires auth first (modal + skeleton), same as Reserve / Contact host.

1. **Property detail → Reserve** (desktop `BookingCard`, mobile sticky bar) — `usePropertyReserve` with `onOpenForm` opens **`GuestAuthModal`** first when anonymous, then **`GuestBookingFormModal`** (same pattern as Contact host)
2. **Calendar → Proceed** — `GuestAuthModal` (Airbnb-style)
3. **Property calendar → Book Now** — `usePropertyReserve` without `onOpenForm` navigates to `/form` and gates with `GuestAuthModal` first
4. **Property detail → Contact host** — `GuestAuthModal` first when anonymous, then **`ContactHostSheet`**
5. **Direct form / messages entry** — `/properties/:slug/form`, `/parkings/:slug/form`, and `/messages` open **`GuestAuthModal`** on load when anonymous (skeleton until signed in); submit still re-checks if the session expired
6. **Save property (heart)** — any listing card, list row, or detail gallery Save button → `GuestAuthModal` when anonymous; persists to `guest_saved_properties` after login (OAuth resume via `save_property` intent)
7. **Contact (`/contact`)** — category card → `requireGuestAuth` → `GuestAuthModal`, then **`NewTicketModal`** (OAuth resume navigates back with `?category=`)

Marketing **Become a host?** on explore pages runs the global mode-switch curtain to **`/for-hosts`**. On explore pages, signed-in guests always see **Dashboard** in the avatar menu under **Host** (not gated on org membership) — that link runs the same mode-switch curtain, then lands on **`/org`** (the hub redirects to an org the caller can access, or onboarding if none). Phone/tablet uses the same **Dashboard** row in the marketing **More** sheet. When already in host mode (e.g. **`/for-hosts`** avatar menu), **Dashboard** navigates directly with no curtain. On `/for-hosts`, the pill CTA is **Explore** (back to guest mode); signed-in hosts use the avatar menu for **Dashboard**, signed-out hosts see **Sign In** → **`/for-hosts/login`**. On explore pages, signed-in guests see the avatar menu (**`/account/*`** — profile, stays, wishlist, messages, see **[[profile|Guest account — operator guide]]**), signed-out guests now see a real **Sign In** link → **`/for-guests/login`**.

On the **host dashboard**, the sidebar footer account menu shows the same avatar resolution as explore (saved profile photo → Google OAuth photo → initials). The trigger keeps name and email; the open menu shows only mode switch, **Profile**, and **Sign out** (no duplicate identity block). **Profile** opens a modal with the same edit form as **`/account/profile`**; saves go to **`guest-profile`** and update explore + dashboard immediately.

### Sign-in flow (both audiences)

- Single email field → **Continue** → OTP code emailed (unified sign-in/sign-up via `signInWithOtp` + `shouldCreateUser: true`) → 6-digit code entry → **Verify** (auto-submits once all 6 digits are entered)
- **Google** OAuth below the email path — same order as the guest checkout modal: email + Continue, **or** divider, then **Continue with Google** (both audiences). Facebook was removed and is not supported
- No phone sign-in, no passwords
- `/register` is a thin copy-only alias of `/login` — same form, same behavior. Since OTP verification auto-creates the account on first code entry, there's no way (or need) to distinguish "logging in" from "signing up"; a returning user who lands on `/register` by mistake just signs in normally
- The email step and the code-entry step are mutually exclusive views — once a code is sent, the Google button, divider, and register/login cross-link are hidden so the code-entry step stays focused (just Back, the 6-digit input, Verify, and a Resend link with a 30s cooldown). Concurrent sends for the same normalized email share one in-flight request, preventing rapid clicks or two mounted auth surfaces from sending duplicate codes; Supabase Auth remains the server-side rate-limit authority.
- **Invisible human verification:** a Cloudflare Turnstile widget (`useCaptchaToken`, `action: auth-email-otp`) is mounted for the whole login flow — kept alive on both the email and the code-entry steps so **Resend** (which lives on the code step) always has a fresh single-use token. Real users see nothing; a suspicious session gets an inline challenge before **Continue** / **Resend** proceeds. The token is passed as `options.captchaToken` on `signInWithOtp` and verified by Supabase Auth's native Turnstile (`supabase/config.toml` `[auth.captcha]`; hosted: Dashboard → Authentication → Attack Protection). Fully degrades (no widget, OTP still sends) when `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` are unset. Google OAuth is unaffected. See [PROJECT.md → Anti-spam & CAPTCHA](../../PROJECT.md).

Resume after OAuth (guest): `sessionStorage` (`guestAuthResume.ts`) restores navigation to the form, contact-host sheet, booking-form modal, or auto-submits after social/email auth when the modal was the entry point. On the standalone guest page, OAuth/OTP success simply navigates to `?redirect=` (or `/`) once the session becomes authenticated.

### Host sign-in

**Layout (lg+, host routes):** 50/50 split — left **`HostWorkspaceSidePanel`** (`variant="auth"`) shared with onboarding: solid **`bg-primary`**, **`MarketingBrandLogo`** inset `p-4` (same top-left as **`MarketingNav`**), headline + description, compact **`HostDashboardTourPlayer`** (expand modal — the tour film is theme-aware and follows the viewer's light/dark choice; see `for-hosts.md` § Dark mode). No footer links on the panel. Guest auth routes keep the legacy gradient branding panel with feature cards.

1. User enters their email (OTP) or clicks **Continue with Google** on `/for-hosts/login` or `/for-hosts/register`.
2. Either path lands a normal Supabase Auth session — `useAdminSession` treats any session as signed-in regardless of which method was used.
3. On success, **`useHostGoogleAuth`** (name unchanged, now also drives OTP) + **`resolvePostSignInPath`** routes to onboarding **only when the email has no usable org**. Login, register, and a `?redirect=/onboarding` deep link all call `list-organizations` first: existing owners/members go to their workspace; hard-rejected hosts go to **`/verification-rejected`**. The same response carries the server-derived `isSuperAdmin` capability used by the Admin mode tab and `/admin/*` route guard; super-admin email addresses never ship in the browser bundle. One email = one Auth user = at most one usable owned organization. If that call fails in the browser as `TypeError: Failed to fetch` / `net::ERR_FAILED` (often wrapped by PostHog session replay), it is a CORS preflight miss, not a bad Google session. `_shared/cors.ts` must allow the exact page origin (including `http://127.0.0.1:*`; temporary previews use `CORS_ALLOWED_ORIGINS`) and PostHog tracing headers. Local: restart `functions serve`. Hosted dev: deploy functions (`bun run deploy:supabase:dev`).

Guards send unauthenticated hosts to **`hostLoginPath(currentPath)`**.

There is no password anywhere in this flow. What used to be `/for-hosts/forgot-password`, `/for-hosts/reset-password`, and `/for-hosts/verify-email` no longer exist — those pages only ever supported a password flow that was never real, and passwords aren't part of the model at all now (email OTP already proves email ownership per code entry, the same guarantee a password reset link would give).

---

## Host-facing knowledge

Hosts and guests can both sign in with a one-time code sent to their email, or with their Google account. There's no password to remember or reset for either, and no Facebook sign-in option.

**Common host questions**

- Q: How do I sign in to my dashboard?
  A: Use "Continue with Google," or enter your email to get a one-time sign-in code — either way, no password is needed.
- Q: I can't find a password option. Is that normal?
  A: Yes — signing in only works through a one-time email code or your Google account, by design.
- Q: Why does a guest get asked to sign in partway through booking, not at the start?
  A: Guests can browse dates and start filling out the form freely. They're only asked to verify their identity right before the booking is actually submitted — though they can also sign in any time from the "Sign In" link.
- Q: What sign-in options do guests have?
  A: A one-time code sent to their email, or Google. Facebook is not offered.
- Q: Can I edit my profile from the dashboard?
  A: Yes — open the account menu at the bottom of the sidebar and choose **Profile**. It is the same info as the guest account profile on explore.
- Q: I already set up a host account with this email. Why am I not sent through setup again?
  A: Each email is one host account. Sign-in opens your existing workspace. You cannot create a second organization with the same email.
- Q: I signed in with Google but the page says it could not load my workspace.
  A: Refresh and try again. Sign-in worked; the workspace list did not load.

---

## Implementation map

| Concern                            | Path                                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth layout (host panel)           | `ui/src/features/guest/auth/components/AuthLayout.tsx`                                                                                                                                                   |
| Host workspace side panel (shared) | `ui/src/features/guest/marketing/shared/components/HostWorkspaceSidePanel.tsx` — also used by onboarding (`OnboardingFeatureShowcase`)                                                                   |
|                                    | `ui/src/features/guest/auth/context/GuestAuthContext.tsx`                                                                                                                                                |
| Session / OTP / OAuth (shared)     | `ui/src/features/guest/auth/hooks/useGuestSession.ts`                                                                                                                                                    |
|                                    | `ui/src/features/guest/auth/hooks/useGuestAuthActions.ts` (used by both audiences)                                                                                                                       |
| OAuth resume (checkout modal)      | `ui/src/features/guest/auth/lib/guestAuthResume.ts`                                                                                                                                                      |
| Calendar / Reserve / Save gates    | `ui/src/features/guest/calendar/pages/CalendarPage.tsx`, `ui/src/features/guest/marketing/properties/hooks/usePropertyReserve.ts`, `ui/src/features/guest/marketing/properties/hooks/usePropertySave.ts` |
| Form gate                          | `ui/src/features/guest/form/components/GuestForm.tsx`                                                                                                                                                    |
| Unified auth page content          | `ui/src/features/guest/auth/components/AuthPageContent.tsx` (email OTP two-step + `OtpCodeInput.tsx` + `GoogleSignInButton`)                                                                             |
| Host standalone pages              | `ui/src/features/guest/auth/pages/HostAuthPages.tsx` (`HostLoginPage`, `HostRegisterPage`)                                                                                                               |
| Host OTP + OAuth + redirect hook   | `ui/src/features/guest/auth/hooks/useHostGoogleAuth.ts`                                                                                                                                                  |
| Guest standalone pages             | `ui/src/features/guest/auth/pages/GuestAuthPages.tsx` (`GuestLoginPage`, `GuestRegisterPage`)                                                                                                            |
| Guest OTP + OAuth + redirect hook  | `ui/src/features/guest/auth/hooks/useGuestAuthPage.ts`                                                                                                                                                   |
| Auth page config                   | `ui/src/features/guest/auth/config/auth-page-config.ts` (`AUTH_PAGE_CONFIG.host` / `.guest`)                                                                                                             |
| Path helpers                       | `ui/src/features/guest/auth/lib/hostAuthPaths.ts`, `ui/src/features/guest/auth/lib/guestAuthPaths.ts`, `ui/src/features/guest/auth/lib/authRedirect.ts` (shared `safeRedirect`)                          |
| Nav mode/CTA helpers               | `ui/src/features/guest/auth/config/auth-navigation.ts` (`getAuthAudienceFromPath`, `getHostMarketingNavCta`, `getGuestLoginCta`), `ui/src/features/guest/auth/config/mode-switch.ts`                     |
| Marketing nav sign-in CTA          | `ui/src/features/guest/marketing/shared/components/MarketingNav.tsx`                                                                                                                                     |
| Dashboard account menu + profile   | `ui/src/features/dashboard/bookings/components/AdminLayout.tsx` (`AdminProfileFooter`), `ui/src/features/guest/account/components/GuestProfileModal.tsx`, `useAccountIdentity.ts`                        |
| Auth routes                        | `ui/src/features/guest/auth/routes/index.tsx`                                                                                                                                                            |
| Dashboard edge JWT                 | `ui/src/features/dashboard/org/lib/edgeClient.ts` (`getSessionJwt`)                                                                                                                                      |

`getSessionJwt` reuses the cached access token and refreshes only when it is near expiry (single-flight). Do not call `refreshSession()` on every edge request: hosted Auth rate-limits `/token` (`over_request_rate_limit`) and a 429 can sign the user out.

---

## Env / Supabase

- **Google OAuth:** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (host + guest)
- Email OTP must be enabled in the Supabase Auth dashboard for hosted projects (both audiences depend on it)
- **Turnstile CAPTCHA (optional):** `VITE_TURNSTILE_SITE_KEY` (UI) + `TURNSTILE_SECRET_KEY` (edge). Local: add the secret to `ui/.env.development`, set `VITE_TURNSTILE_SITE_KEY`, flip `[auth.captcha] enabled = true` in `supabase/config.toml`, restart. Hosted: Dashboard → Authentication → Attack Protection → enable Turnstile with the secret. Test keys in [`validation-and-env.md`](../../architecture/validation-and-env.md) §11.
- Facebook OAuth was removed — `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` and the `[auth.external.facebook]` block in `supabase/config.toml` no longer exist. Not supported; do not reintroduce it.

---

## Testing

| Layer | Path / spec                                                                                            | Manual                           |
| ----- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Unit  | OTP/reserved-name validators when touched; `_shared/cors_test.ts` (PostHog tracing + loopback origins) | —                                |
| E2E   | `ui/e2e/features/auth/authPagesSmoke.spec.ts`, `authRedirectSmoke.spec.ts` (`@smoke` / `@ci`)          | Google OAuth, real email OTP     |
| N/A   | —                                                                                                      | Turnstile live, Facebook removed |

---

## Related docs

- [For hosts](./for-hosts.md)
- [Calendar](./calendar.md)
- [Route index](./README.md)

---

## Pending / follow-ups

None currently open.
