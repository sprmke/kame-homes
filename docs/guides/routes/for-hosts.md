---
title: 'For hosts — operator guide'
status: active
tags: [guides, routes]
updated: 2026-09-01
---

# For hosts — operator guide

Route: `/for-hosts` · `/for-hosts/pricing` · `/for-hosts/preview` (ground-up redesign, pending swap)

> **Status:** Documented — **Phase 1 (UI only)** for the landing tour; **pricing** is live from the plan catalog. **`/for-hosts/preview`** holds a full redesign of the landing page awaiting sign-off before it replaces `/for-hosts`.

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                                                                                      |
| ---------------- | -------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Hero + tour      | —        | —          | Documented | ~2m 54s, 19-chapter interactive product tour                                                                               |
| How it works     | —        | —          | Documented | Four-step host onboarding                                                                                                  |
| Host reviews     | —        | —          | Documented | Mock host quote carousel                                                                                                   |
| Host pricing     | —        | —          | Documented | `/for-hosts/pricing` — live Free→Managed ladder + compare matrix (no Commission)                                           |
| Host CTAs        | —        | —          | Documented | → `/for-hosts/login` (Google OAuth / email OTP); Managed → `/contact`                                                      |
| Preview redesign | —        | —          | Documented | `/for-hosts/preview` — editorial hero, animated workflow rail, sticky feature showcase; swap to `/for-hosts` when approved |
| Mobile shell     | —        | —          | Documented | `MarketingLayoutShell` bottom tabs (host mode) — see [index-landing.md](./index-landing.md) § Mobile shell                 |

---

## Overview

Host acquisition landing (PMA `(marketing)/for-hosts`). The page opens with the platform value proposition and an in-browser, video-like dashboard tour, then capability stats, host onboarding steps, and host reviews.

**Pricing** lives on **`/for-hosts/pricing`**. It loads the **active subscription** `pricing_plans` catalog via **`list-public-pricing-plans`** (same ladder as property Plans — Free, Starter, Pro, Business, Managed; excludes **Commission** and org-only **Business Plus**) and renders the shared **`PlanTierRail`** + **`PlanFeatureMatrix`** from `planPresentation.ts` (discounted prices, promo badges, incremental feature bullets). Plan CTAs go to **`/for-hosts/login`**; **Managed** goes to **`/contact?category=business_inquiry&subject=Managed%20plan%20inquiry`** (same ticket flow as Help & Support). Footer **Pricing** and host-mode nav **Pricing** link here. Legacy **`/for-hosts#pricing`** redirects to the pricing page.

**Keep in sync:** when you change `pricing_plans` seeds/super-admin catalog prices or `planPresentation.ts` copy (including entitlements such as **`marketingStudio`** — Content Studio edit & download is **Pro+** as of `20261210120200`; **`marketingPublishLimitPerGroup`** — Publish in Meta platforms is **Business+** as of `20261210120400`; **`propertyShowcase`** — Showcase templates **Pro+**; **`customPages`** — Public Pages gallery & editor explore-open on Free+ (`20261212120000`); **`publicPagesAutosave`** — save/autosave **Pro+** as of `20261210120000`; **`calendarSync`** — Airbnb two-way iCal sync **Pro+** as of `20261213120300`; **`smartPricing`** — Smart Pricing (AI dynamic nightly rates) **Pro+** as of `20261305120200`), verify this page — see **`docs/architecture/plans-feature-matrix.md`** § Public marketing page and **`.cursor/rules/documentation-maintenance.mdc`**.

The ~2m 54s tour uses Remotion Player and **19 variable-length chapters** (8–14s each, with a ~2.5s end-of-scene hold + takeaway line) joined by real `@remotion/transitions` cuts (CSS `fade` for standard cuts, `slide` for act boundaries — `dissolve` is avoided because it needs Chrome's HTML-in-Canvas API and crashes elsewhere): **portfolio** (org dashboard, property + parking) · **command center** (property dashboard) · **booking workflow** · **board** (kanban drag + in-dashboard new booking) · **AI-assisted data import** (upload a spreadsheet, AI maps the columns) · **two-way Airbnb sync** · **pricing** · **finance & reporting** · **maintenance & reporting** · **Guest Inbox** (AI-suggested reply _and_ auto-reply) · **AI voice receptionist** (the animated "Kame" turtle video, a live guest voice call) · **Marketing Content Studio** (Calendar / Design / Video builders, light workspace) · **Public Pages editor** (section nav + form + live preview) · **template management** (edit ⇄ preview per template) · **team & roles** · **Telegram notifications** (light phone) · **plans & billing + verification** · **AI dashboard assistant** (its own chapter — answers from live data, context pickers, jump-to-page) · **Help & Support** (its own chapter — FAQs / guides / announcements / tickets / Ask AI). Each scene is a high-fidelity recreation of the real route it represents (full admin sidebar, real card structures, real flow order). All in-scene motion is monotonic ease-out (no spring overshoot, no per-frame container transforms, no CSS keyframe animations — the player can't drive those frame-accurately), so elements settle smoothly instead of shimmering. Narration for each chapter starts `HOST_TOUR_NARRATION_START_DELAY` frames in (after the incoming transition and the previous line) so two feature voices never overlap. Chapters auto-advance and loop; hosts can pause, restart, or jump directly to a chapter via the strip. Hover and keyboard focus pause playback. `prefers-reduced-motion` disables autoplay and holds each chapter on a static frame. Composition/scene code lives under `ui/src/features/guest/marketing/for-hosts/components/film/` (`FilmShell`, `FilmPrimitives`, `scenes/SceneAct1–5`, assembled by `HostDashboardFilm`); per-chapter length + transition config is in `data/hostTourChapters.ts` (`HOST_TOUR_CHAPTER_STARTS` / `HOST_TOUR_DURATION_IN_FRAMES` drive the player's timing math and the `m:ss` readout — no hard-coded total).

**Dark mode:** the film is theme-aware. Remotion Player renders inline in the DOM, so the global `.dark` class on `<html>` (set by `ThemeProvider`) cascades into every scene — the shell, shared primitives, and all 19 scenes carry `dark:` variants (dark slate surfaces, translucent brand/status tints, adjusted chart/calendar colors). Fixed brand graphics (the Marketing Studio "Calendar" template mock, gradient design/video panels) stay light on purpose, like an embedded image. Both `variant="marketing"` (this page + `/for-hosts/preview`) and `variant="compact"` (`HostWorkspaceSidePanel` on `/for-hosts/login`, `/for-guests/login`, onboarding) follow the viewer's theme with no per-call config.

**Narration:** each chapter has a pre-generated Edge TTS MP3 under `ui/public/marketing/for-hosts/narration/{chapterId}.mp3`, played via Remotion `<Audio>` inside that chapter's `Sequence`. Narration starts **muted** (browser autoplay policy) and an unmute control sits next to pause/play. Muting is passed into the composition as `inputProps.narrationMuted` rather than `Player.initiallyMuted` — a Player that mounts muted and unmutes later crashes Remotion's shared audio tags (fixed upstream in 4.0.498; the composition-level flag also keeps the audio pool stable). Audio follows the transport: pausing pauses narration, seeking a chapter restarts that chapter's line. Visible chapter title/description and `aria-live` still carry the meaning without relying on voice. Regenerate assets with `bun scripts/marketing/generate-host-tour-narration.ts` (requires `edge-tts` on PATH).

Host-mode navigation replaces the explore links with **Features**, **How It Works**, **Reviews** (anchors on `/for-hosts`; from other host marketing routes they link back to `/for-hosts#…`), and **Pricing** → **`/for-hosts/pricing`**. Anchor targets use smooth scrolling unless reduced motion is enabled. Host marketing routes under **`/for-hosts/*`** share host-mode chrome but only the landing page defines the Features / How It Works / Reviews sections.

**CTA difference from PMA:** When signed out, host marketing shows solid **Explore** (mode switch) + outlined **Sign In** → **`/for-hosts/login`**. When signed in, **Explore** + avatar menu (**Dashboard** → **`/org`**, then the hub opens an organization you can access; log out). Explore marketing keeps **Become a host?** + guest avatar when signed in.

**Mode switch:** One global curtain (`ModeSwitchTransitionProvider` in `App.tsx`) covers every explore ↔ host crossing so the overlay survives layout remounts:

- Explore → host: marketing nav **Become a host?**, footer **Become a Host**, explore avatar menu (and mobile **More** sheet) **Dashboard** — always shown when signed in; lands on org dashboard, not `/for-hosts`
- Footer **Pricing** → **`/for-hosts/pricing`**
- Host → explore: admin account menu **Explore / Host** switcher, marketing logo on `/for-hosts`, host-auth mobile logo

The curtain closes over 500 ms, holds the Kame Homes wordmark for 350 ms, then reopens over 500 ms. Brand color comes from the listing **`brandColor`** on property/parking pages, scoped admin/property CSS vars on dashboard pages, otherwise default Kame teal.

---

## Preview redesign — `/for-hosts/preview`

A ground-up rebuild of the landing page, served at **`/for-hosts/preview`** for review before it replaces `/for-hosts`. Page component `ForHostsPreviewPage.tsx`; all sections live under `ui/src/features/guest/marketing/for-hosts/preview/` and all copy is in `preview/data/hostShowcase.ts`. Constraints honored: **Plus Jakarta Sans only** (no second family), existing HSL tokens (teal `--primary` the sole accent, no gradient band except the closing section), Lucide icons, framer-motion. Motion is scroll-reveal + one hero settle + the workflow-rail draw + the sticky-showcase cross-fade only; all gated on `prefers-reduced-motion`. Section ids `features` / `how-it-works` / `reviews` are unchanged so the host-mode nav anchors still resolve.

Section order and behavior:

| Section          | id             | Notes                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editorial hero   | `top`          | Asymmetric: copy left, a real booking-pipeline **board** right (`HeroPipelineBoard`) with the teal "thread" down the six-stage spine. Static radial wash only — the animated particle/grid canvas (`AbstractBackground`) is dropped. CTAs: **Start free** → `/for-hosts/login`; **Watch the 3-minute tour** scrolls to `#features`.                          |
| Proof line       | —              | One sentence + three integration names (Airbnb sync · Meta inbox · AI receipt checks). Replaces the four vanity stat numbers (`HostCapabilityStrip`).                                                                                                                                                                                                        |
| Workflow rail    | `workflow`     | Horizontal six-stage rail (`WorkflowSpine`) that draws itself once on scroll-in via `useInView`; "Documents" carries an amber "needs you" marker.                                                                                                                                                                                                            |
| Feature showcase | `platform`     | Sticky `BrowserFrame` (desktop) that swaps one of six token-based demo panels (`showcase/ShowcaseDemos.tsx`, mapped in `showcaseDemoRegistry.ts`) as six story blocks scroll past — active index from an IntersectionObserver (`useActiveIndex`). Mobile stacks each story above its demo. Ends with **See all 19 features in the full tour** → `#features`. |
| Video tour       | `features`     | Reuses `HostDashboardTourPlayer variant="marketing"` (the 19-chapter Remotion tour), only reframed.                                                                                                                                                                                                                                                          |
| Setup steps      | `how-it-works` | Four numbered moves (`SetupSteps`).                                                                                                                                                                                                                                                                                                                          |
| Host reviews     | `reviews`      | Reuses the existing `HostReviews` carousel unchanged.                                                                                                                                                                                                                                                                                                        |
| Closing CTA      | —              | Flat solid-teal section (`ClosingCta`), no mascot/texture. **Create account** + **View pricing**.                                                                                                                                                                                                                                                            |

**To ship it:** point the `/for-hosts` route at `ForHostsPreviewPage` (or fold these sections into `ForHostsPage`), delete the old `Host*` landing components and the `preview/` folder's `preview`-name wrappers, and drop the `/for-hosts/preview` route. Then update this guide's Progress overview and Implementation map.

---

## Host-facing knowledge

This is the marketing page that introduces the platform to property owners before they sign up. It walks through what the dashboard can do without requiring an account.

**Common host questions**

- Q: Can I try the dashboard without signing up?
  A: You can watch the interactive tour on this page to see how everything works, but you'll need to sign in with Google to access your own dashboard.
- Q: Why is the narration muted when the tour starts?
  A: Browsers block sound from auto-playing, so tap the unmute button next to the play controls to hear the narration.
- Q: I'm signed in as a guest, how do I get to my host dashboard?
  A: Use **Dashboard** in the explore avatar menu (under **Host**) or in the phone **More** sheet. That opens the org dashboard. **Become a host?** opens host marketing first.

---

## Implementation map

| Concern                | Path                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                   | `ui/src/features/guest/marketing/pages/ForHostsPage.tsx`                                                                                                                                                                                        |
| Pricing page           | `ui/src/features/guest/marketing/pages/ForHostsPricingPage.tsx`                                                                                                                                                                                 |
| Public plans hook      | `ui/src/features/guest/marketing/for-hosts/hooks/usePublicPricingPlans.ts`                                                                                                                                                                      |
| Shared tier UI         | `PlanTierRail` / `PlanFeatureMatrix` / `planPresentation.ts` (dashboard plans module)                                                                                                                                                           |
| Public plans API       | `supabase/functions/list-public-pricing-plans/`                                                                                                                                                                                                 |
| Landing closing CTA    | `ui/src/features/guest/marketing/for-hosts/components/HostClosingCta.tsx`                                                                                                                                                                       |
| Shared public sections | `ui/src/features/guest/marketing/shared/components/MarketingPublic*.tsx` (hero, content, section heading, icon card, callout, FAQ)                                                                                                              |
| Host landing sections  | `ui/src/features/guest/marketing/for-hosts/components/**`                                                                                                                                                                                       |
| Preview redesign page  | `ui/src/features/guest/marketing/pages/ForHostsPreviewPage.tsx`                                                                                                                                                                                 |
| Preview sections       | `ui/src/features/guest/marketing/for-hosts/preview/components/**` (`HeroEditorial` + `HeroPipelineBoard`, `ProofLine`, `WorkflowSpine`, `FeatureShowcase` + `showcase/**`, `VideoTourSection`, `SetupSteps`, `ClosingCta`, `Eyebrow`, `Reveal`) |
| Preview copy + demos   | `preview/data/hostShowcase.ts` (all copy) · `preview/components/showcase/{ShowcaseDemos,showcaseDemoRegistry,ShowcasePrimitives,BrowserFrame}.tsx` · `preview/hooks/useActiveIndex.ts`                                                          |
| Tour player            | `ui/src/features/guest/marketing/for-hosts/components/{HostDashboardTour,HostDashboardTourPlayer}.tsx`                                                                                                                                          |
| Tour composition       | `ui/src/features/guest/marketing/for-hosts/components/HostDashboardFilm.tsx` + `components/film/{FilmShell,FilmPrimitives}.tsx` + `components/film/scenes/SceneAct1–5.tsx`                                                                      |
| Tour timeline + copy   | `ui/src/features/guest/marketing/for-hosts/data/hostTourChapters.ts` (per-chapter `durationInFrames` + `transition`, cumulative `HOST_TOUR_CHAPTER_STARTS`)                                                                                     |
| Tour narration lines   | `ui/src/features/guest/marketing/for-hosts/data/hostTourNarration.ts`                                                                                                                                                                           |
| Narration MP3 assets   | `ui/public/marketing/for-hosts/narration/*.mp3`                                                                                                                                                                                                 |
| Narration generator    | `scripts/marketing/generate-host-tour-narration.ts` (`edge-tts`)                                                                                                                                                                                |
| Host reviews data      | `ui/src/features/guest/marketing/for-hosts/data/hostTestimonials.ts`                                                                                                                                                                            |
| Host anchor navigation | `ui/src/features/guest/marketing/shared/components/MarketingNav.tsx` host branch + `ui/src/features/guest/marketing/for-hosts/lib/scrollToSection.ts`                                                                                           |
| Mode transition        | Global `ModeSwitchTransitionProvider` in `ui/src/App.tsx` + `ui/src/features/guest/marketing/shared/context/ModeSwitchTransitionContext.tsx` + `ui/src/index.css`                                                                               |
| Host account menu      | `HostAccountMenu` (Dashboard avatar); pill CTA **Explore**. Explore avatar: `GuestAccountMenu` always includes **Dashboard**. Phone: `MarketingMoreSheet` **Dashboard** when signed in.                                                         |
| Triggers               | `MarketingNav`, `MarketingFooter`, `GuestAccountMenu`, `MarketingMoreSheet`, `ModeSwitcher` (admin account menu), `AuthLayout` mobile logo                                                                                                      |
| Routes                 | `ui/src/features/guest/marketing/routes/index.tsx`                                                                                                                                                                                              |

---

## Testing

| Layer | Path / spec                                                                            | Manual |
| ----- | -------------------------------------------------------------------------------------- | ------ |
| Unit  | `ui/src/features/dashboard/plans/lib/planPresentation.test.ts` (when touched)          | —      |
| E2E   | `ui/e2e/features/public/publicPagesSmoke.spec.ts` landing + pricing (`@smoke` / `@ci`) | —      |
| N/A   | PayMongo checkout                                                                      | Manual |

---

## Related docs

- [Sign-in (legacy redirect)](./sign-in.md)
- [Host auth](./auth.md)
- [Onboarding](./onboarding.md)
- [Route index](./README.md)

---

## Pending / follow-ups

- [ ] Optional public host signup / waitlist if product adds `/register`
- [ ] Replace static copy with CMS or org-specific marketing settings
- [ ] Approve `/for-hosts/preview` redesign and swap it into `/for-hosts` (then remove old `Host*` landing components + the `/for-hosts/preview` route)
