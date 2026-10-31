---
title: 'Property public pages — shell & layout redesign'
stage: wont-do
status: cancelled
updated: 2026-08-19
---

# Property Public Pages — Shell & Layout Redesign

## Context

Property detail and the booking-flow pages (calendar, guest form, chat, sd-form, guest-review, pay-parking) are visually and structurally two unrelated products today, even though a guest moves between them in one continuous session:

- **Property detail** (`PropertyDetailPage.tsx`, route `properties/:propertySlug`) renders under `MarketingLayoutShell` — full `MarketingNav` + `MarketingFooter`, full-width `container mx-auto` content, a bento-grid photo gallery, amenities/reviews/rules sections.
- **Booking-flow pages** (`calendar`, `messages`, `form`, `success`, `sd-form`, `guest-review`, `parking/:bookingId`) render under `MainLayout` — a plain gradient header band (no nav, no property media at all), content squeezed into a floating `max-w-3xl` "surface-card" under a circular overlapping logo.

Navigating property-detail → "Reserve"/"Contact host" is a real route change; `MainLayout` plays a CSS keyframe entrance animation (`.guest-enter*`) on the card, but the property page itself has no matching exit — the whole thing reads as "a new site loaded," not a continuation. There's also no property media/amenities showcase anywhere in the booking flow, and the two page families pull "brand" chrome data from two different endpoints, occasionally duplicating brand-color application three separate ways.

The fix (validated against the real routing/component tree, not assumed) is to merge both page families into **one persistent shell** that owns the header and a property media/amenities showcase panel, with only an inner content pane swapping between routes — so it genuinely feels like changing components, not pages, per the explicit ask: _"we really don't transition to other page and maybe just change components."_

## Locked decisions (confirmed with user)

1. **Header scope**: booking-flow pages get a minimal, property-scoped header (brand mark + property name/thumbnail + "back to listing") — **not** the full `MarketingNav`. Keeps the booking flow distraction-free.
2. **Transition architecture**: property detail + calendar + form + chat + sd-form + guest-review + pay-parking become **sibling routes under one persistent shared shell**. Header and media/amenities showcase panel stay mounted; only the inner content pane swaps.
3. **Scope discipline**: this is layout/container/transition work only. `GuestForm.tsx`, `CalendarPage.tsx`, `PropertyChatPage.tsx`, `SdFormPage.tsx`, `GuestReviewPage.tsx`, `PayParkingPage.tsx`, and `PropertyDetailPage.tsx`'s content sections (`PropertyOverview`, `PropertyAmenities`, `PropertyLocation`, `PropertyRules`, `PropertyReviews`, `SimilarProperties`, `BookingCard`) are re-housed, not rewritten. No dashboard/admin changes, no backend/edge-function changes. Coordinate with (don't duplicate) the in-progress [`docs/workflow/in-progress/mobile-native-redesign.md`](../in-progress/mobile-native-redesign.md) — reuse framer-motion + `usePrefersReducedMotion` (`ui/src/hooks/useMediaQuery.ts`), no second animation engine.

## Key facts verified against code (not assumed)

- `MainLayout.tsx` has exactly one consumer (`GuestPublicLayout` in `property/routes/index.tsx`) — safe to delete outright after cutover.
- **6 pages**, not 5, render the brand header via `pickGuestBrandHeaderProps`: `CalendarPage.tsx`, `GuestForm.tsx`, `GuestFormSuccess.tsx` (confirmed — easy to miss), `SdFormPage.tsx`, `GuestReviewPage.tsx`, `PayParkingPage.tsx`. `PropertyChatPage.tsx` instead double-wraps itself in `GuestPublicBrandShell` (redundant once the shell owns brand application once).
- `.guest-enter*` CSS keyframes (`index.css` ~808–891) and `guestEnterClass`/`navState.ts` have exactly one real consumer (`MainLayout`) for this flow. `useParkingReserve.ts` also writes `guestEnter` into nav state but nothing reads it (parking flow renders under `MarketingLayoutShell`, not `MainLayout`) — that write is already dead today and stays untouched (parking is out of scope).
- Brand-color CSS variables are currently applied three separate ways: `MainLayout`'s own effect (from `useGuestPaymentInfo`), `GuestPublicBrandShell` wraps around both `PropertyDetailPage` _and_ redundantly around `PropertyChatPage`, and a third unrelated mechanism (`useMarketingBrandColor` → only feeds the mode-switch curtain-wipe gradient, doesn't touch `--primary`). The new shell collapses the first two into one call site.
- Two different data sources feed "brand" chrome today: `usePublicPropertyDetail` (edge fn `get-public-property`, react-query, mock-fallback only on 404 — real data path, not purely mock) powers the property page; `useGuestPaymentInfo` (edge fn `get-guest-payment-info`) powers the booking-flow header. **Decision**: standardize header + showcase panel on `usePublicPropertyDetail`, fetched once at the shell level — it already carries name/images/brandColor/eyebrow data, avoids a second round-trip, and eliminates a real risk of the two endpoints disagreeing on name/logo for the same slug. `useGuestPaymentInfo` keeps being called directly inside the 6 pages for everything that isn't chrome (payment methods, pet/parking toggles, fees, etc.) — only the `<GuestFormBrandHeader>` JSX is removed from each.
- `properties/:propertySlug/stay-guide` is a separate route tree this plan does not touch. (Pattern B mock form routes `…/forms/:formId` were **removed** 2026-08-27 — see [`../done/pattern-b-mock-forms-cleanup.md`](../done/pattern-b-mock-forms-cleanup.md).)
- Tailwind container max-width is `1400px` (`2xl` screen) — the shell frame matches the property page's existing `container mx-auto px-4 sm:px-6 lg:px-8`.

## Architecture

### 1. New shared shell — `ui/src/features/guest/property/components/PropertyStayShell.tsx`

Route-parent element replacing `GuestPublicLayout`. Pure route-parent (`useParams<{propertySlug}>()` only). Owns, top to bottom:

- Single `usePublicPropertyDetail(propertySlug)` call for the whole property session, wrapped in `GuestPublicBrandShell` (reused as-is).
- `setBrandColor` effect (via `useMarketingBrandColor`) moved here from the detail page, so the mode-switch curtain is correctly colored mid-wizard too.
- `PropertyStayHeader` (persistent).
- `PropertyStayShowcasePanel` (persistent, mode-driven).
- `PropertyStayContentPane` wrapping `<Outlet />`.
- Slim footer credit line only (reuse `MainLayout`'s existing one-liner pattern) — not full `MarketingFooter`.
- Loading/error states moved here from `PropertyDetailPage.tsx` (skeleton + `<Navigate to="/properties" />` on error), since the shell now gates every child route on property existence.

### 2. Route restructuring

- `ui/src/features/guest/marketing/routes/index.tsx`: delete the `properties/:propertySlug` leaf route (line 50) and its `PropertyDetailPage` import.
- `ui/src/features/guest/property/routes/index.tsx`: replace `GuestPublicLayout` with `PropertyStayShell`; add an `index` child (`PropertyOverviewPage`, the moved/stripped `PropertyDetailPage`) alongside the existing `calendar`/`messages`/`form`/`success`/`sd-form`/`guest-review`/`parking/:bookingId` children.
- **Ship the marketing-route deletion and the property-route addition in the same PR** — splitting them would 404 `/properties/:slug` in between.
- `property-stay-guide` route stays an untouched sibling (not nested under the new shell).

### 3. Minimal property header — `ui/src/features/guest/property/components/PropertyStayHeader.tsx`

Props derived entirely from the shell's `usePublicPropertyDetail` result: `propertySlug`, `propertyName`, `coverImageUrl`, `logoUrl`, `brandColor`, `isLoading`. Renders: brand mark + property name/thumbnail chip + "Back to listing" link (`guestPropertyPath`, in-shell nav) + relocated `AdminEntryButton`/`ThemeToggle` (currently floating fixed corner buttons in `MainLayout` — folding into a real header bar now that one persists). Sticky, 56–64px, `env(safe-area-inset-top)` padding, 44×44px touch targets, no nav links/hamburger/search — explicitly not `MarketingNav`.

`GuestFormBrandHeader`/`KameFormBrandHeader` become unused by this flow once migrated (optional deletion at the end, after confirming zero remaining imports).

### 4. Media/amenities showcase panel — `ui/src/features/guest/property/components/PropertyStayShowcasePanel.tsx`

Mode driven by a small pure rule in `ui/src/features/guest/property/lib/propertyStayShellMode.ts` (mirrors the existing `getListingScrollSearchConfig` convention):

| Route(s)                                                           | Mode      | Desktop (lg+, ≥1024px)                                                                             | Mobile (<lg)                                                                                  |
| ------------------------------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `index` (property detail)                                          | `full`    | Sole renderer of the bento gallery, full width, where the gallery sits today                       | Stacked full-width gallery (unchanged)                                                        |
| `calendar`, `messages`                                             | `compact` | Sticky left rail (~38–40% width): hero photo + name/rating + top amenity chips + "View all photos" | Collapses to a 96px horizontal strip (photo + name), pinned above content, tap opens lightbox |
| `form`, `sd-form`, `guest-review`, `parking/:bookingId`, `success` | `hidden`  | Not rendered — content pane gets full width                                                        | Not rendered (unchanged)                                                                      |

- `PropertyStayShowcasePanel` becomes the **only** place that renders the gallery — `PropertyOverviewPage` stops importing it directly, so "media stays mounted across navigation" is literally one persisting component instance, not an illusion.
- `full` mode reuses `ListingGallery.tsx`/`PropertyGallery` as-is (already a bento grid + lightbox, not a traditional slider).
- Extract the lightbox portion of `ListingGallery.tsx` into a shared `ui/src/features/guest/marketing/shared/components/PropertyPhotoLightbox.tsx` (`images`, `initialIndex`, `open`, `onOpenChange`) so both full-mode gallery and the compact strip's tap-to-expand share one implementation instead of duplicating ~90 lines.
- For the full → compact size/position handoff, give the hero image a stable framer-motion `layoutId="property-hero-image"` so it visually morphs across the route-driven mode change — same category of Airbnb-style shared-element continuity as `ListingScrollSearchContext`'s scroll-morph, but reacting to route change rather than scroll position (simpler, no bespoke `getBoundingClientRect` machinery needed since this isn't scroll-driven).

### 5. Transition choreography — `ui/src/features/guest/property/components/PropertyStayContentPane.tsx`

`AnimatePresence mode="wait"` + route-keyed `motion.div` wrapping `<Outlet/>`: opacity + 8-12px vertical slide, 400ms, `cubic-bezier(0.22, 1, 0.36, 1)` (same easing feel as today's `.guest-enter*`, trimmed from 520ms since this is now an inner-pane swap under a persistent shell, not a full page load). Gated by `usePrefersReducedMotion()` (existing hook — do not add framer-motion's own). Direction (forward/back) derived from an ordered step-position comparison on `location.pathname`, not `location.state` (state doesn't survive refresh/bfcache).

**Disposition of the old mechanism**: retire `.guest-enter*`/`guestEnter` state from this flow, don't delete the files (`navState.ts`'s type is still used by the out-of-scope parking flow). Strip the `guestEnter` key (keep any other state, e.g. `bookingData`) from the 6 call sites: `usePropertyReserve.ts:43`, `CalendarPage.tsx:152`, `GuestForm.tsx:678,870,911,1138`. Leave the orphaned `.guest-enter*` CSS in place as low-value dead code rather than touching it in this pass. Delete `MainLayout.tsx` only after cutover is verified.

Showcase-panel mode transitions (full↔compact↔hidden) animate via the same duration/easing on the panel wrapper, also reduced-motion-gated.

### 6. Mobile behavior

- Breakpoint: `lg` (1024px), matching existing `useIsBelowLg`/`ListingScrollSearchContext` convention — showcase panel never renders as a side column below `lg`.
- `full` mode: unchanged from today's already-responsive property page (stacked gallery, grid collapses to one column, existing `fixed ... lg:hidden` mobile price/Reserve bar carried over verbatim).
- `compact` mode: 96px horizontal strip, collapsed by default (preserves vertical space for calendar/chat UI on a 375px viewport), tap opens shared lightbox.
- `hidden` mode: unchanged single column.
- Header: sticky, safe-area-inset-top padding, 44×44px targets, property name `line-clamp-1` on narrow viewports.

**Container width**: the shell **frame** (header + showcase panel) spans the property page's full `container mx-auto` width (up to 1400px) — that delivers the "seamless" continuity the user asked for. The booking-flow **content pane** keeps a focused reading width (`max-w-2xl`–`max-w-3xl`, close to today's `MainLayout` card width) even in `hidden`-panel routes, rather than going full-bleed — `GuestForm.tsx` is a dense multi-step wizard; edge-to-edge on a 1440px screen would blow past comfortable line length for labels/inputs. In `full`/`compact` modes the content pane naturally shares the remaining column next to the panel.

### 7. Migration/rollout ordering (keep the app buildable at each step)

1. Build new files in isolation, unwired: `PropertyStayShell`, `PropertyStayHeader`, `PropertyStayShowcasePanel`, `PropertyStayContentPane`, `propertyStayShellMode.ts`, `PropertyPhotoLightbox.tsx` (extract from `ListingGallery.tsx`, update `ListingGallery` to consume it — proves the extraction against its one existing usage first).
2. Move & strip `PropertyDetailPage.tsx` → `ui/src/features/guest/property/pages/PropertyOverviewPage.tsx`: drop its own brand-shell wrap, outer container divs, and gallery block (shell now owns those). Keep all content sections byte-for-byte. Not yet routed — verify it type-checks standalone.
3. **Atomic route cutover**: edit both route files together (marketing leaf removal + property shell/index child addition). Verify `/properties/:slug` still resolves.
4. Migrate the 6 booking-flow pages: remove brand-header JSX/`pickGuestBrandHeaderProps` calls, remove `PropertyChatPage`'s redundant brand-shell wrap, strip `guestEnter` state keys from the listed call sites. Mechanical, independently revertible per file.
5. Delete `MainLayout.tsx`; grep-confirm zero remaining imports.
6. Optional cleanup: delete `GuestFormBrandHeader.tsx`/`KameFormBrandHeader.tsx` once confirmed unreferenced elsewhere (check `GuestPageSkeletons.tsx` separately).

### Critical files

- `ui/src/features/guest/property/routes/index.tsx` — route restructuring
- `ui/src/features/guest/marketing/routes/index.tsx` — leaf route removal
- `ui/src/features/guest/marketing/pages/PropertyDetailPage.tsx` — source for `PropertyOverviewPage`
- `ui/src/layouts/MainLayout.tsx` — retired after cutover
- `ui/src/features/guest/marketing/shared/components/ListingGallery.tsx` — lightbox extraction source
- `ui/src/features/guest/form/lib/guestFormBranding.ts` — `pickGuestBrandHeaderProps`, being phased out of the 6 pages
- `ui/src/layouts/guest/navState.ts` — `guestEnter` state, retired from this flow only
- `ui/src/features/guest/marketing/shared/context/ListingScrollSearchContext.tsx` — scroll-morph precedent (not reused directly, informs the shared-element approach)
- `ui/src/features/guest/marketing/shared/context/ModeSwitchTransitionContext.tsx` — brand-color context (`useMarketingBrandColor`), effect relocated to the shell

## Verification

- `bun run type-check` / `lint` / `build` clean after each of steps 3–6 above (no automated test suite in this repo).
- Playwright viewport passes at 375/768/1024/1440px across: `/properties/:slug` (full mode), `.../calendar` (compact + mobile collapsed strip), `.../messages`, `.../form` (hidden mode, focused width, wizard back/continue still works), `.../sd-form`, `.../guest-review`, `.../parking/:bookingId`, `.../success`.
- React Query devtools: navigate index → calendar → form within one property session, confirm exactly one `get-public-property` request fires — no refetch storm from the new nested routes.
- Visual: no flash of default brand color between index/calendar/form (brand vars applied once, at shell level).
- `page.emulateMedia({ reducedMotion: 'reduce' })` pass: content-pane swap and panel mode change are instant.
- Touch targets: header back/admin/theme buttons, panel expand toggle, lightbox controls all ≥44×44px.
- Confirm `stay-guide` route renders identically pre/post change.
- Confirm `/parkings/...` flow is byte-for-byte unaffected by the `MainLayout` deletion.
- Confirm guest-auth interrupt-and-resume (sign-in mid-Reserve/mid-Contact-host) still lands correctly with `guestEnter` dropped from the resume state payload.
- Confirm `GuestFormSuccess.tsx` still receives `bookingData` via `location.state` after the `guestEnter` key removal from `GuestForm.tsx`'s two success-navigate calls.
