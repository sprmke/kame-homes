---
title: 'Marketing Studio: collage editor + module restructure'
stage: planned
status: not started
tags: [marketing, design-editor, polotno, collage, media, performance]
updated: 2026-09-14
kind: plan
---

# Marketing Studio: collage editor + module restructure

## Context

Marketing Studio today has four tabs — Calendar, Design (Polotno canvas), Video (Remotion), Generate (AI) — at `ui/src/features/dashboard/marketing/pages/MarketingStudioPage.tsx`. Hosts who want a multi-photo promo (a 2×2 of the bedroom/kitchen/pool/view, a before/after pair, a "5 rooms" strip) currently leave the product, build the collage in Canva or a phone app, and come back to upload the flattened result. That is the single most common reason to exit the Studio mid-task.

The goal is a collage composer that is _native to the Design canvas_, not a second editor bolted beside it. Decisions locked with the user:

1. **Collage is a mode inside the Design tab**, not a fifth tab. Tab count stays at 4.
2. **Collage cells stay live and editable** on the canvas — no flattening. Overlay text, stickers and logo go on top as normal Polotno elements.
3. **The upload-persistence bug is fixed in scope** (uploads currently become `blob:` URLs that die on reload).
4. **No new plan key** — collage inherits the existing Pro+ `marketingStudio` gate.

### The finding that shapes the whole design

Polotno's `ImageElement` (`node_modules/openpolotno/src/model/image-model.ts:5-23`) already carries every attribute a collage cell needs:

```ts
cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1,   // normalized pan+zoom of the photo inside the frame
cornerRadius: 0, clipSrc: '',                       // rounded corners / SVG mask
borderColor: 'black', borderSize: 0,                // cell borders
flipX, flipY, keepRatio, stretchEnabled
```

…plus a built-in `toggleCropMode()` (`image-model.ts:33-42`) that opens Polotno's own drag-to-reposition crop UI and wraps it in a history transaction. And `Node.custom` is a frozen field that survives `toJSON()` (`node-model.ts:13`, `store.ts:68,865`).

**A collage cell is therefore just an image element**: the element rect is the cell frame, the crop rect is the photo inside it, `custom` tags it as a cell. This means:

- **Zero new dependencies.** No fabric, no new collage library, no extra bytes in the bundle.
- **Zero new export/save/publish/thumbnail code.** `store.toBlob()`, `useMarketingAutoSave`, `PublishDialog` and `renderDesignStoreThumbnail` all already work on whatever is on the canvas.
- **"Connected to the Canvas editor" is free** — there is no handoff, because it _is_ the canvas.

Any approach that introduced a separate collage surface would duplicate all of that and add bundle weight for a feature Polotno already supports.

## What already exists (do not rebuild)

| Need                                    | Reuse                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Canvas + store + undo/redo              | `lib/polotno/polotnoStore.ts` (`createPolotnoStore`), `components/design-editor/polotno/KamePolotnoEditor.tsx`             |
| Document builder idioms                 | `lib/polotno/polotnoCampaignDocuments.ts` — `createCampaignLayout()`, `band()`, `uid()`, `omitUndefined()`, `photoImage()` |
| Cover-crop maths                        | `lib/polotno/orgLogoCircle.ts` → `squareImageCoverCrop()`, `loadLogoNaturalSize()`                                         |
| Autosave (debounced, fingerprint-gated) | `hooks/useMarketingAutoSave.ts` + `hooks/usePolotnoStoreFingerprint.ts`                                                    |
| Persistence                             | `marketing_templates` table, `hooks/useMarketingTemplates.ts`, `supabase/functions/marketing-templates/`                   |
| Export / download / publish             | `exportPolotnoStoreImage()`, `PolotnoDesignStudio.tsx:638-700`, `PublishDialog`                                            |
| Property photo picker                   | `components/design-editor/polotno/PropertyMediaPanels.tsx`, `lib/polotno/propertyMedia.ts`                                 |
| Image optimisation before upload        | `ui/src/lib/media/prepareUpload.ts` (`prepareUpload`, preset `PHOTO_MASTER`, surface `property-media`)                     |
| Side panel shell + collapse             | `polotno/KameSidePanelShell.tsx`, `KameSidePanelCollapse.tsx`                                                              |
| Plan gate                               | `useFeatureGate('marketingStudio')`, `TierBadgeAnchor`, `useUpgradeModal`                                                  |
| Permissions                             | `hooks/useMarketingPermissions.ts` (`marketing.templates:add                                                               | edit`) |
| Mobile editor dock                      | `MarketingEditorSidebar`, `MarketingEditorMobileToolbar`                                                                   |

---

## Part 1 — Collage data model

### Document-level state

Stored in the Polotno store's own `custom` field, so it round-trips through `store.toJSON()` / `loadJSON()` and through `design_json.polotno` with no schema change:

```ts
// ui/src/features/dashboard/marketing/lib/collage/collageTypes.ts   (new)
export type CollageSettings = {
  version: 1;
  layoutId: string;
  gap: number; // px between cells, at document scale
  outerPadding: number; // px frame around the whole collage
  cornerRadius: number; // px, applied per cell
  borderSize: number; // px, 0 = none
  borderColor: string;
  backgroundColor: string;
};

export type CollageCellRef = { collageCellId: string }; // lives on element.custom
```

`store.custom = { ...store.custom, collage: CollageSettings }`. A document is a collage iff `store.custom?.collage` exists.

### Layout registry

Layouts are pure data in normalized 0–1 space, so one definition serves all three formats:

```ts
// ui/src/features/dashboard/marketing/lib/collage/collageLayouts.ts   (new)
export type CollageCellRect = { xr: number; yr: number; wr: number; hr: number };
export type CollageLayout = {
  id: string;
  name: string;
  cellCount: number;
  bestFor?: DesignTemplateFormat[]; // sort hint only, every layout works in every format
  cells: CollageCellRect[];
};
```

Ship ~14 layouts covering 2–9 cells: `duo-v`, `duo-h`, `trio-left-hero`, `trio-strip`, `quad-grid`, `quad-left-hero`, `quint-mosaic`, `hex-grid`, `nine-grid`, `story-stack-3`, `story-hero-2`, `film-strip-4`, `before-after`, `polaroid-scatter`. Each is ~6 lines of literal data — no runtime layout engine, no solver.

**Cell cap: 9.** Beyond that, cells are under 300px at 1080 and both legibility and memory degrade sharply.

### Frame → element mapping

```
element.x      = outerPadding + cell.xr * innerW + (gap/2 adjustments)
element.y      = outerPadding + cell.yr * innerH + …
element.width  = cell.wr * innerW - gap
element.height = cell.hr * innerH - gap
element.cornerRadius = settings.cornerRadius
element.borderSize/borderColor = settings.*
element.custom = { collageCellId }
element.name   = 'Collage cell'
element.keepRatio = false
element.stretchEnabled = false
+ cover crop (below)
```

### Cover crop

Generalize the existing square-only helper. Add beside it in `lib/polotno/orgLogoCircle.ts`, or better, move both into a new `lib/collage/coverCrop.ts` and re-export from `orgLogoCircle.ts` to avoid touching call sites:

```ts
export function coverCropForFrame(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number };
```

`squareImageCoverCrop(w, h)` becomes `coverCropForFrame(w, h, 1, 1)`. This is the only maths the feature needs.

---

## Part 2 — Collage engine (pure functions, unit-tested)

`ui/src/features/dashboard/marketing/lib/collage/collageDocument.ts` (new) — no React, no Polotno import, fully testable under the repo's Node-env Vitest:

| Function                                                      | Responsibility                                                                                                                          |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `buildCollageDocument(layout, photos, settings, format)`      | Returns a full `PolotnoDesignDocument` — background rect + N tagged image children. Used for "create a collage from scratch".           |
| `collageFrames(layout, settings, width, height)`              | Pure geometry: layout + settings → array of `{x,y,width,height}`.                                                                       |
| `readCollageSettings(storeJson)` / `withCollageSettings(...)` | Read/merge the `custom.collage` block.                                                                                                  |
| `planRelayout(currentCells, nextLayout, settings, w, h)`      | Diff current cells against a new layout: which cells keep their `src`, which are new (empty), which are dropped. Preserves photo order. |

`ui/src/features/dashboard/marketing/lib/collage/collageStoreOps.ts` (new) — the only file that touches the live MST store:

```ts
applyCollageLayout(store, layoutId); // relayout in place, preserving srcs
applyCollageStyle(store, patch); // gap / radius / border / padding / background
setCollageCellPhoto(store, cellId, url); // swap one photo, recompute cover crop
swapCollageCells(store, aId, bId); // reorder by drag
clearCollageCell(store, cellId);
enterCellCropMode(store, cellId); // -> element.toggleCropMode(true)
```

**Every one of these wraps its mutations in `store.history.startTransaction()` / `endTransaction()`.** Without this, changing a 9-cell layout produces 9 separate undo entries — the single most likely quality bug in this feature.

---

## Part 3 — UI

### Entry point

`MarketingTemplatesPanel` (`components/shared/MarketingTemplatesPanel.tsx`) gains a **"Start from"** segmented control at the top of the Design sidebar, above the existing format picker:

```
┌─────────────────────────────────────┐
│  Start from                         │
│  [ Templates ] [ Collage ] [ Blank ]│
├─────────────────────────────────────┤
│  Format   [IG Post ▾]               │
│  … existing template grid …         │
└─────────────────────────────────────┘
```

Choosing **Collage** swaps the panel body for `CollagePanel`. The canvas, header actions, autosave, download and publish buttons are untouched — they keep operating on the same store.

### `CollagePanel` (new, `components/design-editor/collage/`)

Three stacked sections inside `KameSidePanelShell`:

**1. Layout** — a grid of small SVG layout thumbnails rendered directly from `layout.cells` (no images, no raster, no network). Selecting one calls `applyCollageLayout`. Filter chips by cell count (2 / 3 / 4 / 5+).

**2. Photos** — reuses the property-media grid from `PropertyMediaPanels.tsx` plus the upload button. Two interaction paths:

- **Fill all** — one tap fills every empty cell from the property gallery in order.
- **Per cell** — tap a cell on the canvas, tap a photo to place it there.
  Cells support drag-to-reorder (dnd-kit is already a dependency) and drag-photo-onto-cell.

**3. Style** — gap, corner radius, outer padding, border size/colour, background colour. Sliders debounced at 120 ms before hitting `applyCollageStyle`, so dragging a slider does not thrash the store.

### Canvas affordances

- An empty cell renders as a dashed placeholder with a `+` and the cell index. Implemented as a normal image element with a generated 1×1 SVG data-URI `src` and `name: 'Collage cell (empty)'` — no custom Konva renderer needed.
- Selecting a filled cell shows a **"Adjust photo"** button in the collage panel → `enterCellCropMode` → Polotno's native crop handles. **Do not build a custom crop UI.**
- Selecting a cell also shows **Replace** and **Clear**.

### Mobile

`CollagePanel` renders inside the existing `MarketingEditorSidebar` with `mobileVariant="sheet"`, exactly like the Templates panel, so it inherits the bottom-sheet behaviour and the `MarketingEditorMobileToolbar` dock. Verify at 375 / 390 / 768 / 1024 / 1440px per `.cursor/rules/mobile-native-ui.mdc`. Layout thumbnails must be ≥44×44px touch targets; the layout grid goes 4-up on phone, 3-up in the desktop rail.

---

## Part 4 — Upload persistence fix (in scope)

### The bug

`lib/polotno/initPolotno.ts:10-12` and `polotno/usePolotnoSessionMedia.ts:32-34` both do `URL.createObjectURL(file)`. That `blob:` URL is written into `design_json.polotno` by autosave and is dead on the next page load — the saved design silently loses its images, and export/publish of a reloaded design produces blank frames. Collage cannot ship on top of this.

### The fix

**New edge function `supabase/functions/upload-marketing-asset/index.ts`**, modelled on `upload-marketing-generation-reference/`:

- Auth: `requirePropertyPermissionAndFeature(req, propertyId, 'marketing.templates:add', 'marketingStudio')`.
- Writes to `property-media` at a new prefix **`marketing-uploads/{propertyId}/{uuid}{ext}`** using `_shared/marketingGenerationStorage.ts` conventions. No new bucket, no `config.toml` change.
- Returns `{ url, storagePath, width, height }`.

> **Why not reuse `upload-property-media`?** It appends the file to the property's public gallery, so a throwaway collage photo would appear on the public listing page. And **not** `upload-marketing-generation-reference`, whose 90-day prune would silently break saved designs. A dedicated prefix with no auto-prune and no gallery mutation is the correct home.

**Client changes:**

- New `hooks/useUploadMarketingAsset.ts` — mirrors `useUploadPropertyMedia` (`features/dashboard/org/hooks/useUploadPropertyMedia.ts:29-68`): `prepareUpload(file, { imagePreset: 'PHOTO_MASTER', surface: 'property-media' })` → `getSessionJwt()` → `scopedFunctionsUrl('/upload-marketing-asset', propertyId)`.
- `usePolotnoSessionMedia` → `useMarketingUploads`: optimistically show a local object URL while the upload is in flight, then **swap the element `src` to the returned https URL on success** and revoke the blob. Block autosave during the swap via the existing `useMarketingAutoSaveSuspension`.
- `initPolotno.ts`: replace the module-level one-shot `ensurePolotnoConfigured()` with `configurePolotnoUploader(uploadFn)` called on editor mount, so Polotno's own Upload panel routes through the same persistent uploader instead of `createObjectURL`.
- Guard: before download/publish, reject any element whose `src` starts with `blob:` with a clear toast rather than exporting a blank frame.

---

## Part 5 — Performance

The one real risk is memory. Konva retains a decoded bitmap per image; nine 4000×3000 phone photos is roughly 430 MB of RAM and will jank or crash a mid-range phone. Mitigations, in order of importance:

1. **Downscale before the canvas sees it.** Every collage photo — uploaded _and_ gallery-sourced — goes through `prepareUpload` / `prepareImageForUpload` (already lazy-loaded, already uses `browser-image-compression`) capped at **2560px max edge**. Export runs at `pixelRatio: 2` on a 1080px document = 2160px, so anything larger is wasted bytes. This alone takes the 9-cell worst case to roughly 40 MB.
2. **Cap cells at 9** (enforced by the layout registry — there is simply no 10+ layout).
3. **One history transaction per operation** (Part 2) — also the difference between one and nine MST snapshot diffs per layout change.
4. **Debounce style sliders at 120 ms**; relayout is O(cells) pure maths, so this is comfortable.
5. **No new bundle weight.** `CollagePanel` and the collage lib live inside the existing lazily-imported `PolotnoDesignStudio` chunk (`MarketingStudioPage.tsx:26-30`). Layout thumbnails are inline SVG built from the same data — no image requests, no sprite sheet.
6. **Re-run `scripts/pwa/check-precache-budget.mjs`** (runs inside `ui` build; budget 12800 KiB, `PolotnoDesignStudio-*` is already glob-ignored) to confirm no regression.

Expected added gzipped JS: well under 15 KB, essentially all of it pure data and pure functions.

---

## Part 6 — Marketing module restructure

The user asked for this explicitly, and collage forces the issue: `PolotnoDesignStudio.tsx` is already **1018 lines** with three document sources (preset template / saved record / AI-generated). Collage is a fourth. Adding it inline pushes the file past 1200 lines and makes it the module's bottleneck.

**Extract, in this order:**

1. `hooks/useDesignDocumentSource.ts` — owns `selectedId`, `savedTemplateId`, `format`, `category`, `applyTemplate`, `applySavedTemplate`, `appliedDocumentKeyRef`, and the accent/review re-seed effects (currently `PolotnoDesignStudio.tsx:220-300`). Collage becomes a fourth branch here rather than a fourth tangle in the component.
2. `hooks/useDesignExport.ts` — `handleDownload` / `handlePublish` / `exporting` (currently `:638-700`), including the new `blob:` guard.
3. `hooks/useDesignSavePayload.ts` — the `buildSavePayload` closure (`:405-427`), extended to carry the collage block.
4. `components/design-editor/PolotnoDesignStudio.tsx` shrinks to composition + render tree (target ≤450 lines).

**Also fix while here:** the Download button is labelled "Download PNG" (`:729`, `:960`) but `exportPolotnoStoreImage` emits JPEG and the file is saved `.jpg` (`:654`). Relabel to **"Download"** — a one-word fix that removes a real user-facing lie. (Per `.cursor/rules/ui-minimal-copy.mdc`, the format does not belong in the label.)

**Sidebar IA:** `MarketingTemplatesPanel` gets the "Start from" segmented control (Part 3) as the single new top-level concept. Tabs stay at four. No route changes.

---

## Part 7 — Plan gating & permissions

Per the user's decision, **no new plan key**. Collage is part of the Design canvas and inherits:

- Feature gate: existing `useFeatureGate('marketingStudio')` (Pro+) — already wraps download/publish.
- Permission leaves: existing `marketing.templates:add` / `marketing.templates:edit` from `hooks/useMarketingPermissions.ts`.
- New edge function uses `requirePropertyPermissionAndFeature(req, propertyId, 'marketing.templates:add', 'marketingStudio')`.

No migration to `pricing_plans`, no `planFeatures.ts` mirror edits, no compare-matrix row, no drift risk.

**Per `.cursor/rules/plans-and-permissions.mdc`, state this explicitly in the PR:** _plan key: none — inherits `marketingStudio`; permission leaf: none — reuses `marketing.templates:add|edit`._

**Audit logging** (`.cursor/rules` audit-logging skill): the new `upload-marketing-asset` function is a mutating capability → write an `activity_log` entry via `supabase/functions/_shared/activityLog.ts`. Collage edits themselves are N/A (they land in `marketing_templates` via the already-logged template save path).

---

## Part 8 — Persistence

**No migration.** `marketing_templates.content_type` is constrained to `('calendar','design','video')` (`supabase/migrations/20260917120000_marketing_studio.sql:15-17`) and a collage saves as **`content_type: 'design'`** — which is correct, not a workaround: a collage _is_ a design, and this is exactly what keeps autosave, the saved-template gallery, thumbnails, publish and permissions working with zero forked code paths.

The collage block rides inside the existing `design_json`:

```ts
designJson: {
  templateId, sourcePresetId, format, categoryId, category, binding,
  polotno: store.toJSON(),        // <- store.custom.collage lives in here
}
```

The saved-template card shows a "Collage" badge derived from `designJson.polotno.custom?.collage != null`. Filtering is client-side over a per-property list of tens of rows — no index needed.

---

## Execution steps

1. **Types + layouts** — `lib/collage/collageTypes.ts`, `collageLayouts.ts` (~14 layouts), `coverCrop.ts` (`coverCropForFrame`, re-export `squareImageCoverCrop` from `orgLogoCircle.ts`).
2. **Engine** — `lib/collage/collageDocument.ts` (`buildCollageDocument`, `collageFrames`, `planRelayout`, settings read/merge) + `collageStoreOps.ts` (history-transaction-wrapped mutations).
3. **Unit tests** — `lib/collage/collageDocument.test.ts`, `coverCrop.test.ts` (Node-env Vitest, per `ui/vitest.config.ts`). Cover: frame geometry sums to canvas minus gaps/padding; relayout preserves srcs 4→2 and 2→4; cover crop for portrait/landscape/square sources in portrait/landscape/square frames.
4. **Upload persistence** — `supabase/functions/upload-marketing-asset/index.ts` + Deno handler test; `hooks/useUploadMarketingAsset.ts`; rewrite `usePolotnoSessionMedia` → `useMarketingUploads`; `configurePolotnoUploader` in `initPolotno.ts`; `blob:` guard in export.
5. **Restructure** — extract `useDesignDocumentSource`, `useDesignExport`, `useDesignSavePayload`; shrink `PolotnoDesignStudio.tsx`; fix the "Download PNG" label.
6. **UI** — `components/design-editor/collage/CollagePanel.tsx`, `CollageLayoutGrid.tsx`, `CollageCellList.tsx`, `CollageStyleControls.tsx`; "Start from" segmented control in `MarketingTemplatesPanel.tsx`; empty-cell placeholder + Adjust/Replace/Clear.
7. **Mobile pass** — sheet variant, 44px targets, verify 375/390/768/1024/1440.
8. **E2E** — extend `ui/e2e/features/marketing/marketingStudioSmoke.spec.ts` or add `marketingCollage.spec.ts` tagged `@ci`: open Design → Collage → pick quad layout → fill all → change gap → download.
9. **Docs** (mandatory, same change): `docs/guides/routes/org/property/marketing.md` (route-guides skill), `documentation-maintenance` checklist, audit-logging row for the new function, and move this plan `planned/` → `in-progress/`.

## Verification

```bash
cd /Users/michaelmanlulu/Projects/personal-projects/kame-homes
bun run type-check
bun run lint
bun run check:filenames        # new files
bun run test                   # Vitest incl. new collage tests
bun run test:edge:handlers     # upload-marketing-asset
bun run build                  # incl. precache budget + lazy-optimizer assertions
bun run test:e2e:ci
```

Manual, in the Studio:

1. Design tab → **Start from → Collage** → pick `quad-grid` → **Fill all**. Four property photos land centre-cropped, no letterboxing, no stretching.
2. Switch to `trio-left-hero`. Photos are preserved and re-cropped to the new frames; **one** Ctrl+Z restores the quad layout exactly.
3. Select a cell → **Adjust photo** → drag inside the frame. Polotno's native crop handles appear; the photo pans without moving the cell.
4. Add a text layer over the collage, change the gap and corner radius. Text stays put; cells restyle.
5. **Download** → JPEG matches the canvas at 2× with no blank frames.
6. Upload a photo from disk into a cell, **hard-reload the page**, reopen the saved design → _the photo is still there_ (this is the regression the fix targets; it fails on `main` today).
7. Publish → Meta dialog receives the collage blob.
8. Repeat 1–5 at 390px width in a bottom sheet; confirm no horizontal overflow and ≥44px targets.
9. DevTools memory: 9-cell collage from 4000×3000 sources stays under ~120 MB JS heap and the canvas stays interactive.
10. Confirm a Starter-plan org sees the `marketingStudio` TierBadge and the upgrade modal on Download, and that read-only viewing of an existing collage still works (the documented "view-past-output" rule).

## Out of scope

- Freeform draggable cell dividers (user chose preset layouts + per-cell crop).
- Flattening collages to a single image (explicitly rejected — cells stay live).
- Any new plan key, pricing row, or permission leaf.
- The open plans `docs/workflow/planned/marketing-meta-publishing-gaps.md` and `marketing-studio-mobile-and-dashboard-responsive.md` — this plan must not conflict with the latter's sidebar work; sequence after it if it is still in flight.

## Related

- [`../done/marketing-design-templates.md`](../done/marketing-design-templates.md)
- [`../done/marketing-video-templates.md`](../done/marketing-video-templates.md)
- [`./marketing-studio-mobile-and-dashboard-responsive.md`](./marketing-studio-mobile-and-dashboard-responsive.md)
- [`../../architecture/plans-feature-matrix.md`](../../architecture/plans-feature-matrix.md)

---

# Appendix — Marketing module roadmap candidates

Requested alongside the collage plan. Ranked by value-to-effort, with the dependency each one rides on. Nothing here is approved; these are candidates for separate plan docs.

### Tier 1 — high value, low effort, zero or near-zero new dependencies

| #   | Feature                               | Why it wins                                                                                            | Build notes                                                                                                                                                                                                                   |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Magic resize**                      | Hosts make one post and need it in 3 formats. Highest-frequency manual chore in the Studio today.      | The AI path already loops `DESIGN_AI_FORMATS` and saves three records (`PolotnoDesignStudio.tsx:483-549`). Generalize that loop into "resize this design to the other two formats" using proportional re-layout. No new deps. |
| 2   | **Multi-page designs → IG carousels** | Carousels outperform single images on Instagram; hosts want a 5-slide room tour.                       | Polotno supports multiple pages natively and ships `src/pages-timeline/`. Needs a page strip in the UI, per-page export, and a carousel branch in `publish-to-meta`.                                                          |
| 3   | **Photo filters & adjustments**       | "Brighten this dim bedroom photo" is a constant need; sending users to another app defeats the Studio. | Konva has built-in `Brighten`/`Contrast`/`HSL`/`Blur` filters and is already loaded. Presets (Warm / Airy / Contrast / B&W) as a side-panel section. **Zero new bytes.**                                                      |
| 4   | **Brand kit**                         | Palette/fonts/logo are re-picked on every design; also feeds Video and Collage.                        | Extends `useOrgBrandColor` / `resolveCampaignPalette` into a stored org-level kit. Mostly a settings surface plus a "apply brand" action.                                                                                     |
| 5   | **QR code element**                   | Puts the booking link on printed flyers and story posts.                                               | Pure-SVG QR generation is ~3 KB; register as a custom Polotno element via the `customTypeSlots` mechanism in `group-model.ts:25-27`.                                                                                          |
| 6   | **Media pack export (ZIP)**           | Hosts need all formats at once for listing syndication / OTA uploads.                                  | Loop `store.toBlob()` over formats, zip client-side. One small dep (`fflate`, ~8 KB) or a server function.                                                                                                                    |
| 7   | **Collage → video**                   | Directly connects the new collage feature to the Remotion editor — Ken Burns across collage cells.     | Read `custom.collage` cells, emit a `VideoStoryboardRecipe`. Reuses `videoMotionProfiles.ts` wholesale. Natural follow-on to this plan.                                                                                       |

### Tier 2 — high value, moderate effort

| #   | Feature                                           | Notes                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | **Scheduled publishing queue**                    | `marketing_publications.scheduled_at` already exists and the cron infrastructure is in place; needs a queue UI, a dispatcher, and retry/failure handling. Turns the Studio from a composer into a channel.                                                                              |
| 9   | **Post performance analytics**                    | Pull Meta Graph insights (reach/engagement) back onto `marketing_publications` and show "your best-performing post". Closes the loop and justifies the Business tier.                                                                                                                   |
| 10  | **Per-platform caption variants + hashtags**      | `generate-marketing-caption` exists; extend to emit IG/FB/TikTok variants with length limits and a hashtag set from amenities + location.                                                                                                                                               |
| 11  | **Short links + UTM builder with click tracking** | Attribution for every published post. Small table, one redirect edge function; unlocks real ROI reporting.                                                                                                                                                                              |
| 12  | **Before/after slider**                           | Renovation and cleaning-standard posts. A collage layout (`before-after`) plus a divider element — mostly falls out of this plan.                                                                                                                                                       |
| 13  | **Background removal**                            | Genuinely useful for logo/object cutouts. **Flag:** `@imgly/background-removal` is ~5 MB of WASM + model — it would blow the precache budget and contradicts the performance constraint. Prefer routing through the existing server-side Gemini pipeline in `generate-marketing-media`. |

### Tier 3 — strategic, larger bets

| #   | Feature                                                                   | Notes                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | **Multi-channel publishing** (TikTok, Pinterest, Google Business Profile) | GBP in particular drives direct bookings for property businesses. Each channel is its own OAuth + API integration; `social_channel_connections` is already the right table.                         |
| 15  | **Auto property tour video**                                              | Gallery → scored/ordered → Remotion storyboard, one click. Leans on existing video templates and the media-accent helper.                                                                           |
| 16  | **Campaign concept**                                                      | Group calendar + design + video + publications under one campaign (e.g. "Holy Week promo") with a shared brief and a results rollup. The natural home for the Create/Library IA the user hinted at. |
| 17  | **A/B post variants**                                                     | Publish two creatives, compare via #9. Depends on analytics landing first.                                                                                                                          |
| 18  | **Email / Telegram broadcast composer**                                   | Telegram marketing settings + cron already exist; reuse Studio output as the creative.                                                                                                              |
| 19  | **Guest review → asset automation**                                       | Partially built (`marketingReviewDesignSeed.ts`). Finish it: new 5-star review automatically drafts a post for approval.                                                                            |

**Suggested order:** collage (this plan) → #1 magic resize → #3 filters → #7 collage-to-video → #2 carousels → #8 scheduling → #9 analytics.
