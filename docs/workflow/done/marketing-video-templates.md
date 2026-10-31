---
stage: done
title: 'Marketing 3: Improve Marketing Video Templates & Customizability — Implementation Plan'
status: superseded
tags: [planning, planned-modules, marketing, templates]
updated: 2026-08-01
---

# Marketing 3: Improve Marketing Video Templates & Customizability — Implementation Plan

**Status:** Implemented (+ follow-ups: accent scrims, then **per-template composition layouts** + pill/CTA chrome — Quiet Coast–style pause-visible identity). Sibling to `docs/planning/planned_modules/marketing-calendar-templates.md` (Marketing 1, implemented) and `docs/planning/planned_modules/marketing-design-templates.md` (Marketing 2, implemented — "Quiet Coast" system).

## Context

Per `docs/planning/CLAUDE_TO_PLAN.md:91-93`, the entire original ask for Marketing 3 is: _"Improve Marketing Video Templates & Customizability. Same with marketing design templates goal."_ — i.e. fix the same "too plain, not production-ready" problem Marketing 2 fixed for Design, now for Video. The user's chat request in this session adds the operative detail: video templates should be "stunning, beautiful and elegant... eye catching, instagrammable and has wow factor," and the editor should offer more settings/fields/configuration, with extended transitions and animations, aiming for a production-ready video editor and template library.

Scope was narrowed with the user during brainstorming to: **Video tab only** (Calendar and Design already shipped their redesigns and are not reopened here); **10 → 12 templates** (parity growth pattern matching Design's Marketing 2 approach — add one new baseId each to the two thinnest categories); **curated per-template motion identity**, not a full per-layer keyframe/timeline editor (that would be a separate, much larger product surface); and **clean up the half-migrated legacy data model** while this code is already being rewritten.

### What "Video" actually is today (verified, not assumed)

Investigation (2 Explore agents + direct reads of every critical file) found Video is **not** a static-image system mislabeled as video — it's a real, working Remotion pipeline: `VideoRemotionPlayer.tsx` uses `@remotion/player` for live frame-accurate preview; `CampaignVideoComposition` (`VideoCompositions.tsx:178-216`) builds a real `<TransitionSeries>` of scenes with Ken Burns zoom, spring entrances, and cross-scene transitions; `exportVideoMedia.ts` calls `renderMediaOnWeb({container:'mp4'})` from `@remotion/web-renderer` to produce a genuine downloadable/publishable MP4, muxed with real background music (Jamendo/upload/URL, `VideoMusicSettings.tsx`, 519 lines — a surprisingly mature sub-feature). Brand color and property-photo/gallery-video binding are already fully threaded (`VideoEditor.tsx:195`, `videoLayerTypography.ts`, `videoProjectDefaults.ts`). Built in a single week (2026-07-24 → 2026-07-29), right after Marketing 2 shipped — this is the newest part of the studio, not legacy debt.

### Root cause of "not stunning" — deeper than Design's pre-redesign problem

Design's pre-redesign issue (Marketing 2 plan) was "5 builders serving 10 baseIds, flat fills only." Video's problem is more extreme: **scene structure and every visual/motion parameter are computed purely from `category` + gallery-photo-count — `templateId` is never consulted for anything except the copy-text switch.** Verified directly:

- **Scene skeleton**: `buildGalleryScenes()` (`videoProjectDefaults.ts:156-213`) branches only on `media.length` and `category`; `contentSceneForCategory()` (line 137) and `ctaTransitionForCategory()` (line 126) both switch on `CampaignCategory`, not `templateId`. Two templates in the same category (e.g. all 5 `promo-*` baseIds) produce **structurally identical** scene graphs.
- **Motion**: `SceneLayers` (`VideoCompositions.tsx:107-141`) hardcodes one zoom curve (`interpolate(frame,[0,durationInFrames],[1,1.06])`), one spring (`damping:16`), one CTA fade-in (12 frames) — applied identically to every scene of every template. Zero per-template variation exists anywhere in the render path.
- **Typography**: `VIDEO_TEXT_PRESETS` (`videoLayerTypography.ts:29-127`) is a single global map keyed by _text role_ (title/subtitle/promo/body/label/cta), not by template — every baseId renders in the exact same font pairing (Plus Jakarta Sans + DM Sans + Space Grotesk).
- **Color**: `presetColors()` (`videoLayerTypography.ts:129-143`) always uses the org's global `brandColor` for title/CTA text — **every template's `swatchPrimary`/`swatchSecondary`** (hand-authored per baseId in `videoCampaignTemplates.ts:18-89`, clearly intended as distinct per-template palettes — e.g. giveaway is red/orange, fully-booked is slate) **is never read by the renderer at all.** Grep-confirmed: `swatchPrimary`/`swatchSecondary` are consumed only by the sidebar picker's swatch-dot decoration (`MarketingTemplatesPanel.tsx:50-51`, `VideoEditor.tsx:423-424`) — the picker promises a palette the actual video never delivers. This is a worse version of the "brand color overwrites everything" bug Marketing 1/2 both had to fix.
- **Layout**: `defaultTextLayoutForSceneKind()` (`videoTextSlots.ts:30-49`) positions text purely by `VideoSceneKind` (photo/promo/slots/cta) — identical positions regardless of template.
- **Transitions**: only 4 of the 18 transition presentations shipped in `@remotion/transitions@4.0.501` are wired (`renderSceneTransition()`, `VideoCompositions.tsx:147-176`): `fade`, `slide` (as `slide-left`/`slide-up`), `wipe`, `none`. Confirmed via direct package inspection — `book-flip.js`, `clock-wipe.js`, `cross-zoom.js`, `crosswarp.js`, `dissolve.js`, `dreamy-zoom.js`, `film-burn.js`, `flip.js`, `linear-blur.js`, `push-cut.js`, `ripple.js`, `swap.js`, `zoom-blur.js`, `zoom-in-out.js` are installed and unused — no new dependency needed to expand this.

Net effect: today's "10 templates" render as **1 visual/motion identity with 10 different headline strings**, wrapped in a picker that shows swatch colors the video itself never uses.

### Legacy data-model state (confirmed, informs Decision 7)

`VideoScene` (`videoProjectTypes.ts:63-79`) has a half-migrated model: `layers` (positioned layer stack) is the live source of truth, while `texts`/`textStyle`/`textLayout`/`hiddenElements` are marked `@deprecated` but still written on every save via `persistSceneLayers()`/`legacyFieldsFromLayers()` (`videoSceneLayers.ts:118-207`) for backward-compat with old saved rows. Grep-confirmed **fully dead** (zero external references): `VideoScenePhotoSettings` and `VideoSceneTextSettings` (`VideoSceneSettings.tsx:149-275`), the deprecated `VideoSceneSettings` wrapper (`VideoSceneSettings.tsx:277-296` — only `VideoSceneMetaSettings` is actually imported elsewhere), and 3 deprecated composition re-export aliases + a type alias in `VideoCompositions.tsx:218-231` (`PropertyShowcaseComposition`, `AvailabilityPromoComposition`, `BookingPromoComposition`, `VideoTemplateProps`).

### Non-issues (verified already solved, no work needed)

- **Format coverage**: unlike Design's pre-redesign gap, Video already renders every template at all 3 formats (`instagram-story`/`instagram-post`/`landscape`) via one global format selector (`VideoEditor.tsx:129`, `CATEGORIES`/format are independent axes) — no per-template `formats` allowlist exists to fix.
- **Brand-color/property-photo threading**: already complete end-to-end (this plan changes _how_ brand color is applied — see Decision 2 — not whether it's threaded).
- **`CampaignCategory` shared-type constraint** (`designCanvasTypes.ts:3`, also imported by `useMarketingCatalog.ts`'s `BUILTIN_CATEGORIES`): still real — confirmed both Design and Video populate all 4 categories today, so **no new category** is introduced by this plan (same constraint Marketing 2 respected).

## Decisions

### 1. Preset architecture: 10 → 12 baseIds, same 4 categories

Add one new baseId to each of the two thinnest categories, mirroring Design's Marketing 2 additions for cross-tab campaign coherence (a host can pair the same-named Design + Video template for one campaign):

- `giveaway` → add **`giveaway-raffle`**
- `fully-booked` → add **`fully-booked-waitlist`**

`VIDEO_CAMPAIGN_TEMPLATES` (`videoCampaignTemplates.ts:18-89`) grows to 12 entries; `defaultVideoFields()` (lines 95-202) gets 2 new `case` branches with their own copy.

### 2. Palette: reuse Design's `resolveCampaignPalette()` directly — no new helper file

`designBrandColors.ts`'s `resolveCampaignPalette(brandColor, {preservePresetPalette, presetAccent})` → `CampaignPalette` (`{accent, accentDark, accentForeground, ink, cream, success, danger}`) has zero Polotno-specific coupling — it's a pure hex-math helper already shaped exactly right for Video. **Import it directly** rather than duplicating (matches the existing precedent of sharing `CampaignCategory` across tabs).

- `VideoCampaignTemplateDef` (`videoCampaignTemplates.ts:5-11`) gains `preservePresetPalette?: boolean` and `presetAccent?: string`, mirroring `CampaignTemplateDef` (`designCanvasTypes.ts:29-38`).
- Set `preservePresetPalette: true` on exactly 2 of the 12 (mirrors Design's exact same 2 presets, for the same reasons): `fully-booked` (quiet/calm mood shouldn't shift with an arbitrary brand hex) and `giveaway-raffle` (fixed festive gold/red ticket motif). All other 10 stay brand-tinted.
- **Fixes the swatch-lies-about-render bug structurally**: replace hand-authored `swatchPrimary`/`swatchSecondary` hex literals with values _derived from_ `resolveCampaignPalette()` at the picker call site (or precomputed per baseId using the same resolver) — the sidebar swatch and the actual rendered accent become guaranteed-consistent instead of two independent sources of truth.
- `videoLayerTypography.ts`'s `presetColors()` (lines 129-143) stops taking a raw `brandColor` string and instead takes the resolved `CampaignPalette`, using `palette.accent`/`palette.accentForeground` for title/CTA roles and `palette.cream`/`palette.ink` for the rest — giving each template's fixed-palette escape hatch real effect for the first time.

### 3. Typography: per-baseId font pairing, replacing the single global role map

New file `ui/src/features/dashboard/marketing/lib/video/videoTemplateTypography.ts`: a `Record<baseId, {title, subtitle, promo, body, label, cta}>` font-pairing table, values drawn only from the already-preloaded `VIDEO_FONT_FAMILIES` list (`videoLayerTypography.ts:10-25`, 14 fonts, each already safe for Remotion preview + export per its own comment — **no new font loading needed**). `baseTypographyForStyle()`/`buildTypographyFromPreset()`/`resolveLayerTypography()` (`videoLayerTypography.ts:161-192`) gain a `fontPairing` parameter (resolved once per project from `project.templateId`, threaded down alongside `brandColor`/`palette`) instead of using `VIDEO_TEXT_PRESETS`' hardcoded `fontFamily` values directly. `VIDEO_TEXT_PRESETS` keeps its size/weight/letterSpacing/transform/stroke/shadow fields (those stay role-driven, not template-driven — no evidence they need to vary) but its `fontFamily` field is overridden per-template.

Suggested pairings by category identity (starting point for the implementer, adjustable during visual QA exactly as both prior plans note their tables were):

| baseId                            | Category     | Font pairing (title / label)       | Motion signature                                              |
| --------------------------------- | ------------ | ---------------------------------- | ------------------------------------------------------------- |
| `promo-500-off`                   | promo        | Fraunces / Space Grotesk           | Slow cinematic zoom-in + upward drift, low-bounce spring      |
| `promo-300-off`                   | promo        | Outfit / DM Sans                   | Gentle horizontal pan + light zoom                            |
| `promo-10-off`                    | promo        | Sora / Inter Tight                 | Fast punchy zoom-in, snappy high-bounce spring                |
| `promo-free-breakfast`            | promo        | Playfair Display / Nunito Sans     | Soft zoom-out (tight → wide), relaxed                         |
| `promo-free-parking`              | promo        | Manrope / Figtree                  | Diagonal pan (x+y drift) + light zoom                         |
| `slots-1`                         | slots        | Cormorant Garamond / Space Grotesk | Tight zoom-in, minimal drift — exclusive framing              |
| `slots-3`                         | slots        | Sora / DM Sans                     | Alternating pan direction per scene — countdown energy        |
| `slots-5`                         | slots        | Inter Tight / Manrope              | Fast zoom + horizontal pan — busy/urgent                      |
| `giveaway`                        | giveaway     | Playfair Display / Sora            | Bouncy high-damping spring entrance, sparkle-timed CTA reveal |
| `giveaway-raffle` **(new)**       | giveaway     | Cormorant Garamond / Space Grotesk | Pan + gentle zoom, ticket-reveal-timed CTA                    |
| `fully-booked`                    | fully-booked | Lora / DM Sans                     | Minimal motion — near-static slow zoom, quiet                 |
| `fully-booked-waitlist` **(new)** | fully-booked | Nunito Sans / Outfit               | Soft zoom-out + gentle upward drift, inviting                 |

### 4. Motion: per-template motion profile, replacing the hardcoded constants in `SceneLayers`

New file `ui/src/features/dashboard/marketing/lib/video/videoMotionProfiles.ts`: a `VideoMotionProfile` type (zoom range + direction in/out, optional pan x/y drift, spring damping/stiffness, entrance offset style, CTA reveal timing) with one entry per baseId (see Motion signature column above for the design intent) plus a documented **default fallback profile** (today's current exact behavior: zoom 1→1.06, damping 16, 24px offset, 12-frame CTA fade) used for any `templateId` not in the table — this is what keeps old saved projects rendering unchanged.

`VideoCompositionProps` (`VideoCompositions.tsx:40-45`) gains `motionProfile?: VideoMotionProfile` (default = fallback profile), resolved once in `VideoRemotionPlayer.tsx` and `renderMarketingVideoThumbnail.ts` from `project.templateId` via a `resolveVideoMotionProfile(templateId)` lookup, then threaded into `SceneLayers` (line 107) to replace the hardcoded `interpolate`/`spring` calls at lines 111-115. Ken Burns changes from **zoom-only** to **zoom + optional pan** (translate, not just scale) — a real capability gap today (no pan primitive exists at all), needed for several rows in the table above (`promo-300-off`, `promo-free-parking`, `fully-booked-waitlist`).

New optional `VideoScene.motion?: VideoMotionOverride` lets a host override the template default for one specific scene (mirrors how `transition` is already per-scene, not per-project) — exposed via a new "Motion" select in `VideoSceneMetaSettings` (`VideoSceneSettings.tsx:51-147`), positioned next to the existing "Transition in" select (lines 125-144).

### 5. Transitions: wire a curated 5 more of the 18 available presentations (9 total, from 4)

Extend `VideoTransition` (`videoProjectTypes.ts:6`) and `renderSceneTransition()` (`VideoCompositions.tsx:147-176`) with `dissolve`, `flip`, `clock-wipe`, `zoom-in-out`, `push-cut` — chosen for short-form social pacing (skip the heavier/gimmicky ones: `book-flip`, `cross-zoom`, `crosswarp`, `dreamy-zoom`, `film-burn`, `linear-blur`, `ripple`, `swap`, `zoom-blur` stay unwired as a documented fast-follow list, not part of this pass). **Each new import must be checked against its actual exported config/direction signature during implementation** — only `fade`/`slide`/`wipe` signatures were directly verified in this plan; the other 5 modules exist on disk but their APIs weren't inspected.

Update the `TRANSITIONS` UI list (`VideoSceneSettings.tsx:30-36`) to expose all 9. Per-baseId default transition pairs (content-scene → CTA-scene), replacing the current category-only `ctaTransitionForCategory()` (`videoProjectDefaults.ts:126-135`) with a per-baseId lookup:

| baseId                            | Content transition | CTA transition                                       |
| --------------------------------- | ------------------ | ---------------------------------------------------- |
| `promo-500-off`                   | dissolve           | push-cut                                             |
| `promo-300-off`                   | fade               | slide-left _(unchanged)_                             |
| `promo-10-off`                    | zoom-in-out        | wipe                                                 |
| `promo-free-breakfast`            | fade               | dissolve                                             |
| `promo-free-parking`              | slide-left         | wipe                                                 |
| `slots-1`                         | dissolve           | clock-wipe                                           |
| `slots-3`                         | fade               | clock-wipe                                           |
| `slots-5`                         | zoom-in-out        | clock-wipe                                           |
| `giveaway`                        | flip               | wipe _(unchanged)_                                   |
| `giveaway-raffle` **(new)**       | flip               | dissolve                                             |
| `fully-booked`                    | fade               | fade _(unchanged — reinforces the "quiet" identity)_ |
| `fully-booked-waitlist` **(new)** | dissolve           | fade                                                 |

Note the `slots` category converging on `clock-wipe` for its CTA is intentional — a countdown/urgency motif shared across all 3 slots templates, same "category has a signature move" logic Design used.

### 6. Threading — every call site that builds or renders a video document

1. **`videoCampaignTemplates.ts`** — add `preservePresetPalette`/`presetAccent` fields + 2 new baseId entries + `defaultVideoFields()` cases (Decision 1, 2).
2. **`videoMotionProfiles.ts`** (new) — profile table + `resolveVideoMotionProfile()` (Decision 4).
3. **`videoTemplateTypography.ts`** (new) — font-pairing table + `resolveVideoFontPairing()` (Decision 3).
4. **`videoProjectDefaults.ts`** — `ctaTransitionForCategory()` (line 126) → per-baseId lookup consulting the table in Decision 5; `buildDefaultVideoProject()` (line 254) stamps the resolved default transitions onto generated scenes.
5. **`videoLayerTypography.ts`** — `presetColors()`/`baseTypographyForStyle()`/`buildTypographyFromPreset()`/`resolveLayerTypography()` take `CampaignPalette` + `fontPairing` instead of a raw `brandColor` string (Decision 2, 3).
6. **`VideoCompositions.tsx`** — `VideoCompositionProps` gains `motionProfile`/`palette`/`fontPairing`; `SceneLayers` (lines 107-141) reads motion params from the profile instead of hardcoded constants; `renderSceneTransition()` (147-176) gains the 5 new cases; delete the 3 deprecated composition aliases + `VideoTemplateProps` (lines 218-231, Decision 7).
7. **`VideoRemotionPlayer.tsx`** — resolve `palette`/`motionProfile`/`fontPairing` from `project.templateId` + org `brandColor`, pass into `CampaignVideoComposition`.
8. **`renderMarketingVideoThumbnail.ts`** (both `renderVideoPresetThumbnail` and `renderVideoProjectThumbnail`) — same resolution + threading into the `renderStillOnWeb` call (~line 104), so preset thumbnails reflect the new per-template identity.
9. **`exportVideoMedia.ts`** — same threading into `renderMediaOnWeb` so exported MP4s match preview.
10. **`VideoEditor.tsx`** — resolve palette/motion/fontPairing once (near existing `brandColor` at line 195) and pass down; update the `CATEGORIES` constant usage untouched (still 4 categories).
11. **`VideoSceneSettings.tsx`** — add "Motion" select to `VideoSceneMetaSettings` (Decision 4); extend `TRANSITIONS` list (Decision 5); delete `VideoScenePhotoSettings`, `VideoSceneTextSettings`, deprecated `VideoSceneSettings` wrapper (lines 149-296, Decision 7 — confirmed zero external references).
12. **`marketingTemplateThumbnailCache.ts`** — bump `videoPresetThumbnailKey()` (line 102-109) `v4` → `v5` so every pre-redesign cached thumbnail is invalidated (same convention both prior plans used).
13. **`MarketingTemplatesPanel.tsx`** / **`VideoEditor.tsx:423-424`** — swatch dots computed from `resolveCampaignPalette()` output instead of the raw `swatchPrimary`/`swatchSecondary` fields (Decision 2).

### 7. Legacy cleanup (confirmed dead code, safe to remove)

- Delete `VideoScenePhotoSettings`, `VideoSceneTextSettings`, and the deprecated `VideoSceneSettings` wrapper (`VideoSceneSettings.tsx:149-296`) — grep-confirmed zero references outside the file; only `VideoSceneMetaSettings` is actually used (`VideoEditorSettings.tsx:11`).
- Delete `PropertyShowcaseComposition`, `AvailabilityPromoComposition`, `BookingPromoComposition`, `VideoTemplateProps` (`VideoCompositions.tsx:218-231`) — grep-confirmed zero references anywhere.
- **Do not delete** the `@deprecated`-tagged _data fields_ (`VideoScene.texts`/`textStyle`/`textLayout`/`hiddenElements`, `videoProjectTypes.ts:52,75,77-78`) — they're still load-bearing as the backward-compat write-target for old saved rows via `persistSceneLayers()`/`legacyFieldsFromLayers()` (`videoSceneLayers.ts`). Instead, tighten the existing `@deprecated` comments to explicitly say "derived/write-only, not a source of truth — read `layers`" so a future contributor doesn't reach for them by mistake.

## Docs to update

Per this repo's documentation-maintenance convention, in `docs/guides/routes/org/property/marketing.md`:

- **Video bullet (~line 55)** — currently pure mechanical/feature description with no design-system statement (unlike Design's line 54, "12 presets, Quiet Coast design system"). Add the equivalent: 12 templates across 4 categories, each with its own font pairing, motion signature (zoom/pan/spring), and transition pair; brand color auto-tints accent (except `fully-booked`/`giveaway-raffle`, which keep a fixed designer palette); note the expanded 9-transition library and new per-scene Motion override.
- **Shared-categories sentence (~line 50)** — add `giveaway-raffle` and `fully-booked-waitlist` to the category lists (parity with the same update Marketing 2 made for Design).
- **Implementation map (~lines 156-158)** — add rows for `lib/video/videoMotionProfiles.ts` and `lib/video/videoTemplateTypography.ts`.

## Verification

No test suite exists in this repo. Verify via:

1. **Static checks** (from `ui/`): `bun run type-check`, `bun run lint`, `bun run build`. The threading changes across ~13 call sites (Decision 6) are exactly what `tsc` catches if one is missed; deleting dead exports (Decision 7) will surface any missed reference as a build error.
2. **Manual, in the running dev server**, at `/org/:orgSlug/property/:propertySlug/marketing` → Video tab:
   - **Per-template visual + motion check**: all 12 templates × 3 formats — confirm each renders with its own font pairing, motion signature (zoom/pan/spring feel visibly differs when scrubbing the player), and transition pair; confirm the `slots` category's shared `clock-wipe` CTA motif reads as intentional, not a bug.
   - **Gallery-count variation**: test with properties having 1/2/3/4+ gallery photos to confirm `buildGalleryScenes`' existing scene-count logic still works correctly with the new per-baseId transition/motion resolution layered on top.
   - **Brand-color tint**: switch org/property brand color, reselect a brand-tinted template, confirm accent updates with legible `accentForeground` against both a dark and pale test brand hex; confirm `fully-booked` and `giveaway-raffle` stay fixed regardless.
   - **Swatch-picker honesty**: confirm the sidebar swatch dot for each template now visually matches what actually renders in the preview (the core bug this plan fixes).
   - **Per-scene Motion override**: change a scene's Motion select away from its template default, confirm it persists and doesn't get clobbered by the template-level default on reload.
   - **Backward compatibility**: open an old saved video template created before this change (no `motionProfile`/new font-pairing data), confirm it still loads and renders using the documented fallback profile — no crash, no visual regression.
   - **Export/publish**: Download MP4 and confirm the exported file matches the live preview's motion/transitions/typography; Publish to Instagram via the existing Meta flow, confirm it still succeeds end-to-end.
   - **Thumbnail cache correctness**: hard-refresh, confirm sidebar thumbnails reflect the new per-template identity (exercises the `v5` cache-key bump) rather than stale bland renders.
   - **Legacy cleanup sanity**: `bun run build` succeeds after deleting the 2 groups of dead exports; confirm nothing in the Design tab or shared `MarketingTemplatesPanel`/`useMarketingCatalog` broke (both untouched but share chrome/category constants).

### Critical files

- `ui/src/features/dashboard/marketing/lib/videoCampaignTemplates.ts` — 12 baseId defs, `preservePresetPalette`/`presetAccent` fields, 2 new `defaultVideoFields()` cases
- `ui/src/features/dashboard/marketing/lib/video/videoMotionProfiles.ts` — new, per-baseId motion profiles + fallback
- `ui/src/features/dashboard/marketing/lib/video/videoTemplateTypography.ts` — new, per-baseId font pairings
- `ui/src/features/dashboard/marketing/lib/video/videoProjectDefaults.ts` — per-baseId transition defaults replacing `ctaTransitionForCategory()`
- `ui/src/features/dashboard/marketing/lib/video/videoLayerTypography.ts` — palette/font-pairing threading through typography resolution
- `ui/src/features/dashboard/marketing/components/video-editor/VideoCompositions.tsx` — motion-profile-driven `SceneLayers`, 5 new transition cases, deprecated alias removal
- `ui/src/features/dashboard/marketing/components/video-editor/VideoSceneSettings.tsx` — new Motion select, expanded Transitions list, deprecated component removal
- `ui/src/features/dashboard/marketing/components/video-editor/VideoRemotionPlayer.tsx`, `lib/renderMarketingVideoThumbnail.ts`, `lib/exportVideoMedia.ts` — palette/motion/font resolution threading for preview, thumbnails, and export
- `ui/src/features/dashboard/marketing/lib/marketingTemplateThumbnailCache.ts` — `videoPresetThumbnailKey` version bump `v4` → `v5`
- `ui/src/features/dashboard/marketing/lib/designBrandColors.ts` — reused as-is (no changes), imported by Video for the first time
- `docs/guides/routes/org/property/marketing.md` — doc updates
