---
stage: done
title: 'Marketing 1: Improve Marketing Calendar Templates — Implementation Plan'
status: done
tags: [planning, planned-modules, calendar, marketing]
updated: 2026-08-01
---

# Marketing 1: Improve Marketing Calendar Templates — Implementation Plan

**Status:** Implemented — full preset library redesign shipped (14 templates, 7 categories in `lib/calendarPresets.ts`); pastel-color + geometry revision shipped as a follow-up pass after user feedback that the first pass still read as "same layout, different colors"; a third pass bumped base font sizes across every preset for readability, fully recolored `desk-type` off its disliked palette, and added a new **Paper & Ink** category (`ring-bloom` elegant thin-ring circle cells, `petal-note` fully borderless/no-cell-fill design differentiated by ink color only).

## Context

The Marketing Content Studio's Calendar tab (`/org/:orgSlug/property/:propertySlug/marketing`) lets hosts generate shareable availability-calendar images for social media. Per `docs/planning/CLAUDE_TO_PLAN.md` (lines 75-80, "Marketing 1"), the host-facing complaint is that designer presets "look simple and okay" and lack a "wow factor" — the ask evolved to **replace** the original 10 presets with **12 visually distinct templates** across **6 new categories**, each showcasing a different slice of the calendar style engine (fonts, shapes, borders, spacing, colors, legends, watermarks, price badges, guest spans, nav, patterns, today indicators, blocked days, photo backgrounds).

Investigation found the underlying system is already mature — not a stub: a comprehensive style engine (`CalendarStyles` in `types/index.ts`) with borders, shadows, gradients, image/pattern backgrounds, legends, watermarks, badges, etc. — all rendered by `CalendarPreview.tsx`. The gap was homogenized visuals (brand color overwriting preset palettes) and presets that varied mainly by color/font while reusing similar geometry.

Marketing 2 (canvas/design templates, OpenPolotno) and Marketing 3 (video templates, Remotion) are architecturally separate systems and are explicitly **out of scope** for this change.

## Decisions made during brainstorming (do not re-litigate during implementation)

1. **Scope**: **Replace** the original 10 presets — new ids, categories, and visual languages in `lib/calendarPresets.ts` (not in-place tweaks to `editorial-serif`, etc.).
2. **Photo backgrounds**: **Photo Story** presets (`property-hero`, `cabin-retreat`) auto-use the property gallery cover photo when available, falling back to curated stock.
3. **Brand color**: designer presets use `preservePresetPalette: true` so org brand color tints the export canvas frame only — not today/booked/header fills (fixes "everything looks blue").
4. **Phase 0 (dead rendering paths)**: blocked-day rendering, `'lines'` pattern, `ring`/`badge` today indicators, and `BlockedPanel` wiring — all shipped.
5. **`bookingBar`/`available.indicator` excluded**: no renderer/settings panel — multi-day span uses `booked.guestInfo` instead.

## Shipped preset library (14 templates, 7 categories)

First pass (categories: Social & Promo / Typographic / Graphic / Organic / Photo Story / Nocturne) still read as "same layout, different colors" per user feedback — spacing, corner radius, text position/alignment, and palette saturation were too close across templates. Revised in place with a pastel-led, geometry-first pass, then refined again for readability + two new templates:

| Category        | Presets (label · id)                                             | Distinct geometry                                                                                                                                                                                           | Palette                                      |
| --------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Sweet Social    | Bubble Pop `social-availability` · Sunny Widget `sunrise-select` | Full-circle day dots + centered header vs. rounded-square widget card with corner-right day numbers                                                                                                         | Lavender pastel vs. butter/peach             |
| Cute Type       | Desk Buddy `desk-type` · Zine Soft `magazine-grid`               | Chunky rounded blocks (radius 18) in a centered periwinkle header band vs. crisp pastel-hairline editorial grid (radius 8, left masthead)                                                                   | Periwinkle/navy ink vs. rose/cream           |
| Playful Pattern | Confetti Blocks `bauhaus-geo` · Sprinkle Print `memphis-print`   | Thick pastel-bordered rounded blocks with sticker offset-shadow vs. dot-confetti pattern + dashed coral frame                                                                                               | Lavender/sky/butter vs. coral/sky pink       |
| Botanical       | Boho Breeze `boho-soft` · Garden Bloom `garden-glow`             | Borderless — only booked/today get a pastel circle dot (gap 20) vs. every-day lush rounded blobs (radius 26, gap 9)                                                                                         | Terracotta pastel vs. mint/sage              |
| Photo Story     | Sunlit Stay `property-hero` · Cabin Glow `cabin-retreat`         | Frosted-glass rounded cells + corner heart icon vs. chunkier rounded cells + nav pill buttons + centered bed icon                                                                                           | Blush photo wash vs. warm peach wash         |
| Twilight        | Dreamy Dusk `velvet-guest` · Rose Gold `gold-foil`               | Soft lilac dusk gradient, centered header, guest-name spans vs. blush plaque with rose-gold double border, right-aligned day numbers                                                                        | Lilac/lavender vs. blush/rose-gold           |
| Paper & Ink     | Ring Bloom `ring-bloom` · Petal Note `petal-note`                | Thin outlined-ring circle cells on every day, filled only for booked, vs. zero cell fills/borders anywhere — every state (available/booked/blocked/today) reads purely from day-number ink color and weight | Cream/gold/blush vs. blush-vignette gradient |

Renderer change alongside the second pass: `CalendarPreview.tsx` header block now honors `header.title.alignment` (left/center/right) for the property-name line, month/year row, and subtitle — previously hardcoded to left-aligned/space-between regardless of the preset's setting, which was part of why every preset's header read identically.

**Third pass (readability + Desk Buddy recolor + 2 new templates):** base font sizes were increased across every preset and in `createDefaultStyles()` — day numbers (~14→18-20px), day-name letters (~10-11→12-15px), month/year titles, legend labels (→13-14px), and booked/blocked badge text — since the original sizes read as too small on screen. `desk-type` ("Desk Buddy") was fully recolored off its disliked black-on-peach/dusty-rose look to a periwinkle header band with deep navy ink text, cream body, and soft-blue booked blocks. Added `ring-bloom` for an explicit "circle day cell, cute and elegant" ask (distinct from `social-availability`'s filled playful circles — this one uses delicate 1.5px outlined rings with a serif face) and `petal-note` for a "no background cell, just style with text color" ask, modeled on a blush/terracotta floral stationery-card reference: every cell state (available/booked/blocked/today) is `background: transparent` with zero borders, differentiated only by day-number ink color/weight and a today underline indicator.

Preset picker metadata: `CALENDAR_PRESET_CATEGORIES`. Style partials: `CALENDAR_PRESET_STYLES`. Resolved in `calendar-builder-store.ts#resolveCalendarPresetStyles`.

## Legacy note

Autosaved calendars retain full `designJson.styles`. Rows with retired `sourcePresetId` values (old slug names) still render; re-applying those ids from the sidebar falls back to `createDefaultStyles()` since they are no longer in the preset catalog.

## Current state (verified this session)

Phase 0 items 1-2 below are already applied in the working tree (uncommitted) as of this doc being written: the blocked-day rendering branch and the `'lines'` pattern case, both in `CalendarPreview.tsx`. The `ring`/`badge` today-indicator cases, the `BlockedPanel` wiring, all preset content changes, the property-photo feature, and the docs updates below are **not started**.

## Phase 0 — Fix dead rendering paths (prerequisite)

File: `ui/src/features/dashboard/marketing/components/calendar-builder/components/CalendarPreview.tsx`

1. ✅ **Done** — **Blocked-day state**: the day-cell loop destructured only `isBooked`/`isToday` (line 424) and the state-selection branch (lines 448-455, `isToday` → `isBooked` → falls through to `available`) never checked `isBlocked` (computed at line 236 but discarded). Added an `else if (isBlocked)` branch mirroring the existing `isBooked` branch: applies `styles.blocked.background/border/dayNumberColor`, and renders `blocked.text`/`blocked.pattern` the same way `booked.text`/`booked.pattern` render.
2. ✅ **Done** — **`'lines'` pattern**: `getBackgroundStyle`'s pattern switch implemented `dots`/`grid`/`diagonal` but not `lines`. Added the case, porting the working implementation already present in `BackgroundControl.tsx`'s preview-chip renderer.
3. ⬜ **Pending** — **`ring`/`badge` today indicators**: the indicator block (lines 683-703) implements `dot` and `underline` only, per the `styles.today.indicator.type === '...'` spread pattern. Add `ring` (hollow bordered circle) and `badge` (small filled pill) cases following the same pattern.

File: `ui/src/features/dashboard/marketing/components/calendar-builder/components/CalendarBuilder.tsx`

4. ⬜ **Pending** — Import `BlockedPanel` (already fully built in `components/panels/StatesPanel.tsx`, just never added to the panel list) and add it to the advanced-settings panel list (~lines 63-75 imports, ~791-800 JSX), after `AvailablePanel`.

## Preset redesign

### Coverage matrix — underused feature → preset assignment

| Feature                                            | Assigned preset(s)                | Notes                                                                                                                |
| -------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Legend                                             | `editorial-serif`                 | Fine-print availability/booked/today footer row                                                                      |
| Watermark                                          | `modern-classic`                  | Subtle serif wordmark, bottom-right, low opacity                                                                     |
| Price indicator (`available.price`)                | `terracotta`                      | Nightly-rate badge on available days                                                                                 |
| Multi-day guest span (`booked.guestInfo`)          | `midnight-velvet`                 | Substitutes for the dead `bookingBar` — same value, already implemented                                              |
| Nav arrows (`header.navigation`)                   | `cozy-cabin`                      | Warm wood-tone chevrons                                                                                              |
| Dashed border                                      | `mono-ink`                        | Bold ink-stroke marker; also needs _some_ booked-day content — currently flat color only, the weakest of the 10      |
| Double border                                      | `onyx-luxe`                       | Gold-foil plaque/certificate motif                                                                                   |
| `grid` background pattern                          | `swiss-minimal`                   | Literal "Swiss grid"                                                                                                 |
| `dots` background pattern                          | `risograph-pop`                   | Halftone print texture                                                                                               |
| Non-`dot` today indicator (`ring` or `badge`)      | `risograph-pop`                   | Bold poster-style highlight                                                                                          |
| Icon overlay repositioned (corner vs. dead-center) | `tropical-paradise`, `cozy-cabin` | Both already use center icon overlays — reposition one to demonstrate `icon.position` variety instead of duplicating |
| Blocked-day differentiation (Phase 0)              | at least 2-3 presets              | Pick presets where a distinct blocked treatment reads clearly (e.g. `editorial-serif`, `swiss-minimal`, `onyx-luxe`) |

Every underused feature has exactly one clear home — nothing duplicated pointlessly, nothing left unshown.

### Per-preset geometry + showcase brief

Font pairings are already good and stay unchanged — the work is shape/pattern/feature depth, not new typefaces.

| Preset              | Distinctiveness push                                                                                         | Showcase                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `editorial-serif`   | Push border-radius fully to 0 for crisp editorial contrast vs. `modern-classic`'s warmth                     | Legend                                                          |
| `modern-classic`    | Push radius up (14-16), consider echoing the booked gradient in the container background for cohesive warmth | Watermark                                                       |
| `swiss-minimal`     | Already maximal (radius 0, gap 0) — thicken container border to 2px                                          | Grid pattern                                                    |
| `mono-ink`          | Currently the flattest booked-day treatment of the 10 — needs real content                                   | Dashed border + `booked.pattern: dots` for ink-halftone texture |
| `terracotta`        | Push radius to the softest/most organic (24-28)                                                              | Price indicator                                                 |
| `tropical-paradise` | Keep organic radius; reposition icon overlay to a corner badge                                               | Property photo + repositioned icon                              |
| `cozy-cabin`        | Keep organic radius; style the nav buttons                                                                   | Property photo + nav arrows                                     |
| `onyx-luxe`         | Add a double-line gold border accent (container or today) — plaque motif                                     | Double border                                                   |
| `midnight-velvet`   | Keep soft radius; verify cell background opacity keeps guest-name labels legible                             | Guest-info multi-day span                                       |
| `risograph-pop`     | Already the loudest/sharpest geometry — add dot-print texture                                                | Dots pattern + non-dot today indicator                          |

Rewrite each preset's `description` in `PRESET_CATEGORIES` (`CalendarBuilder.tsx` lines 93-191) to name the visual identity + showcase instead of just the font pairing (e.g. `editorial-serif`: "Playfair Display · crisp magazine grid with legend"). **Category labels and membership stay fixed** (Editorial / Minimal / Warm & Organic / Photo Backgrounds / Dark & Luxe / Contemporary) — they already read as clear, differentiated names; only the per-preset description copy changes.

## Property-photo-aware backgrounds

### New helper

New file `ui/src/features/dashboard/marketing/lib/calendarPropertyPhoto.ts`, mirroring the existing brand-color pattern in `lib/calendarBrandColors.ts` (`applyBrandAccentToCalendarStyles`):

```ts
export function applyPropertyPhotoToCalendarStyles(
  styles: CalendarStyles,
  propertyPhotoUrl?: string
): CalendarStyles {
  if (!propertyPhotoUrl) return styles;
  if (styles.container.background.type !== 'image') return styles;
  return {
    ...styles,
    container: {
      ...styles.container,
      background: { ...styles.container.background, imageUrl: propertyPhotoUrl },
    },
  };
}
```

Shape-driven, not preset-id-driven — only touches `container.background.imageUrl` when the container is already an `image` background (true for `tropical-paradise`/`cozy-cabin` only), leaving `overlay`/`imageSize`/`imagePosition` as authored (tuned for legibility over any photo).

**Which photo**: `supabase/functions/_shared/publicPropertyService.ts` (`sortMedia`, ~lines 220-226) already sorts property media primary-first then by order — `calendarPropertyImages[0]?.url` (already computed in `CalendarBuilder.tsx` lines 212-219) is the correct "cover photo" pick, no new fetch/sort logic needed.

**No live re-sync**: unlike brand color (which has a `useEffect` re-applying on every `brandColor` change, `CalendarBuilder.tsx` lines 574-580, because it's an org-wide setting), property photo must NOT re-apply on every render — a host who manually picks a different photo via the existing `BackgroundControl` picker would have that silently overwritten. Only apply at the two "fresh preset load" boundaries: `applyPreset` and thumbnail rendering.

### Threading (call-site by call-site)

1. **`calendar-builder-store.ts`**: add `propertyPhotoUrl?: string` as a 3rd param to `applyPreset` (interface ~line 51, implementation ~line 1946) and a 4th param to `resolveCalendarPresetStylesForFormat` (~line 1788). Apply the new helper alongside `applyBrandAccentToCalendarStyles`.
2. **`components/shared/MarketingCalendarThumbnailHost.tsx`**: add `propertyPhotoUrl?: string` to `CapturePresetRequest`, `capturePresetFn`, `registerCalendarPresetThumbnailCapture`, and `captureCalendarPresetThumbnail`; thread through the `capturePreset` closure and the `offscreenStyles` computation (~lines 354-358).
3. **`hooks/useMarketingTemplateThumbnails.ts`**: add `propertyPhotoUrl?: string` to `CalendarOptions`; destructure alongside `brandColor` (~line 210); fold into the cache-invalidation composite key (~lines 230-245); pass through both `calendarPresetThumbnailKey(...)` call sites (~line 278, ~lines 406-421) and the `captureCalendarPresetThumbnail(...)` call.
4. **`lib/marketingTemplateThumbnailCache.ts`**: add `propertyPhotoUrl?: string` param to `calendarPresetThumbnailKey` (~lines 114-123), fold into the returned key string (e.g. append `:${propertyPhotoUrl ?? 'stock'}`) so a changed cover photo invalidates stale thumbnails. IndexedDB-backed, no length constraint issue with embedding the raw URL.
5. **`components/calendar-builder/components/CalendarBuilder.tsx`**: derive `const propertyPhotoUrl = calendarPropertyImages[0]?.url;` next to the existing `calendarPropertyImages` memo (lines 212-219); add to the `thumbnailOptions` memo (~lines 541-559) and its deps; pass as the 3rd arg to all 3 `applyPreset(...)` call sites (lines 443, 462, 669) and add to `loadPresetEditorState`'s dep array (~471-472).

No changes needed to `CalendarTemplateSidebar.tsx`, `CalendarThumbnailsProvider.tsx`, `CalendarPropertyMediaProvider.tsx`, `BackgroundControl.tsx`, or `types/index.ts` (no type changes — every field used already exists on `CalendarStyles`).

## Docs to update

Per this repo's documentation-maintenance convention, update `docs/guides/routes/org/property/marketing.md`:

- **Autosave paragraph** (~line 46): add a sentence noting Photo Backgrounds presets auto-fill from the property's primary gallery photo on first load (falling back to stock when none exists), and that once a calendar is autosaved, the baked-in `imageUrl` persists — a later gallery-photo change won't retroactively update an already-customized/autosaved calendar.
- **Implementation map table** (~lines 136-161): add a row for the new `lib/calendarPropertyPhoto.ts` helper.

## Verification

No test suite exists in this repo. Verify via:

1. **Static checks** (from `ui/`): `bun run type-check`, `bun run lint`, `bun run build`. The `applyPreset`/`resolveCalendarPresetStylesForFormat` signature changes touch multiple call sites — `tsc` will catch any missed one.
2. **Manual, in the running dev server** (`./dev.sh` or `bun run dev`), at `/org/:orgSlug/property/:propertySlug/marketing` → Calendar tab:
   - **Property photo (has gallery)**: select a property with gallery photos; click Tropical Paradise / Cozy Cabin; confirm both the sidebar thumbnail and live preview show the property's actual primary photo, not the Unsplash stock image, across all 3 canvas formats (square/portrait/landscape).
   - **Property photo (no gallery)**: repeat on a property with no gallery images; confirm clean fallback to the original stock photo.
   - **Manual override not clobbered**: after loading a photo preset, manually change the background image via Advanced Settings → Container → Background; confirm it sticks (re-selecting the same preset card resets to the auto-picked photo, which is expected "load defaults" behavior).
   - **Per-preset showcase check**: for each of the 10 presets, click the card and confirm its assigned showcase feature actually renders in the live preview (legend row, watermark, price badge, guest-name span over the mock multi-day bookings, nav chevrons, dashed/double border, grid/dots pattern, non-dot today indicator, repositioned icon).
   - **Blocked-day rendering (Phase 0)**: with mock `blockedDays` set, confirm blocked cells now visually differ from available cells on the 2-3 presets assigned blocked-day differentiation, and that the new Blocked State panel appears in Advanced Settings and live-updates.
   - **Thumbnail cache correctness**: hard-refresh and confirm sidebar thumbnails match live previews (exercises the new cache-key threading) rather than showing stale cached renders.
   - **Reset behavior**: customize a preset, click Reset, confirm it reloads preset defaults including the auto-picked property photo.
   - **No regressions**: quick sanity pass on the Design and Video tabs (untouched, but share chrome components).

### Critical files

- `ui/src/features/dashboard/marketing/components/calendar-builder/stores/calendar-builder-store.ts` — all 10 preset objects + `applyPreset`/`resolveCalendarPresetStylesForFormat`
- `ui/src/features/dashboard/marketing/components/calendar-builder/components/CalendarPreview.tsx` — Phase 0 renderer fixes
- `ui/src/features/dashboard/marketing/components/calendar-builder/components/CalendarBuilder.tsx` — category descriptions, `BlockedPanel` wiring, property-photo threading
- `ui/src/features/dashboard/marketing/lib/calendarPropertyPhoto.ts` — new helper
- `ui/src/features/dashboard/marketing/hooks/useMarketingTemplateThumbnails.ts`, `components/shared/MarketingCalendarThumbnailHost.tsx`, `lib/marketingTemplateThumbnailCache.ts` — thumbnail pipeline threading
- `docs/guides/routes/org/property/marketing.md` — doc updates
