---
title: 'Guest landing — operator guide'
status: active
tags: [guides, routes]
updated: 2026-09-11
---

# Guest landing — operator guide

Route: `/`

> **Status:** Documented — **Phase 1 (UI only)**. Redesigned guest explore landing; mock data; no public API yet.

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                 |
| ---------------- | -------- | ---------- | ---------- | ----------------------------------------------------- |
| Hero + search    | —        | —          | Documented | Search-first; optional dates                          |
| Interactive hero | —        | —          | Documented | Canvas + stacked stay cards (theme-aware)             |
| Stay categories  | —        | —          | Documented | Quick-filter chips → `/properties`                    |
| Featured stays   | —        | —          | Documented | Horizontal scroll carousel                            |
| Destinations     | —        | —          | Documented | 3 editorial destination tiles                         |
| Social proof     | —        | —          | Documented | Single review + trust stats                           |
| Preview redesign | —        | —          | Documented | `/explore-preview` — cinematic redesign, pending swap |
| Mobile shell     | —        | —          | Documented | `MarketingLayoutShell` bottom tabs — see below        |

---

## Overview

Public **guest explore home**. Wrapped in **`MarketingLayoutShell`** (nav, footer, theme toggle). Operational booking calendar lives at **`/properties/:propertySlug/calendar`**.

**Browser tab title:** `Kame Homes - Home`. The HTML fallback before React hydrates is `Kame Homes` (never `Stays`).

**Mobile shell (2026-09-10):** `MarketingLayoutShell` renders a 5-tab `BottomTabBar` (Explore/Properties/Parkings/Account/More, via `MarketingBottomNav.tsx`) on phone/tablet, replacing the old hamburger + full-screen overlay menu. **More** opens `MarketingMoreSheet` (For hosts/Company/Legal links, theme toggle, `ModeSwitcher`, **Dashboard** when signed in, sign out). Top header stays fixed but is logo-only below `lg` — nav links/CTA/account move into the tab bar + sheet. This shell applies uniformly across every route under `MarketingLayoutShell` (this landing page, `/for-hosts*`, `/properties*`, `/parkings*`, `/developments*`, `/services`, `/about`, `/contact`, `/support`, legal pages, `/account/*`) — see [for-hosts.md](./for-hosts.md) and the `mobile-responsive` skill/rule §2b for the full pattern rather than repeating it on every page.

**Legacy compat:** `/?property=<slug>` redirects to **`/properties/<slug>/calendar`**.

### Design intent (vs template clutter)

Inspired by Airbnb/Agoda search-first patterns, but avoids common pain points:

- **Search is primary** — no promo banners blocking the hero
- **Progressive disclosure** — fewer sections; no long how-it-works / testimonial carousel on home
- **Visual hierarchy** — photography-led cards, horizontal scroll for stays (scan-friendly)
- **Optional dates** — guests can search by destination only
- **Light + dark** — semantic tokens + theme-aware hero canvas

---

## Host-facing knowledge

This is the main guest homepage: search, featured stays, and destination tiles that send people into the property catalog. Hosts rarely land here unless they switch back to "explore" mode.

**Common host questions**

- Q: Will my listing appear on the home page automatically?
  A: Not yet. Featured cards still use sample data until the public catalog is connected to live published properties.
- Q: How do guests get from here to my property?
  A: They search or tap a destination, browse the homes catalog, open your listing, then reserve or contact you from there.
- Q: Where does "Become a host?" take someone?
  A: It switches to host mode and the host marketing page, then sign-in. It doesn't go straight into your dashboard.
- Q: How do I get back to the host dashboard from explore?
  A: Open the avatar menu (desktop) or **More** (phone) and tap **Dashboard**.

---

## Sections

| Section        | Component             | Behavior                                                                                                                                                       |
| -------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero           | `GuestHero`           | Split layout: search + category chips. Chips are a horizontal snap-scroll strip below `sm` (hidden scrollbar, `snap-x`) and wrap to multiple rows from `sm` up |
| Hero animation | `HeroCanvas`          | Pointer-reactive canvas + card stack                                                                                                                           |
| Search bar     | `HeroSearch`          | Where / dates / guests → `/properties`                                                                                                                         |
| Featured stays | `FeaturedProperties`  | Live catalog in a horizontal snap-scroll; hidden if empty                                                                                                      |
| Destinations   | `PopularDestinations` | 3 large editorial tiles                                                                                                                                        |
| Trust + review | `LandingSocialProof`  | Compact stats + one guest quote                                                                                                                                |

Removed from home (still in codebase for reuse): `HowItWorks`, `Testimonials`, `TrustIndicators`, `FeaturedDevelopments`.

---

## Preview redesign — `/explore-preview`

A ground-up redesign of the guest explore landing, served at **`/explore-preview`** for manual review before it replaces `/`. Not linked from nav.

Page component `ExplorePreviewPage.tsx`; all sections under `ui/src/features/guest/marketing/explore-preview/`, all copy in `explore-preview/data/explorePreviewContent.ts` (photos, nightly rates, and the guest review are sample content, flagged in a page footnote).

- **Direction:** cinematic arrival + editorial spine. Full-bleed cross-dissolving destination hero with the real `HeroSearch` in a floating console; then an editorial route through stays, a destination mosaic, a 3-step "how a stay comes together" strip, one guest voice, and a brand-gradient closing CTA. No layout family repeats.
- **Constraints honored:** Plus Jakarta Sans only, existing HSL tokens (teal `--primary` the sole accent; gradient only on the closing band), Lucide icons, framer-motion. One authored motion idea (content rises in) plus the hero dissolve and hover zoom; every motion gated on `prefers-reduced-motion`.
- **Reuses:** `HeroSearch` (unchanged), `MarketingLayoutShell` nav + footer.
- **To ship it:** point `/` at `ExplorePreviewPage` (or fold its sections into `GuestLandingPage`), retire the old `guest-landing/` components, drop the `/explore-preview` route, and update this guide.

Sections: `ExploreHero`, `ExploreTrustRibbon`, `ExploreFeaturedStays`, `ExploreDestinationAtlas`, `ExploreStayJourney`, `ExploreGuestVoice`, `ExploreClosingCta`.

---

## Implementation map

| Concern | Path                                                                         |
| ------- | ---------------------------------------------------------------------------- |
| Page    | `ui/src/features/guest/marketing/pages/GuestLandingPage.tsx`                 |
| Content | `ui/src/features/guest/marketing/guest-landing/data/landingContent.ts`       |
| Hero    | `ui/src/features/guest/marketing/guest-landing/components/GuestHero.tsx`     |
| Canvas  | `ui/src/features/guest/marketing/guest-landing/components/HeroCanvas.tsx`    |
| Layout  | `ui/src/features/guest/marketing/shared/components/MarketingLayoutShell.tsx` |
| Routes  | `ui/src/features/guest/marketing/routes/index.tsx`                           |

---

## Pending / follow-ups

- [ ] Wire hero search to real property list filters / API
- [ ] Replace mock featured cards with live published properties
- [ ] Re-introduce developments block when catalog API exists (secondary section)
