---
stage: done
title: 'Marketing 2: Improve Marketing Design Templates & Customizability — Implementation Plan'
status: done
tags: [planning, planned-modules, marketing, templates]
updated: 2026-08-01
---

# Marketing 2: Improve Marketing Design Templates & Customizability — Implementation Plan

**Status:** Implemented 2026-07-31, then **fully redesigned 2026-08-01** (see [Redesign — 2026-08-01](#redesign--2026-08-01-editorial-quiet-coast-system) below). Sibling to `docs/planning/planned_modules/marketing-calendar-templates.md` (Marketing 1, implemented).

The original 2026-07-31 implementation (shapes-heavy: stars, hexagons, sunbursts, ribbons — described in Decisions 1-6 below) shipped, passed type-check/build, and matched this plan's spec exactly — but the user rejected the visual result outright as "very ugly," "not even postable," and asked for a full redesign with research into elegant, Instagrammable references. The sections below are kept as a historical record of the first pass; the **current** implementation is the "Quiet Coast" editorial system described in the Redesign section, which replaced every builder in `polotnoCampaignDocuments.ts` and removed all shape-based decoration.

## Context

The Marketing Content Studio's **Design** tab (`/org/:orgSlug/property/:propertySlug/marketing`) renders OpenPolotno canvas documents for social graphics ("campaign templates"). Per `docs/planning/CLAUDE_TO_PLAN.md` (lines 84-88, "Marketing 2"): "canvas templates are too plain and does not look good... each template should be production ready and 'instagramable' and ready to publish with confidence and excitement to their social platforms."

Investigation (two Explore agents + a Plan agent + direct verification of every critical file) confirms the root cause: `buildPolotnoCampaignDocument()` (`ui/src/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments.ts:447-476`) drives **10 base presets → 21 format-variant documents** (`ui/src/features/dashboard/marketing/lib/designCampaignTemplates.ts:23-104`) through only **5 builder functions** (`buildPromoAmount`, `buildPromoPerk`, `buildSlots`, `buildGiveaway`, `buildFullyBooked`, lines 242-390) — `giveaway` and `fully-booked` each have exactly one builder and zero style choice. Every document is structurally identical: `campaignPageBackground()` (property photo or gray fallback) + one fixed `photoOverlay()` dark scrim + stacked text/pill/card primitives with **flat solid fills only**. Zero current builders set any of Polotno's already-available depth properties — `shadowEnabled`, `blurEnabled`, `blendMode`, `filters`, gradient `fill` strings, varied `cornerRadius`, `rotation` — confirmed present on the model at `node_modules/openpolotno/src/model/shape-model.ts:39-74`. This directly explains "too plain."

Marketing 1 (Calendar, implemented) and Marketing 3 (Video, out of scope) are architecturally separate systems, **except**: Design's `CampaignCategory` type (`designCanvasTypes.ts:3`, `'promo' | 'slots' | 'giveaway' | 'fully-booked'`) is a single shared type also imported by `videoCampaignTemplates.ts:1` and hardcoded into `useMarketingCatalog.ts:38`'s `BUILTIN_CATEGORIES` constant — confirmed via direct read. Adding a new category id would silently add an empty/broken category to the Video tab's sidebar too, since Video has no templates for it. This constrains the preset-architecture decision below: **no new categories**.

## Decisions made with the user (do not re-litigate)

1. **Scope: Replace**, not refine — expanded preset library in `designCampaignTemplates.ts` + `polotnoCampaignDocuments.ts`, same "replace not tweak" pattern Calendar used.
2. **Brand color: Auto-apply** by default, with a `preservePresetPalette`-equivalent escape hatch per preset (parity with Calendar's system).
3. **Decoration: Shapes library only.** The editor's built-in Shapes panel (`kamePolotnoShapes.ts` — rect, circle, star, triangle, rightTriangle, diamond, pentagon, hexagon, speechBubble, cross, arc, cloud, arrows, 2 custom pill/badge rects) already works with zero setup. Explicitly **not** pursuing Polotno's hosted Nounproject icon-search/stock-photo/AI-image/remove-background API — confirmed via web search this requires a paid SDK key (Team $199/mo, Business $399/mo, only a 60-day free dev trial), and the user declined that recurring cost once informed of it.
4. **Format coverage: full 3-format.** Every redesigned preset supports all 3 aspect ratios: `instagram-post` (1080×1080), `instagram-story` (1080×1920), `facebook-post` (1200×630). Today only 3 of 10 baseIds (`promo-10-off`, `promo-free-parking`, `fully-booked`) even list `facebook-post` — confirmed in `designCampaignTemplates.ts`.

## Decision 1 — Preset/category architecture

**Keep category = campaign-type** (`promo`/`slots`/`giveaway`/`fully-booked`, unchanged — no `CampaignCategory` type change, no Video impact). Add real visual variety **within** each category by giving every baseId its own dedicated builder function instead of today's "N baseIds share 1 builder" pattern, and add exactly **one new baseId to the two categories that currently have zero style choice**:

- `giveaway` → add **`giveaway-raffle`** (ticket-stub alternative to the existing prize-banner treatment)
- `fully-booked` → add **`fully-booked-waitlist`** (softer CTA-card alternative to the existing ink-stamp treatment)

No other new baseIds — this directly answers "should we add new campaign types" without over-scoping into a new module.

**Result: 10 → 12 base presets, 5 → 12 builder functions (one per baseId), 12 × 3 formats = 36 total documents** (up from 21 — format-coverage is the main driver of growth, not baseId count).

| Category       | BaseIds                                                                                        | Builders (new, one per baseId)                                                       |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `promo`        | `promo-500-off`, `promo-300-off`, `promo-10-off`, `promo-free-breakfast`, `promo-free-parking` | Poster Slab, Gradient Glow, Ticket Stub, Perk Badge (sunburst), Perk Badge (hex-tag) |
| `slots`        | `slots-1`, `slots-3`, `slots-5`                                                                | Spotlight, Cards, Strip                                                              |
| `giveaway`     | `giveaway`, **`giveaway-raffle`** (new)                                                        | Spotlight, Raffle                                                                    |
| `fully-booked` | `fully-booked`, **`fully-booked-waitlist`** (new)                                              | Stamp, Waitlist                                                                      |

## Decision 2 — Brand-color helper

**Architectural divergence from Calendar (important):** Calendar's `CalendarStyles` is a typed object re-rendered live by `CalendarPreview.tsx`, so `applyBrandAccentToCalendarStyles()` mutates named fields and the UI re-derives. Design's canvas is an **imperative Polotno store** — `buildPolotnoCampaignDocument()` returns a flat, untyped `PolotnoChild[]` tree (`Record<string, unknown>`) consumed once via `store.loadJSON()`; there's no re-render-from-styles path, and colors live scattered across `fill`/`stroke`/`shadowColor`/gradient stops. A post-hoc "find and replace this hex" pass would be fragile and could clobber a host's manual edits. **Resolve brand color into a typed palette object _before_ generation and pass it into the builder**, not a post-hoc patch.

**Apply at document-build time only** — same "fresh preset load" boundary Calendar uses for property photos, not live re-sync (Design has no existing re-sync mechanism at all today, unlike Calendar's brand-color `useEffect`). If org brand color changes while a design is open, the host must Reset or reselect the preset to pick it up.

**New file:** `ui/src/features/dashboard/marketing/lib/designBrandColors.ts` (mirrors `calendarBrandColors.ts`'s shape and its `mixHex`/`parseHex`/`toHex` helpers — confirmed at `calendarBrandColors.ts:16-48` — small enough to duplicate rather than share, matching how that file itself has no shared dependencies):

```ts
export type CampaignPalette = {
  accent: string; // was ORANGE — brand-tinted by default
  accentDark: string; // accent mixed ~18% toward black — shadows/secondary depth
  accentForeground: string; // '#ffffff' or ink, chosen by luminance so text/icons on accent stay legible even for a pale brand hex
  ink: string; // was BROWN — fixed, not brand-driven (legibility)
  cream: string; // was CREAM — fixed
  success: string; // was GREEN — fixed (semantic)
  danger: string; // was RED — fixed (semantic)
};

export type ApplyBrandAccentOptions = {
  preservePresetPalette?: boolean; // keep designer-authored accent instead of brand hex
};

export function resolveCampaignPalette(
  brandColor?: string,
  options?: ApplyBrandAccentOptions
): CampaignPalette;
```

`preservePresetPalette` is a new optional field on `BaseCampaignTemplate` (`designCampaignTemplates.ts:15-21`), flattened onto `CampaignTemplateDef` (`designCanvasTypes.ts:29-35`). Set `true` for exactly 2 of the 12 presets: `fully-booked` (ink-stamp motif should stay black/red regardless of brand) and `giveaway-raffle` (red/gold ticket motif). All other 10 default to brand-tinted.

**`buildPolotnoCampaignDocument()` signature change** (`polotnoCampaignDocuments.ts:447-476`):

```ts
buildPolotnoCampaignDocument(
  templateId: string,
  binding: DesignBinding,
  options?: { brandColor?: string }
): PolotnoDesignDocument | null
```

Inside: `const palette = resolveCampaignPalette(options?.brandColor, { preservePresetPalette: template.preservePresetPalette })`. `BUILDERS` registry type (line 392) changes from `(binding, layout) => PolotnoChild[]` to `(binding, layout, palette) => PolotnoChild[]`. All 12 builders read `palette.accent/ink/cream/success/danger/accentDark/accentForeground` instead of the module-level `ORANGE/BROWN/CREAM/GREEN/RED` constants (lines 9-13). **Fix while touching this code**: `slotCard()` (lines 151-199) hardcodes `'#7c4a2d'` directly instead of referencing `BROWN` at all — an existing drift bug; switch to `palette.ink`.

### Threading — every call site that builds or keys a document (verified against actual source, not assumed)

1. **`polotnoCampaignDocuments.ts:447`** — signature change (source of truth), plus `photoOverlay()` (lines 64-79) gains optional `overlayColor`/`overlayOpacity` params (default to today's `rgba(15,23,42,0.42)`) so individual builders can tune scrim depth/blend for their treatment.
2. **`PolotnoDesignStudio.tsx:163`** (`applyTemplate`, used by both preset-select and Reset via `handleResetDesign:250`) — call becomes `buildPolotnoCampaignDocument(templateId, bindingRef.current!, { brandColor })`. The `useCallback` dep array is currently `[]` (line 184) — **must add `brandColor`**, otherwise the closure goes stale.
3. **`PolotnoDesignStudio.tsx:175`** — `designPresetThumbnailKey(templateId)` inside `applyTemplate` → `designPresetThumbnailKey(templateId, brandColor)`.
4. **`PolotnoDesignStudio.tsx:411-446`** (bulk sidebar-thumbnail priming effect) — line 428's `designPresetThumbnailKey(templateId)` and lines 431-434's `renderDesignPresetThumbnail(templateId, DEFAULT_MARKETING_THUMB_BINDING)` both need `brandColor` added.
5. **`PolotnoDesignStudio.tsx:454-473`** (`<MarketingTemplatesPanel>` JSX) — currently passes **no** `brandColor` prop at all (verified — Video's identical usage does pass it). Add `brandColor={brandColor}` (already computed at line 90).
6. **`MarketingTemplatesPanel.tsx:141-144`** — the `contentType === 'design'` branch of the `thumbnailOptions` `useMemo` currently builds `{ contentType: 'design', presetIds: visiblePresetIds }` only, omitting `brandColor` (the `'video'` branch at lines 134-140 already includes it). Add `brandColor` to the design branch. The `useMemo` dep array (line 145) already lists `brandColor` — no change needed there.
7. **`useMarketingTemplateThumbnails.ts:54-58`** (`DesignOptions` type) — add `brandColor?: string;` (mirrors `VideoOptions.brandColor` at line 64).
8. **`useMarketingTemplateThumbnails.ts:211` — real gap the initial design pass missed, must fix:** `const brandColor = options.contentType !== 'design' ? options.brandColor : undefined;` **explicitly zeroes out brandColor for `contentType === 'design'`, regardless of what's on `options`.** Adding the field in step 7 alone does nothing without also fixing this line — change the condition to include `'design'` (e.g. `options.contentType === 'design' || options.contentType === 'video' ? options.brandColor : undefined`, since `'calendar'` already reads its own `brandColor` via the same variable one branch later in the surrounding logic).
9. **`useMarketingTemplateThumbnails.ts:283`** (hydration effect, `cacheKeys` map) — `designPresetThumbnailKey(id)` → `designPresetThumbnailKey(id, brandColor)`.
10. **`useMarketingTemplateThumbnails.ts:380, 384, 388`** (render-missing effect, design branch) — `cacheKey = designPresetThumbnailKey(id)` (line 380) and both `renderDesignPresetThumbnail(id, DEFAULT_MARKETING_THUMB_BINDING)` calls — the primary render (line 384, inside `ensurePresetThumbnail`) and the retry-after-300ms fallback (line 388) — all three need `brandColor` added.
11. **`renderMarketingDesignThumbnail.ts:26-31`** (`renderDesignPresetThumbnail`) — add `brandColor?: string` param, pass through to `captureDesignPresetThumbnail(templateId, binding, brandColor)`. **Note**: `captureDesignPresetThumbnail` (`designPresetThumbnailCapture.ts:36-69`) already has a 3rd `signal?: AbortSignal` param — preserve it; insert `brandColor` before `signal` in the new signature, don't drop it.
12. **`designPresetThumbnailCapture.ts:3-6, 10-15, 36-69`** — `DesignPresetThumbnailCaptureFn` type, `registerDesignPresetThumbnailCapture`, and `captureDesignPresetThumbnail` all gain a `brandColor?: string` param, threaded to `capturePresetFn(templateId, binding, brandColor)`.
13. **`MarketingPolotnoThumbnailHost.tsx`** — `CaptureRequest` type (lines 19-23) gains `brandColor?: string`; `enqueueCapture` (lines 71-80) accepts and forwards it; the `buildPolotnoCampaignDocument(activeRequest.templateId, activeRequest.binding)` call (line 122) becomes `buildPolotnoCampaignDocument(activeRequest.templateId, activeRequest.binding, { brandColor: activeRequest.brandColor })`.
14. **`marketingTemplateThumbnailCache.ts:89-91`** — `designPresetThumbnailKey(templateId: string): string` (currently `design:preset:v3:${templateId}`) gains a `brandColor?: string` param, folded in exactly like `videoPresetThumbnailKey` (lines 101-108) already does: `` `design:preset:v4:${resolveOrgBrandHex(brandColor).toLowerCase()}:${templateId}` ``. **Bump `v3` → `v4`** so every pre-redesign cached thumbnail is invalidated on deploy (same convention Calendar used going to `v8`, Video to `v4`).

No changes needed to `useMarketingCatalog.ts`, `KamePolotnoEditor.tsx`, or `KameSidePanelCollapse.tsx` — brand color already flows into `KamePolotnoEditor` as a prop for the _editor chrome's_ background-panel swatches (`KamePolotnoEditor.tsx:35,45`), a separate, already-working concern from the _document-generation_ palette this section adds.

## Decision 3 — New/expanded visual builders

`PolotnoChild.fill` accepts CSS gradient strings (`linear-gradient(...)`/`radial-gradient(...)`) — Polotno's renderer resolves them for both page background and figure fill, so gradients need no extra plumbing. All shape subtypes below are already registered in `kamePolotnoShapes.ts` and backed by `openpolotno`'s figure renderer — confirmed working, no API dependency.

### Per-preset geometry + showcase brief

| Preset (baseId)                                | Geometry / decoration                                                                                                                                                                                                                           | Showcase                                             | Palette       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| `promo-500-off` — Poster Slab                  | Rotated (-6°) banner ribbon behind headline; amount on a `cornerRadius:28` plaque filled `radial-gradient(circle at 30% 20%, accentLight, accent)`; `shadowEnabled` (blur 24, offsetY 10) on the ribbon; 2 small `star` shapes near top corners | rotation, radial gradient, shadow, star shape        | brand         |
| `promo-300-off` — Gradient Glow                | Full-bleed `linear-gradient(160deg, accent, accentDark)` wash (`blendMode:'multiply'`) over the scrim; large blurred `circle` glow (`blurEnabled`, radius 60, opacity .35) behind headline; amount plaque `cornerRadius:999` (full pill)        | linear gradient, blendMode, blur glow, pill radius   | brand         |
| `promo-10-off` — Ticket Stub                   | Dashed-border card (`dash:[10,6]`, `strokeWidth:3`); 2 small page-background-colored `circle`s at left/right mid-edge faking perforation notches; `speechBubble` shape for the CTA                                                              | dashed stroke, speechBubble shape, perforation trick | brand         |
| `promo-free-breakfast` — Perk Badge (sunburst) | Circular badge ringed by 8 thin `rect` "rays" at 45° rotation increments; `shadowEnabled`; `arc` swoosh under perk text                                                                                                                         | rotation array, arc shape, shadow                    | brand         |
| `promo-free-parking` — Perk Badge (hex-tag)    | `hexagon` badge with a smaller stroke-only inset hexagon (two-tone bevel); soft accent glow behind it at `blendMode:'screen'`                                                                                                                   | hexagon shape, layered stroke shape, blendMode       | brand         |
| `slots-1` — Spotlight                          | One hero card (`cornerRadius:32`); stroke-only `circle` ring (`dash:[2,10]`, `rotation:12`); rotated (-8°) pill ribbon "LAST SLOT" with `shadowEnabled`                                                                                         | dashed ring, pill shape, rotation, shadow            | brand         |
| `slots-3` — Cards                              | 3-card row: `shadowEnabled` per card, alternating `rotation` (-3°/0°/3°) for a scattered feel, thin dashed baseline connecting them                                                                                                             | shadow, alternating rotation, dashed connector       | brand         |
| `slots-5` — Strip                              | 5 pill chips linked by a `linear-gradient(accent→transparent)` line, on a translucent (`opacity .14`, `blurEnabled`) "frosted glass" card                                                                                                       | pill chips, gradient line, blur/opacity glass        | brand         |
| `giveaway` — Spotlight                         | Existing prize banner + `shadowEnabled`; sheen rect at `blendMode:'overlay'`; 3 `star` sparkle accents; rules text moved onto a `cornerRadius:14` card                                                                                          | blendMode overlay, star sparkles, card-ized text     | brand         |
| `giveaway-raffle` **(new)**                    | Dashed vertical divider splitting prize/rules; 2 perforation `circle` notches; `diamond` "seal" badge                                                                                                                                           | dashed divider, diamond shape                        | **preserved** |
| `fully-booked` — Stamp                         | Rotated (-8°) double-border "stamp" (outer dashed, inner solid); heavy `shadowEnabled`; `blendMode:'multiply'` grunge wash                                                                                                                      | rotation, double border, blendMode                   | **preserved** |
| `fully-booked-waitlist` **(new)**              | `hexagon` "Join Waitlist" CTA badge; `arc` swoosh under headline; frosted card for subtext                                                                                                                                                      | hexagon shape, arc shape, frosted card               | brand         |

This gives `star`, `speechBubble`, `arc`, `diamond`, `hexagon`, dashed strokes, and the custom pill/badge rects each a deliberate home, plus shadow/blur/gradient/blendMode/opacity/cornerRadius/rotation used repeatedly instead of left at defaults everywhere.

## Decision 4 — Full 3-format support

`createCampaignLayout()` (`polotnoCampaignDocuments.ts:40-53`) already scales font/position off `short = min(width, height)`, but every ratio-table helper (e.g. `promoVerticalRatios()`, lines 221-240) branches only on `isPortrait` (`height > width * 1.05`, line 46) — **square (1:1) and `facebook-post` (1.9:1, only 630px tall) both fall into the same "non-portrait" branch today**, and most baseIds have literally never been rendered at `facebook-post` before (only 3 of 10 currently list it). This is untested territory, not a known-working path being extended.

**Fix**: extend `CampaignLayout` with a third band, `isWide: boolean` (`width / height > 1.3`, true only for `facebook-post`). Update every ratio-table helper to branch three ways — portrait / square / wide — with the wide band using tighter vertical gaps and smaller font-size ratios for builders with more than ~3 stacked vertical bands (all `promo*`, `giveaway*`, `fully-booked*`), since 630px absolute height leaves much less room than 1080/1920px even at identical ratios. `slots-3`/`slots-5` (primarily horizontal, centered on `layout.width`) need less adjustment. All 12 baseIds get `formats: ['instagram-post', 'instagram-story', 'facebook-post']` in `designCampaignTemplates.ts`.

## Decision 5 — Property-photo handling: leave inline, no new helper file

Calendar's `calendarPropertyPhoto.ts` exists because `CalendarStyles.container.background` is a structured object needing a `type !== 'image'` guard and preservation of sibling fields (`imageSize`/`imagePosition`/`overlay`). Design's `page.background` is a flat `string`, and Polotno's own page renderer already auto-detects color-vs-URL. `campaignPageBackground(binding.propertyPhoto, '#78716c')` (`polotnoCampaignDocuments.ts:59-61, 471`) is already a complete 2-line resolver — no branching logic worth extracting, and a wrapper file would be pure indirection. No code change needed here beyond what the palette/overlay work already touches.

## Decision 6 — Dead code removal

Confirmed via read + grep: `templateRegistry.ts` contains a second, completely unused generator (`DESIGN_TEMPLATES`, 80 procedurally-generated templates like "Coastal Calm"/"Urban Nights" via `generateTemplates()`, plus `templatesForFormat()`/`getDesignTemplate()`/`DesignPlaceholder`/`DesignTemplateElement`/`DesignTemplate` types and `PALETTES`/`photoElement()`/`buildTemplate()`/`FORMATS`/`VARIANTS`/`NAMES`) — **zero references anywhere outside the file itself**. Remove lines 3-31 and 42-234. **Keep** `DesignTemplateFormat` (line 1) and `DESIGN_FORMAT_DIMENSIONS` (lines 33-40) — both are live and imported by `designCampaignTemplates.ts`, `polotnoCampaignDocuments.ts`, `PolotnoDesignStudio.tsx`, etc. After deletion the file shrinks to ~40 lines with only the two still-used exports.

## Docs to update

Per this repo's documentation-maintenance convention, in `docs/guides/routes/org/property/marketing.md`:

- **Design-tab description (~line 41, 54)** — describe the redesigned library: 12 designer presets across the existing 4 categories, each with a genuinely distinct geometry (poster/ribbon, gradient-glow, ticket-stub, perk-badge ×2, spotlight, cards, strip, raffle, ink-stamp, waitlist-card) built from shadow/blur/gradient/blend-mode/rotation and the built-in shapes library — no external icon API. Note brand color auto-tints the accent role on load (not live-resynced — Reset or reselect to pick up a change), except `fully-booked` and `giveaway-raffle` which keep a fixed designer palette.
- **Shared-categories sentence (~line 50)** — add `giveaway-raffle` and `fully-booked-waitlist` to their category lists; note all 12 presets now render in all 3 formats.
- **Implementation map table (~lines 134-165)** — add a row for `lib/designBrandColors.ts` (parity with the existing `lib/calendarBrandColors.ts` row), near the `lib/polotno/polotnoCampaignDocuments.ts` row.
- No change to the Video section (out of scope, unaffected — confirmed `CampaignCategory` sharing doesn't require any Video-side doc update since no category was added).

## Verification

No test suite exists in this repo. Verify via:

1. **Static checks** (from `ui/`): `bun run type-check`, `bun run lint`, `bun run build`. The `buildPolotnoCampaignDocument`/`BUILDERS` signature change and the 14 call-site edits above are exactly what `tsc` will catch if one is missed.
2. **Manual, in the running dev server**, at `/org/:orgSlug/property/:propertySlug/marketing` → Design tab:
   - **Per-preset visual check**: all 12 presets × 3 formats — confirm shadows/gradients/blur/dashed strokes/perforation circles/shapes render correctly and nothing clips or overflows off-canvas, especially in `facebook-post`'s 630px height (the new `isWide` band is the riskiest untested surface).
   - **Brand-color tint**: switch org/property brand color, reselect a brand-tinted preset (e.g. `promo-500-off`), confirm the accent role updates with legible `accentForeground` text against both a dark and pale test brand hex. Confirm `fully-booked` and `giveaway-raffle` stay on their fixed palette regardless.
   - **No live re-sync (expected)**: changing brand color with a design already open should not change the canvas until Reset/reselect.
   - **Property-photo fallback**: property with/without gallery photos.
   - **Thumbnail cache correctness**: hard-refresh, confirm sidebar thumbnails match live canvas (exercises the new brand-aware `v4` cache key).
   - **Autosave/reset/undo-redo**: customize, confirm autosave persists and Reset reloads the brand-tinted default; Undo/Redo still function with richer element trees.
   - **No regressions**: Calendar and Video tabs unaffected — confirm Video's category list still shows `promo/slots/giveaway/fully-booked` with its own 10 templates.
   - **Dead-code removal sanity**: `bun run build` succeeds after deleting the unused `templateRegistry.ts` generator.

### Critical files

- `ui/src/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments.ts` — 12 builder functions, `BUILDERS` registry, signature/palette wiring, tunable `photoOverlay()`, 3-way `isPortrait`/`isWide` layout branching
- `ui/src/features/dashboard/marketing/lib/designCampaignTemplates.ts` — `BASE_TEMPLATES` (12 baseIds, full 3-format coverage, `preservePresetPalette` field, updated preview swatches)
- `ui/src/features/dashboard/marketing/lib/designBrandColors.ts` — new helper (`resolveCampaignPalette`, `CampaignPalette`, `ApplyBrandAccentOptions`)
- `ui/src/features/dashboard/marketing/lib/designCanvasTypes.ts` — `CampaignTemplateDef.preservePresetPalette` optional field
- `ui/src/features/dashboard/marketing/components/design-editor/PolotnoDesignStudio.tsx` — brand-color threading (call sites 2-5 above)
- `ui/src/features/dashboard/marketing/components/shared/MarketingTemplatesPanel.tsx`, `hooks/useMarketingTemplateThumbnails.ts`, `components/shared/MarketingPolotnoThumbnailHost.tsx`, `lib/designPresetThumbnailCapture.ts`, `lib/renderMarketingDesignThumbnail.ts`, `lib/marketingTemplateThumbnailCache.ts` — thumbnail-pipeline threading (call sites 6, 7-10, 13, 11-12, 14)
- `ui/src/features/dashboard/marketing/lib/templateRegistry.ts` — dead-code removal (lines 3-31, 42-234; keep lines 1, 33-40)
- `docs/guides/routes/org/property/marketing.md` — doc updates

## Redesign — 2026-08-01 ("Quiet Coast" editorial system)

### Why

The shapes-heavy first pass (stars, hexagons, sunbursts, dashed tickets, rotated ribbons) read as generic AI-template output, not a boutique-property brand. User feedback: "very ugly," "not even postable," explicitly called out overuse of shapes, and asked for research into elegant, Instagrammable canvas design plus a full replacement (not a polish pass).

### Research

Reviewed current editorial/travel Instagram design trends (minimalist boutique-hotel promos, gradient photo scrims, tracked small-caps labels, serif display headlines) to ground the direction instead of guessing.

### New design system

All 12 builders in `polotnoCampaignDocuments.ts` were rewritten from scratch around one repeated signature device — a slim inset frame — with the brand accent used sparingly (a hairline rule, a stroke-only ring, one small pill outline) and **never** as a filled shape or badge. No stars, hexagons, diamonds, sunbursts, dashed "ticket" borders, or rotation anywhere.

- **Fonts** (already preloaded in `ui/index.html`, no new font loading needed): `Fraunces` (display serif headlines, used at large sizes with restraint), `Jost` (tracked small-caps eyebrow labels and pill CTAs), `Plus Jakarta Sans` (body/detail copy), `Space Grotesk` (date numerals).
- **Photo treatment**: a bottom-anchored gradient scrim per preset (`CAMPAIGN_SCRIMS`) replaces the old flat dark overlay, so photos stay bright at the top and legible at the bottom.
- **Shared text helpers**: `eyebrow()` (tracked uppercase label), `heroText()` (serif headline), `detailText()` (body copy), `outlinePill()` (stroke-only CTA), `dateMark()` (numeral + day-name), `ringBadge()` (stroke-only circle), `thinRule()`/`thinVRule()` (hairline dividers) — every builder composes from these instead of one-off shape trees.
- Per-preset "designer" accents (raffle gold `#fbbf24`, fully-booked ink `#1c1917`) are still preserved via `preservePresetPalette`/`presetAccent` on the template def, same mechanism as the first pass.
- **2026-08-01 follow-up:** Removed the global `editorialFrame()` inset rectangle — it was appended as the topmost layer and its transparent fill intercepted canvas clicks, blocking selection of text/shapes underneath. Presets no longer ship that layer.

### Two critical rendering bugs found and fixed during visual QA (not caught by type-check/build)

Both bugs were invisible to `tsc`/`eslint`/`build` because they only manifest as garbled canvas output at render time. Found by building a temporary in-browser preview harness (`/dev/design-preview`, deleted before finishing this task) and inspecting the actual Polotno JSON documents via console logging, not by reading the code alone.

1. **`letterSpacing` unit mismatch.** OpenPolotno multiplies `letterSpacing` by `fontSize` before handing it to Konva (`node_modules/openpolotno/src/canvas/text-element.tsx:405`) — the field is an **em multiplier**, not a pixel offset. The first redesign pass authored values like `3.2`/`4` assuming CSS-style pixel tracking; at those values a single character plus its trailing gap exceeded the text box width, so every tracked-caps label (eyebrows, pills, footer, date day-names) wrapped into a vertical stack of single letters. Fixed by converting every `letterSpacing` value in `polotnoCampaignDocuments.ts` to the correct em range (`0.14`–`0.18` for tracked labels, `-0.02` for tightened large numerals), and added a code comment on `InlineTextOptions` documenting the unit so it isn't reintroduced.
2. **Spreading an options object with an explicit `key: undefined` clobbers a computed default.** `heroText()` always built `{ ..., width: options?.width, align: options?.align }` even when the caller passed neither — so `width`/`align` were explicit keys with value `undefined` in the object, and spreading that object (`...options`) _after_ `centeredText()`'s computed full-width fallback silently reverted `width` back to `undefined`. The Polotno text model then applied its own schema default (`width: 100`), so any headline built via `heroText()` without an explicit width (`₱500 off`, `Breakfast`/`Parking`, `Free 2D1N\nStaycation`, `Waitlist`) rendered at a 100px-wide box and wrapped to one character per line. Fixed with a new `omitUndefined()` helper applied in both `text()` and `centeredText()` before spreading, so an explicitly-`undefined` key is treated the same as an absent key.

A third, non-bug issue found in the same pass: `buildPromo300OffSplit`'s `₱300\noff` headline used a "hero" font-size ratio sized for the full canvas width inside a ~44%-width accent-panel column, wrapping mid-word. Rewrote that builder's vertical rhythm to compute font size from the actual column width and lay out the eyebrow/amount/rule/detail blocks with a running cursor instead of hand-tuned fixed ratios.

### Verification

- Visual QA across all 12 presets × 3 formats (`instagram-post`, `instagram-story`, `facebook-post`) via the temporary preview harness + Playwright screenshots, at both small (grid overview) and large (per-card, 900-1400px) sizes.
- `bun run type-check`, `bun run build` pass. `bun run lint` shows the same single pre-existing `TeamMembersTab.tsx` conditional-hook error as before this change (unrelated) plus warnings only.
- Thumbnail cache key bumped `design:preset:v5` → `v6` in `marketingTemplateThumbnailCache.ts` so every previously-cached (broken) thumbnail is invalidated.
- Temporary harness (`DesignPresetPreviewDevPage.tsx` + its `/dev/design-preview` dev-only route in `ui/src/features/guest/routes/index.tsx`) deleted after verification, per the plan.

### Critical files (redesign)

- `ui/src/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments.ts` — full builder rewrite, `omitUndefined()` helper, letterSpacing unit-comment, `buildPromo300OffSplit` cursor-based layout
- `ui/src/features/dashboard/marketing/lib/marketingTemplateThumbnailCache.ts` — `designPresetThumbnailKey` cache version `v5` → `v6`
