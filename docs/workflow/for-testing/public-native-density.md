---
title: 'Public pages: native element sizing'
status: active
tags: [workflow, ui, mobile, marketing, guest]
updated: 2026-10-21
stage: for-testing
kind: plan
---

# Public pages: native element sizing

**Stage (2026-10-21):** for testing. Code passes are in. Left: a signed-in booking wizard, account pages, and a real iPhone or Android check (safe areas, docked search).

Public pages (marketing shell, listings, listing detail, for-hosts, auth, account, guest
operational flows) read oversized on phone and tablet compared with native apps. The goal is
native density everywhere without `transform: scale` or a smaller root font size.

Branch / worktree: `ui/mobile-native-sizing` (`.claude/worktrees/mobile-native-sizing`).

## Audit (before, measured with Playwright)

Viewport 390×844 unless noted.

| Area                    | Measured                                                                                | Native reference (iOS HIG / Airbnb app)           |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Home hero               | 843px tall (a full screen), `pt-24`; h1 30px                                            | hero + search fit in ~60% of the first screen     |
| Section rhythm          | `py-14` (56px) every section on phone; `py-16`/`py-20` on tablet/desktop (up to 112px)  | 24–32px between sections on phone                 |
| Section titles          | h2 24px phone, 30px tablet, up to 48px desktop (for-hosts)                              | 20–22px phone                                     |
| Marketing h1            | 36px phone (about, contact, for-hosts, pricing); 48–60px tablet; 72px desktop for-hosts | 28px phone, ~34px tablet                          |
| Destination cards       | 429px tall each, 24px titles                                                            | ~1/3 screen per card                              |
| Chips / CTAs / inputs   | 44–52px **visual** height (category chips, Browse all, Start free, auth inputs)         | 32–36px chips, 44px buttons/inputs; 44px hit area |
| Top nav                 | 64px bar, 40px logo tile, 18px wordmark                                                 | 44–56px bar, ~17px title                          |
| Icon cards (about etc.) | `p-6`, 44px icon well, 18px title, 16px body with `leading-relaxed`                     | `p-4`, 32–36px icon, 15px title, 14px body        |
| Listing detail facts    | 40px icon wells, 16px values                                                            | 20px icons inline, 14–15px                        |
| Listing index           | empty ~100px band under the nav, full-width 48px Filters button + a second toolbar row  | one compact toolbar row                           |

The concern is valid. The type scale itself (14px body, 16px root) is fine. The oversizing
comes from three things: (1) generous **vertical rhythm** tuned for desktop, (2) **display
type** applied unchanged on phone/tablet, and (3) **controls drawn at their 44px hit size**
instead of a smaller visual with an expanded hit area. The admin dashboard already solved (3)
with `admin-overflow-trigger` / `settings-action`; public pages have no equivalent tokens.

Calendar (`/properties/:slug/calendar`) and the auth sheet are already close to native and
only need the shared token pass.

## Approach

Rejected: `transform: scale`, `zoom`, or lowering `html { font-size }`. Those shrink
already-correct 14px body text, leave px-based values unscaled, and fight touch targets.

Adopt a **public density token set** in `ui/src/index.css` (`@layer components`), mobile first,
then move shared primitives and page sections onto it.

### Target scale (phone → tablet `md` → desktop `lg`)

| Token                   | Phone                 | Tablet        | Desktop          |
| ----------------------- | --------------------- | ------------- | ---------------- |
| `.public-display`       | 28px / tight          | 36px          | 44px (cap)       |
| `.public-page-title`    | 22px                  | 26px          | 30px             |
| `.public-section-title` | 20px                  | 24px          | 30px             |
| `.public-card-title`    | 15px                  | 16px          | 17px             |
| `.public-lead`          | 15px / snug           | 16px          | 18px             |
| `.public-eyebrow`       | 11px caps             | same          | same             |
| `.public-section-y`     | 32px                  | 48px          | 72px             |
| `.public-hero-y`        | nav + 16px / 32px     | nav + 32 / 48 | nav + 56 / 72    |
| `.public-card-pad`      | 16px                  | 24px          | 24px             |
| `.public-chip`          | 34px visual, 44px hit | 36px          | 36px             |
| `.public-cta`           | 44px                  | 44px          | 44–48px          |
| `.public-icon-well`     | 36px                  | 40px          | 44px             |
| Top nav                 | 56px, 32px logo tile  | 64px          | 80px (unchanged) |

Touch targets stay ≥44px through `::before` hit pads on small visuals, matching
`admin-overflow-trigger`.

## Phases

1. **Tokens.** Add the classes above to `index.css`; document them in the mobile-responsive skill
   / `.cursor/rules/mobile-responsive.mdc` typography table ("Public pages" block) and
   `DESIGN.md`.
2. **Chrome.** `MarketingNav` 56px phone bar + smaller `MarketingBrandLogo`; re-derive every
   `pt-*` that clears the fixed nav. `GuestPublicBrandShell` / `MainLayout` header parity.
3. **Shared marketing primitives.** `MarketingPublicPageHero`, `MarketingPublicSectionHeading`,
   `MarketingPublicPageContent`, `MarketingPublicIconCard`, `MarketingPublicCallout`,
   `MarketingPublicFaqList`, `MarketingFooter`.
4. **Home / explore.** Hero + search, category chips, featured stack, "Stays guests love",
   destination cards (shorter, smaller titles), closing CTA.
5. **Listing indexes.** `/properties`, `/parkings`, `/developments` (+ `/in/:location`): remove the
   empty band, merge Filters + sort + view toggle into one compact row, card spacing.
6. **Listing detail.** Property / parking / development detail: facts grid, host card, section
   headings, reserve bar, similar listings.
7. **For hosts + pricing + company/legal.** `/for-hosts` (and `/v3` preview), `/for-hosts/pricing`,
   about, contact, support, services, legal pages.
8. **Auth + account + guest flows.** `AuthLayout`, `/account/*`, calendar, form, success, trip,
   messages, sd-form, guest-review, parking flows: CTA/input visuals, headings, card padding.
9. **Tablet + desktop pass.** Cap display type, trim 80–112px section padding, check 768 / 1024 / 1440.
10. **Verify + docs.** Re-run the audit script at 375 / 390 / 768 / 1024 / 1440, compare
    screenshots, `bun run type-check`, `lint`, `check:filenames`, `build`. Update the docs below.

## Progress (2026-10-18)

Phases 1–8 landed on `ui/mobile-native-sizing`; phase 9 (tablet/desktop) partially: display cap
44px, for-hosts hero 60px desktop, section padding 72px desktop. Phase 10 checks run (type-check,
lint on changed files, Playwright audit at 375 / 390 / 768 / 1440, no horizontal overflow).

| Page (390px) | Doc height before | After |
| ------------ | ----------------- | ----- |
| `/`          | 3489              | 2338  |
| `/about`     | 2628              | 1978  |
| `/for-hosts` | 2809              | 2205  |
| `/contact`   | 1278              | 1088  |

Also fixed: listing hero search (`/properties`, `/parkings`, `/developments`, `/search`) stayed
blank until the first scroll because the morph measured before the lazy page mounted its anchor.

Remaining: manual QA on a real iPhone / Android (safe areas, docked search in the 56px nav),
stay-guide pages, `/hosts/:orgSlug` hero, `/explore-preview` and `/for-hosts/v3` previews.

## Dashboard ↔ public alignment (2026-10-19)

Compared the dashboard primitives and shell against the public pages. Both already share `Button`,
`Input`, `SelectTrigger`, `Card`, `Badge`, `Tabs` and `BottomTabBar`. Differences fixed:

- Dashboard phone side margin 14px → 16px (`.admin-mobile-main-shell`, `MobileBrandHero`,
  `BookingDetailPage`), matching public `container px-4` and the iOS / Material 16pt margin.
- `public-card-pad` now matches `Card` (16px phone, 24px from `sm`).
- Auth inputs use the shared `Input` height; auth submit matches `native-cta` (48px phone,
  44px from `sm`).
- iOS-only rule renders text fields at 16px so Safari no longer zooms on focus (was "out of scope").

Shared base table lives in `DESIGN.md` §3 and the mobile-responsive skill / rule §4. The dashboard
could not be rendered in this session (local sign-in was blocked), so its numbers come from code;
public pages were measured at 320 / 360 / 375 / 414 / 768 / 1024 / 1280 / 1440 / 1920 / 2560 with no
horizontal overflow and a 1400px content cap on large screens.

## Guest booking flow (2026-10-19)

Audited all guest-form, sd-form, and pay-parking step screens — the last area the plan's
"Remaining" note called out. Unlike the marketing pages, this module was already built close to
native density (small headings, `min-h-[44px]` buttons, compact card padding), so most files
needed no change. Applied the token pass only where a genuine delta existed:

- `GuestForm.tsx`: step-header icon well `flex size-10 ... rounded-lg` → `public-icon-well`
  (36/40/44px scaling instead of a flat 40px); step title `text-base sm:text-lg` → `public-card-title`
  in the non-`compactChrome` branch (the modal-embedded branch keeps its own `text-sm sm:text-base`,
  unchanged).
- `GuestFormSuccess.tsx`: outer wrapper `px-5 py-8 sm:py-10` → `public-section-y`; intro copy →
  `public-lead`; summary card header/body fixed `px-6 py-3` / `p-6` → `public-card-pad`; card title →
  `public-card-title`; nights-count stat `text-2xl` flat → `text-xl sm:text-2xl`; `space-y-8` →
  `space-y-6 md:space-y-8`; trailing `border-t pt-6` → `pt-5` to match the card's own rhythm.
- `PropertyGuestLimitReminder.tsx`: icon well → `public-icon-well` (was already at the phone size,
  now scales at `md`/`lg` too).
- `GuestReviewFeedbackPills.tsx`: pill buttons (`min-h-[44px] ... px-4 py-2`, a flat 44px chip) →
  `public-chip` (34px visual / 44px hit via the `::before` pad, matching marketing filter chips).
- `SdFormReviewSection.tsx`: submit-review CTA `min-h-[48px]` flat → adds `sm:min-h-[44px]` (48px
  phone / 44px from `sm`, the `AuthPageContent` convention).
- `GuestReviewPage.tsx`: two empty/error states `py-16` → `py-12` (was a marketing-scale gutter on
  a one-line message).
- `PayParkingPage.tsx` (legacy redirect screen only — no real form UI lives here): loading/error
  wrapper `p-6 sm:p-8` / `p-8` → `public-card-pad`.

No changes needed (already native/compact, verified by reading each file): `GuestFormStepNavigation.tsx`
(buttons already flat `min-h-[44px]`, matches the `ContextualActionBar` floating-bar convention used
elsewhere — bumping to 48px-phone would be a one-off vs. its siblings), `GuestFormStepper.tsx`,
`GuestFormOptionCard.tsx`, `GuestFormGuestsSection.tsx`, `GuestFormPaymentStepContent.tsx`,
`GuestFormValidIdUpload.tsx` (its `guest-image-upload-dropzone` sizing is content-driven, not chrome),
`GuestFormVoucherPicker.tsx`, `SdFormPage.tsx`, `GuestReviewStarRating.tsx` (already uses the
visual-smaller/hit-larger pattern), `GuestReviewMediaUpload.tsx`, `PayParkingSections.tsx` (its
`form-section` overrides already match `public-card-pad` geometry). Left untouched per "don't
over-shrink delight": the voucher-reveal flow (`VoucherReveal.tsx` and `voucher-reveal/*`) — its
static intro heading and reveal numerals are a celebratory moment, not chrome.

Verification: `bun run type-check` clean, `eslint` on the 7 changed files → 0 errors (pre-existing
`react-hooks/exhaustive-deps` warnings in `GuestForm.tsx` only, unrelated to this change),
`check:filenames` OK, `bun run build` succeeds. Local Supabase wasn't started in this pass (same
limitation noted in the dashboard-alignment entry above), so no Playwright viewport walkthrough —
changes were verified by reading the rendered class output and cross-checking against the shipped
token definitions in `index.css` instead.

## First-screen density (2026-10-19)

Judged by what a phone shows in the first 390x844 screen, not page height. Develop baseline vs this
branch, same local data. Screenshots: viewport-only, light mode.

- **Listing index (`/properties`)**: the sticky `Filters & Sort` bar now also holds the count and the
  view toggle (one 36px row); the separate toolbar row is hidden below `lg` (`ViewModeToggle` is
  shared). Carousel cards on phone are 164px wide with 4:3 photos (`aspect-square` kept from `sm`),
  tighter row titles and gaps. Cards visible in the first screen: 2 -> 9 (counting peeking cards).
- **Listing detail**: `ListingGallery` hero 280px -> 200px on phone (container queries keep 400/500px
  on larger columns); stat wells and facts grid tightened; overview stack gap 20px -> 16px.
- **`/hosts/:orgSlug`**: avatar 112px -> 80px, tighter hero and tab gaps, listing grid is 2 columns
  on phone (`HOST_LISTING_GRID_CLASS`).
- **`/explore-preview`, `/for-hosts/v3`**: section padding and display type moved onto
  `public-section-y` / `public-section-title` / `public-display` (v3 sections 80px -> 40px phone).
- Stay-guide / showcase stay out of scope (own display scale), same as the locked decision in
  `mobile-native-redesign.md`.

Verification: type-check, `eslint` (0 errors) and `bun run build` pass. Visual check: before/after
viewport screenshots at 390x844 for `/`, `/about`, `/for-hosts`, `/contact`, `/properties`,
`/properties/kame-home`, sign-in and the booking gate. The signed-in booking wizard, account pages
and a real-device pass (safe areas, docked search) still need a manual look.

## Out of scope

- Admin dashboard density (already tokenized).
- Remotion social kit and the full-bleed stay-guide showcase templates (own display scale).

## Docs to touch

- `.claude/skills/mobile-responsive/SKILL.md` + `.cursor/rules/mobile-responsive.mdc` (public scale)
- `DESIGN.md` (public density tokens)
- `docs/workflow/for-testing/mobile-native-redesign.md` (inventory note)
- Route guides: N/A for visual density only (no behavior, flow, or validation change)
- `activity-log: N/A — presentation only, no mutations`
- Plans / permissions: N/A — no new capability

## Bottom dock background (2026-10-19)

`mobileFloatingDockClassName` used `bg-background/88` and `supports-[backdrop-filter]:bg-background/72`, which resolved to a transparent background in Chromium and WebKit (also on `develop`), so page text showed through the tab bar. `.mobile-floating-dock` in `ui/src/index.css` now sets `background-color: hsl(var(--background) / 0.92)`. Not yet checked on a real iPhone.

## Cross-app consistency audit (2026-10-19)

Code-level scan of `ui/src` (dashboard, guest, shared primitives) for oversized phone defaults. Showcase and for-hosts film templates keep their display scale on purpose.

- `Button` `lg` is now `h-11 px-5 text-sm` on phone and `sm:h-12 sm:px-6 sm:text-base` from 640px; `xl` is `h-12` then `sm:h-14`; `icon-lg` is `h-11 w-11` then `sm:h-12 sm:w-12`. Default (`h-10 text-sm`), `Input` and `Select` were already on the phone scale.
- Dashboard centered empty states and error panels (35 lines across inbox, bookings, plans, team, super-admin, help, announcements, activity, org) used `py-10` to `py-16` on phone. They now use `py-8 sm:py-12`, and `px-6` became `px-4 sm:px-6` where it was the only horizontal padding.
- `BenchmarkCard` values are `text-xl sm:text-2xl`; the `FeatureGate` watermark is `text-3xl sm:text-5xl`.
- Not changed: dialogs and modals (bottom sheets handle their own padding), avatar and icon wells, `min-h-` hero empty states, marketing showcase templates.
