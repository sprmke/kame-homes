---
title: 'For hosts — operator guide'
status: active
tags: [guides, routes]
updated: 2026-10-03
---

# For hosts — operator guide

Route: `/for-hosts` · `/for-hosts/pricing` · `/for-hosts/preview` (ground-up redesign, pending swap) · `/for-hosts/v3` (third direction, pending review)

> **Status:** Documented — **Phase 1 (UI only)** for the landing tour; **pricing** is live from the plan catalog. **`/for-hosts/preview`** holds a full redesign of the landing page awaiting sign-off before it replaces `/for-hosts`. **`/for-hosts/v3`** is a third direction for side-by-side comparison.

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                                                                                      |
| ---------------- | -------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Hero + tour      | —        | —          | Documented | ~2m 52s, 26-chapter tour (intro + 24 features + outro)                                                                     |
| How it works     | —        | —          | Documented | Four-step host onboarding                                                                                                  |
| Host reviews     | —        | —          | Documented | Mock host quote carousel                                                                                                   |
| Host pricing     | —        | —          | Documented | `/for-hosts/pricing` — live Free→Managed ladder + compare matrix (no Commission)                                           |
| Host CTAs        | —        | —          | Documented | → `/for-hosts/login` (Google OAuth / email OTP); Managed → `/contact`                                                      |
| Preview redesign | —        | —          | Documented | `/for-hosts/preview` — editorial hero, animated workflow rail, sticky feature showcase; swap to `/for-hosts` when approved |
| V3 redesign      | —        | —          | Documented | `/for-hosts/v3` — photo hero with live booking card, struck-through tools statement, pinned six-stage workflow, bento, FAQ |
| Mobile shell     | —        | —          | Documented | `MarketingLayoutShell` bottom tabs (host mode) — see [index-landing.md](./index-landing.md) § Mobile shell                 |

---

## Overview

Host acquisition landing (PMA `(marketing)/for-hosts`). The page opens with the platform value proposition and an in-browser, video-like dashboard tour, then capability stats, host onboarding steps, and host reviews.

**Browser tab title:** `Kame Homes - For Hosts` (`/for-hosts/pricing` is `Kame Homes - Pricing`). HTML fallback is `Kame Homes`.

**Pricing** lives on **`/for-hosts/pricing`**. It loads the **active subscription** `pricing_plans` catalog via **`list-public-pricing-plans`** (same ladder as property Plans — Free, Starter, Pro, Business, Managed; excludes **Commission** and org-only **Business Plus**) and renders the shared **`PlanTierRail`** + **`PlanFeatureMatrix`** from `planPresentation.ts` (discounted prices, promo badges, incremental feature bullets). The compare matrix stays inside the page width on phone and scrolls sideways inside the panel. Plan CTAs go to **`/for-hosts/login`**; **Managed** goes to **`/contact?category=business_inquiry&subject=Managed%20plan%20inquiry`** (same ticket flow as Help & Support). Footer **Pricing** and host-mode nav **Pricing** link here. Legacy **`/for-hosts#pricing`** redirects to the pricing page.

**Keep in sync:** when you change `pricing_plans` seeds/super-admin catalog prices or `planPresentation.ts` copy (including entitlements such as **`marketingStudio`** — Content Studio edit & download is **Pro+** as of `20261210120200`; **`marketingPublishLimitPerGroup`** — Publish in Meta platforms is **Business+** as of `20261210120400`; **`propertyShowcase`** — Showcase templates **Pro+**; **`customPages`** — Public Pages gallery & editor explore-open on Free+ (`20261212120000`); **`publicPagesAutosave`** — save/autosave **Pro+** as of `20261210120000`; **`calendarSync`** — Airbnb two-way iCal sync **Pro+** as of `20261213120300`; **`smartPricing`** — Smart Pricing (AI dynamic nightly rates) **Pro+** as of `20261305120200`), verify this page — see **`docs/architecture/plans-feature-matrix.md`** § Public marketing page and **`.cursor/rules/documentation-maintenance.mdc`**.

The **~2m 52s tour** uses Remotion Player and **26 chapters**: an intro title card, **24 feature chapters**, and an outro call to action. Chapters are joined by `@remotion/transitions` CSS `fade` cuts (15 frames within an act, 20 at act boundaries). Slides are not used: the player advances at 30fps, so a full-frame slide moves ~60px per step and reads as a stutter. `dissolve` is avoided because it needs Chrome's HTML-in-Canvas API. Order and acts:

| Act            | Chapters                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hook           | **Intro** ("Your rentals, run for you", the property dashboard rises into view)                                                                        |
| Get started    | **Setup guide** · **Portfolio** (org dashboard) · **Property dashboard**                                                                               |
| Bookings       | **Booking workflow** · **Kanban board + New booking** · **AI import** · **Airbnb sync**                                                                |
| Money          | **Pricing + Smart Pricing** · **Finance** · **Maintenance** · **Analytics + AI review**                                                                |
| Guests         | **Guest Inbox** (AI suggested reply) · **AI voice receptionist** · **Public Pages** (editor) · **Guest booking page** · **Guest stay** · **Templates** |
| Marketing      | **Content Studio** (Calendar / Design / Video) · **AI photos and AI Post** · **AI video**                                                              |
| Team & control | **Team & roles** · **Telegram notifications** · **AI mode** · **Plans & billing**                                                                      |
| Close          | **Outro** (feature recap chips + **Start free**)                                                                                                       |

**Fidelity:** every scene renders inside `FilmShell`, a copy of the real desktop `AdminLayout`: `bg-sidebar` rail with the tenant scope on top, the current property / org nav (property nav includes **Analytics**; billing is org-only, so **Plans & Billing** and **Announcements** appear only in the org nav), the solid `bg-primary` active pill, the **Finish setup** entry, the account footer, and an `AdminPageHeader`-style title row. No desktop top bar. Scenes use the app's **design tokens** (`bg-card`, `border-border`, `bg-primary`, `text-muted-foreground`, `shadow-card`), so the film follows the design system and dark mode automatically. Shared classes with viewport breakpoints (for example `.surface-card`, which goes borderless under `max-lg`) are **not** used: the player is scaled, so viewport media queries would restyle the film on phones. Labels mirror the app (booking statuses from `STATUS_LABELS`, Kanban / Table toggle, Smart Pricing strength, AI Studio **AI Post / Photo / Video**, looks, camera moves). Plan tiers on the Plans chapter follow `plans-feature-matrix.md` and show **no prices** (prices are live from the catalog). Demo data is consistent across chapters (Monaco 2604, October 2026 calendar starting on a Thursday, Kyle Santos Oct 14 – 17, Ana Lim Oct 21 – 23). The receptionist chapter uses the real mascot assets (`/avatars/receptionist-turtle-idle.png`, talk loop while Kame speaks). Listing "photos" are inline SVG illustrations (`PhotoTile`), so the film never loads network images.

**Guest-side chapters:** the tour is not only the dashboard. Right after the Public Pages editor, two chapters show what guests see. **Guest booking page** runs in a browser window (not the admin shell): search results for the area (wishlist heart, rating, nightly price) → the listing page (photo gallery, amenities, reviews, host card with **Contact host**) → the booking card date picker (taken nights struck through, nightly breakdown, cleaning fee, **Total**) → **Reserve** opens the guest form with its real steps (Stay, Guest, Pets, Parking, Payment). **Guest stay** shows three phones: the token-gated **stay guide** (Stay pass, Wi-Fi, door code, parking), **web chat** with the host (lands in the Guest Inbox) with **Talk to receptionist**, and the **check-out** flow (star review + tags → slot-machine voucher reveal → saved to the guest's Vouchers; refund step follows). Showcase templates are covered by the Public Pages chapter.

**Motion language:** each scene sits on a soft stage and an eased **camera** (`FilmScene` keyframes) pushes toward the part of the screen the line is about, then holds still. Each move spans the whole gap between keys with a sine in-out ease, and every key resolves to a final pose up front (so the edge clamp never kinks a move). While the camera moves, the window gets `will-change: transform` plus a one-frame linear `transition`, so the compositor fills the in-between display frames instead of stepping at 30fps and text is not re-rasterised every frame; when it settles the hint is dropped and text re-renders crisp. The cursor and the intro rise use the same trick. No `backdrop-filter` or `blur` filters sit over or inside the moving window (stage glows are radial gradients). A lower-third **caption** (eyebrow + 2 to 5 words, from the chapter's `caption`) carries the story when narration is muted; focal UI is kept above the caption band. Cursor glides with a click ring, `reveal` / `popIn` entrances, counters, and chart wipes are all monotonic ease-outs (no spring overshoot, no CSS keyframes, which the player cannot drive frame-accurately). Narration starts `HOST_TOUR_NARRATION_START_DELAY` frames into each chapter, and each chapter lasts its voice line plus ~1.8s, so lines never overlap. Chapters auto-advance and loop; hosts can pause, restart, or jump to a feature from the strip (intro and outro are not on the strip). On `/for-hosts` and `/for-hosts/preview` the player card width is capped from the height left under the nav, so the full frame (including the caption) fits a laptop screen. Chapter chips keep their labels and scroll sideways. From `sm` up, back/forward arrows appear at whichever edge has more chips, and the active chip scrolls into view as the tour advances. A **Full view** button next to Restart opens the same **Workspace preview** modal that the compact player uses. Playback, position, and narration carry over both ways. `prefers-reduced-motion` disables autoplay and holds each chapter on a static frame. Composition code lives under `ui/src/features/guest/marketing/for-hosts/components/film/` (`FilmShell`, `FilmPrimitives`, `scenes/Scene{Bookends,Start,Bookings,Money,Guests,GuestSite,Marketing,Team}.tsx`, keyed by chapter id in `scenes/filmScenes.ts`, assembled by `HostDashboardFilm`). Chapter copy, captions, lengths, and transitions live in `data/hostTourChapters.ts`; `HOST_TOUR_FEATURE_COUNT` feeds the "N features" page copy. `hostTourChapters.test.ts` checks that chapters, narration, and MP3s line up, that every voice line fits its chapter, and that captions stay short with no dash clause breaks.

**Dark mode:** the film is theme-aware. Remotion Player renders inline in the DOM, so the global `.dark` class on `<html>` (set by `ThemeProvider`) cascades into every scene — scenes are built on theme tokens, so they switch with the app; status tints carry `dark:` text variants. Listing illustrations, the Content Studio calendar poster, and the receptionist mascot stay as-is on purpose, like embedded photos. Both `variant="marketing"` (this page + `/for-hosts/preview`) and `variant="compact"` (`HostWorkspaceSidePanel` on `/for-hosts/login`, `/for-guests/login`, onboarding) follow the viewer's theme with no per-call config.

**Narration:** each chapter has a pre-generated Edge TTS MP3 under `ui/public/marketing/for-hosts/narration/{chapterId}.mp3`, played via Remotion `<Audio>` inside that chapter's `Sequence`. Narration starts **muted** (browser autoplay policy) and an unmute control sits next to pause/play. Muting is passed into the composition as `inputProps.narrationMuted` rather than `Player.initiallyMuted` — a Player that mounts muted and unmutes later crashes Remotion's shared audio tags (fixed upstream in 4.0.498; the composition-level flag also keeps the audio pool stable). Audio follows the transport: pausing pauses narration, seeking a chapter restarts that chapter's line. Visible chapter title/description and `aria-live` still carry the meaning without relying on voice. Lines are short and plain (one idea each, about 10 to 15 words). Voice: Edge TTS `en-US-AvaMultilingualNeural` at `+4%`. Regenerate with `bun scripts/marketing/generate-host-tour-narration.ts` (requires `edge-tts`; `ffprobe` records each clip's length in `manifest.json`, and stale chapter files are removed). After changing a line, re-check the chapter's `durationInFrames` (the unit test fails if a line no longer fits).

Host-mode navigation replaces the explore links with **Features**, **How It Works**, **Reviews** (anchors on `/for-hosts`; from other host marketing routes they link back to `/for-hosts#…`), and **Pricing** → **`/for-hosts/pricing`**. Anchor targets use smooth scrolling unless reduced motion is enabled. Host marketing routes under **`/for-hosts/*`** share host-mode chrome but only the landing page defines the Features / How It Works / Reviews sections.

**CTA difference from PMA:** When signed out, host marketing shows solid **Explore** (mode switch) + outlined **Sign In** → **`/for-hosts/login`**. The solid pill is brand primary (teal) in light and dark, on both the transparent and scrolled header. When signed in, **Explore** + avatar menu (**Dashboard** → **`/org`**, then the hub opens an organization you can access; log out). Explore marketing keeps **Become a host?** + guest avatar when signed in. Same primary fill.

**Mode switch:** One global curtain (`ModeSwitchTransitionProvider` in `App.tsx`) covers every explore ↔ host crossing so the overlay survives layout remounts:

- Explore → host: marketing nav **Become a host?**, footer **Become a Host**, explore avatar menu (and mobile **More** sheet) **Dashboard** — always shown when signed in; lands on org dashboard, not `/for-hosts`
- Footer **Pricing** → **`/for-hosts/pricing`**
- Host → explore: admin account menu **Explore / Host** switcher, marketing logo on `/for-hosts`, host-auth mobile logo

The curtain closes over 500 ms, holds the Kame Homes wordmark for 350 ms, then reopens over 500 ms. Brand color comes from the listing **`brandColor`** on property/parking pages, scoped admin/property CSS vars on dashboard pages, otherwise default Kame teal.

---

## Preview redesign — `/for-hosts/preview`

A ground-up rebuild of the landing page, served at **`/for-hosts/preview`** for review before it replaces `/for-hosts`. Page component `ForHostsPreviewPage.tsx`; all sections live under `ui/src/features/guest/marketing/for-hosts/preview/` and all copy is in `preview/data/hostShowcase.ts`. Constraints honored: **Plus Jakarta Sans only** (no second family), existing HSL tokens (teal `--primary` the sole accent, no gradient band except the closing section), Lucide icons, framer-motion. Motion is scroll-reveal + one hero settle + the workflow-rail draw + the sticky-showcase cross-fade only; all gated on `prefers-reduced-motion`. Section ids `features` / `how-it-works` / `reviews` are unchanged so the host-mode nav anchors still resolve.

Section order and behavior:

| Section          | id             | Notes                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editorial hero   | `top`          | Asymmetric: copy left, a real booking-pipeline **board** right (`HeroPipelineBoard`) with the teal "thread" down the six-stage spine. Static radial wash only — the animated particle/grid canvas (`AbstractBackground`) is dropped. CTAs: **Start free** → `/for-hosts/login`; **Watch the tour** scrolls to `#features`.                                                                         |
| Proof line       | —              | One sentence + three integration names (Airbnb sync · Meta inbox · AI receipt checks). Replaces the four vanity stat numbers (`HostCapabilityStrip`).                                                                                                                                                                                                                                              |
| Workflow rail    | `workflow`     | Horizontal six-stage rail (`WorkflowSpine`) that draws itself once on scroll-in via `useInView`; "Documents" carries an amber "needs you" marker.                                                                                                                                                                                                                                                  |
| Feature showcase | `platform`     | Sticky `BrowserFrame` (desktop) that swaps one of six token-based demo panels (`showcase/ShowcaseDemos.tsx`, mapped in `showcaseDemoRegistry.ts`) as six story blocks scroll past — active index from an IntersectionObserver (`useActiveIndex`). Mobile stacks each story above its demo. Ends with **See all {HOST_TOUR_FEATURE_COUNT} features in the full tour** (currently 24) → `#features`. |
| Video tour       | `features`     | Reuses `HostDashboardTourPlayer variant="marketing"` (the 26-chapter Remotion tour) under **Every feature, in under three minutes**.                                                                                                                                                                                                                                                               |
| Setup steps      | `how-it-works` | Four numbered moves (`SetupSteps`).                                                                                                                                                                                                                                                                                                                                                                |
| Host reviews     | `reviews`      | Reuses the existing `HostReviews` carousel unchanged.                                                                                                                                                                                                                                                                                                                                              |
| Closing CTA      | —              | Flat solid-teal section (`ClosingCta`), no mascot/texture. **Create account** + **View pricing**.                                                                                                                                                                                                                                                                                                  |

**To ship it:** point the `/for-hosts` route at `ForHostsPreviewPage` (or fold these sections into `ForHostsPage`), delete the old `Host*` landing components and the `preview/` folder's `preview`-name wrappers, and drop the `/for-hosts/preview` route. Then update this guide's Progress overview and Implementation map.

## V3 redesign — `/for-hosts/v3`

A third landing direction, served at **`/for-hosts/v3`** (not linked from nav) so it can be compared with `/for-hosts` and `/for-hosts/preview`. Page component `ForHostsV3Page.tsx`; sections live under `ui/src/features/guest/marketing/for-hosts/v3/components/` and all copy and sample data are in `v3/data/hostLandingV3.ts`. Same constraints as the preview (Plus Jakarta Sans, HSL tokens with teal `--primary` as the only accent, Lucide, framer-motion). It reuses the preview's `Reveal`, `BookingsDemo`, and `Pill`/`Chip`/`KpiTile` primitives plus the narrated tour player. Story order: promise, pain, mechanism, breadth, proof, setup, objections, close.

| Section           | id             | Notes                                                                                                                                                                                                                                                                                                                 |
| ----------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero              | `top`          | Two-line headline, one-line lead, **Start free** → `/for-hosts/login`, **Watch the tour** → `#tour`. Right side is real property photography with scroll parallax and a sample booking card that steps through four workflow statuses every ~2.6s while on screen (paused under reduced motion).                      |
| Replace statement | —              | Large statement: "Right now a booking lives in a spreadsheet, the Airbnb tab, three Messenger threads, and a receipt folder." Each tool is struck through in turn as the section scrolls (scroll-linked, background-gradient strike so it wraps on phones), then "Kame Homes puts it on one card." fades in.          |
| Pinned workflow   | `how-it-works` | `lg+`: the section pins for ~4 viewports and scroll moves one sample booking through the six real stages; the left rail fills and expands the current stage, the card swaps its status pill and grows an activity log ("Documents" shows a **You approved** step). Below `lg`: a plain vertical timeline, no pinning. |
| Feature bento     | `features`     | Six tiles: bookings board (live `BookingsDemo`), AI receptionist (turtle loop video + chat pair that animates in), rates on the calendar, finance (KPI + line chart that draws in), marketing (Instagram-style post with photo), team roles (full-width chip strip). Mouse-only cursor spotlight via CSS variables.   |
| Tour              | `tour`         | `HostDashboardTourPlayer variant="marketing"`, scales from 92% to full size as it scrolls in.                                                                                                                                                                                                                         |
| Setup             | `get-started`  | Four steps with icons; a rail draws across on desktop, swipeable scroll-snap cards on phones.                                                                                                                                                                                                                         |
| FAQ               | `faq`          | Six questions (card, Airbnb, imports, team, phone, billing) in an accordion; sticky heading on desktop with **Ask us anything** → `/contact`.                                                                                                                                                                         |
| Closing CTA       | —              | Photo panel with graphite scrim (no green-on-green), **Start free** + **View pricing**.                                                                                                                                                                                                                               |

All motion is gated on `prefers-reduced-motion` (static strike, no card cycling, no parallax or scale). There is no reviews section, so the nav's **Reviews** anchor does not resolve on this route; drop that nav link or add a section before swapping v3 in.

The pinned workflow and sticky FAQ depend on `MarketingLayoutShell` using `overflow-x-clip` (not `overflow-x-hidden`, which turns the shell into a scroll container and silently disables `position: sticky` for every marketing page, including the preview's sticky showcase).

---

## Host-facing knowledge

This is the marketing page that introduces the platform to property owners before they sign up. It walks through what the dashboard can do without requiring an account.

**Common host questions**

- Q: Can I try the dashboard without signing up?
  A: You can watch the interactive tour on this page to see how everything works, but you'll need to sign in with Google to access your own dashboard.
- Q: What does the tour cover?
  A: Setup, bookings, Airbnb sync, pricing with Smart Pricing, finance, maintenance, analytics, the guest inbox, the AI receptionist, public pages, what guests see (search, your booking page, the stay guide, chat, and the review and voucher step), email templates, the Content Studio with AI photos and AI video, team roles, Telegram alerts, AI mode, and plans. Use the strip under the video to jump to any of them.
- Q: Are the screens in the tour real?
  A: They are faithful recreations of the dashboard with sample data, so what you see matches what you get after you sign up. Some features need a paid plan; the Plans page shows which.
- Q: Why is the narration muted when the tour starts?
  A: Browsers block sound from auto-playing, so tap the unmute button next to the play controls to hear the narration.
- Q: I'm signed in as a guest, how do I get to my host dashboard?
  A: Use **Dashboard** in the explore avatar menu (under **Host**) or in the phone **More** sheet. That opens the org dashboard. **Become a host?** opens host marketing first.

---

## Implementation map

| Concern                | Path                                                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                   | `ui/src/features/guest/marketing/pages/ForHostsPage.tsx`                                                                                                                                                                                           |
| Pricing page           | `ui/src/features/guest/marketing/pages/ForHostsPricingPage.tsx`                                                                                                                                                                                    |
| Public plans hook      | `ui/src/features/guest/marketing/for-hosts/hooks/usePublicPricingPlans.ts`                                                                                                                                                                         |
| Shared tier UI         | `PlanTierRail` / `PlanFeatureMatrix` / `planPresentation.ts` (dashboard plans module)                                                                                                                                                              |
| Public plans API       | `supabase/functions/list-public-pricing-plans/`                                                                                                                                                                                                    |
| Landing closing CTA    | `ui/src/features/guest/marketing/for-hosts/components/HostClosingCta.tsx`                                                                                                                                                                          |
| Shared public sections | `ui/src/features/guest/marketing/shared/components/MarketingPublic*.tsx` (hero, content, section heading, icon card, callout, FAQ)                                                                                                                 |
| Host landing sections  | `ui/src/features/guest/marketing/for-hosts/components/**`                                                                                                                                                                                          |
| Preview redesign page  | `ui/src/features/guest/marketing/pages/ForHostsPreviewPage.tsx`                                                                                                                                                                                    |
| Preview sections       | `ui/src/features/guest/marketing/for-hosts/preview/components/**` (`HeroEditorial` + `HeroPipelineBoard`, `ProofLine`, `WorkflowSpine`, `FeatureShowcase` + `showcase/**`, `VideoTourSection`, `SetupSteps`, `ClosingCta`, `Eyebrow`, `Reveal`)    |
| V3 redesign page       | `ui/src/features/guest/marketing/pages/ForHostsV3Page.tsx`                                                                                                                                                                                         |
| V3 sections + copy     | `ui/src/features/guest/marketing/for-hosts/v3/components/V3{Hero,ReplaceStatement,WorkflowScroll,FeatureBento,TourSection,SetupSteps,Faq,ClosingCta}.tsx` · `v3/data/hostLandingV3.ts`                                                             |
| Preview copy + demos   | `preview/data/hostShowcase.ts` (all copy) · `preview/components/showcase/{ShowcaseDemos,showcaseDemoRegistry,ShowcasePrimitives,BrowserFrame}.tsx` · `preview/hooks/useActiveIndex.ts`                                                             |
| Tour player            | `ui/src/features/guest/marketing/for-hosts/components/{HostDashboardTour,HostDashboardTourPlayer}.tsx`                                                                                                                                             |
| Tour composition       | `ui/src/features/guest/marketing/for-hosts/components/HostDashboardFilm.tsx` + `components/film/{FilmShell,FilmPrimitives}.tsx` + `components/film/scenes/Scene{Bookends,Start,Bookings,Money,Guests,Marketing,Team}.tsx` + `scenes/filmScenes.ts` |
| Tour timeline + copy   | `ui/src/features/guest/marketing/for-hosts/data/hostTourChapters.ts` (captions, `bookend`, per-chapter `durationInFrames` + transition, `HOST_TOUR_CHAPTER_STARTS`, `HOST_TOUR_FEATURE_COUNT`) + `hostTourChapters.test.ts`                        |
| Tour narration lines   | `ui/src/features/guest/marketing/for-hosts/data/hostTourNarration.ts`                                                                                                                                                                              |
| Narration MP3 assets   | `ui/public/marketing/for-hosts/narration/*.mp3`                                                                                                                                                                                                    |
| Narration generator    | `scripts/marketing/generate-host-tour-narration.ts` (`edge-tts`)                                                                                                                                                                                   |
| Host reviews data      | `ui/src/features/guest/marketing/for-hosts/data/hostTestimonials.ts`                                                                                                                                                                               |
| Host anchor navigation | `ui/src/features/guest/marketing/shared/components/MarketingNav.tsx` host branch + `ui/src/features/guest/marketing/for-hosts/lib/scrollToSection.ts`                                                                                              |
| Mode transition        | Global `ModeSwitchTransitionProvider` in `ui/src/App.tsx` + `ui/src/features/guest/marketing/shared/context/ModeSwitchTransitionContext.tsx` + `ui/src/index.css`                                                                                  |
| Host account menu      | `HostAccountMenu` (Dashboard avatar); pill CTA **Explore**. Explore avatar: `GuestAccountMenu` always includes **Dashboard**. Phone: `MarketingMoreSheet` **Dashboard** when signed in.                                                            |
| Triggers               | `MarketingNav`, `MarketingFooter`, `GuestAccountMenu`, `MarketingMoreSheet`, `ModeSwitcher` (admin account menu), `AuthLayout` mobile logo                                                                                                         |
| Routes                 | `ui/src/features/guest/marketing/routes/index.tsx`                                                                                                                                                                                                 |

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
