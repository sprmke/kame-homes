---
title: 'Marketing themes: theme-first Marketing Studio'
stage: planned
status: not started
tags: [marketing, ux, themes, calendar, polotno, remotion, ai]
updated: 2026-10-18
kind: plan
---

# Marketing themes: theme-first Marketing Studio

Approved 2026-10-18. Not started. Absorbs brand kit items 1.1 and 8.5 from [`marketing-ai-poster-studio.md`](../in-progress/marketing-ai-poster-studio.md).

## Context

Marketing Studio has four tabs: Calendar, Design, Video and Generate. Each one styles its output its own way:

| Surface                    | Colors come from                                                                                             | Fonts come from                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Calendar                   | 14 presets with hard-coded hex values (`lib/calendarPresets.ts`). The brand accent is applied only to Blank. | Per preset; `FONT_PAIRINGS` for AI                                                         |
| Design (Polotno)           | `resolveCampaignPalette(brandColor)`, where only the accent varies (`lib/designBrandColors.ts:57`)           | Constants `FONT_DISPLAY/LABEL/BODY/NUMERAL` (`lib/polotno/polotnoCampaignDocuments.ts:35`) |
| Video (Remotion)           | The same campaign palette, plus an optional `VideoProject.palette`                                           | Per-template `VideoFontPairing` (`lib/video/videoTemplateTypography.ts`)                   |
| AI Post                    | `derivePosterPalette` from brand color (`lib/poster/posterColor.ts`)                                         | 8 poster pairings (`lib/poster/posterFonts.ts`)                                            |
| AI wizard (in each editor) | `lookPalette` / `lookMood` (`lib/marketingAiPhotoPalette.ts`)                                                | 4 enums per surface, each different                                                        |

So a host cannot pick one look and get it everywhere. A calendar made in "Garden Bloom" does not carry over to a promo post or a video. Each editor also has its own template sidebar, category model and format list. The calendar Settings view shows all 12 deep panels at once.

**Goal:** a host picks or creates a **theme** (palette, fonts, background, decoration), and every calendar, post, video and AI result made inside it follows that theme. Hosts can create, edit, switch and return to themes. Defaults stay simple, and deep controls sit behind an **Advanced** toggle. Templates, formats and orientation keep working.

### Decisions (confirmed with the user)

1. **Themes are per property.** Each property also gets a built-in "Property colors" theme derived from its photos and brand color.
2. **Presets split into layout + theme.** Each designer preset becomes a layout that reads colors and fonts from the theme. Its original look ships as a starter theme, so the starter theme plus its matching layout must be pixel-equivalent to today (golden test).
3. **Theme edits auto-update saved items and keep manual tweaks.** Items store overrides against the theme. Re-applying a theme keeps them.
4. **Entry:** the first visit shows the theme picker. After that, Marketing opens in the last-used theme's workspace, and a header switcher leads to All themes.

---

## Target experience

```
/org/:org/property/:prop/marketing                → redirect to last theme (or the picker on first visit)
/org/:org/property/:prop/marketing/themes         → Themes home (folders)
/org/:org/property/:prop/marketing/t/:themeId/:tab → Theme workspace (tab = calendar | posts | videos | ai)
```

**Themes home:** a grid of theme cards. Each card shows a CSS-only swatch strip, a font specimen ("Aa" in display and body fonts), the background style and an item count. Cards render nothing in a canvas. Actions:

- **New theme**, from one of four sources:
  - Property photos (photo palette sampler)
  - Starter themes (the 14 calendar looks plus "Quiet Coast", the current design default)
  - Duplicate an existing theme
  - Describe it with AI (Business+)
- Rename, Duplicate, Delete (blocked while items still use the theme; offers to move them), and Set as default.

**Theme workspace (one shell for every material):**

- **Header:** a theme switcher (name, swatches, chevron opening a list plus "All themes"), an **Edit theme** button, and tabs for **Calendar · Posts · Videos · AI Studio**. Posts replaces "Design"; the user-facing label changes but the code module stays `design-editor`.
- **Left sidebar (all editors):** the same `MarketingTemplatesPanel` structure:
  1. "My items in this theme" (saved items filtered by `theme_id`)
  2. Layouts and templates (themed previews)
  3. Format picker
  4. Generate with AI
- **Edit theme sheet:** a right drawer on desktop, a bottom sheet on phone.
  - Simple mode shows:
    - Palette, from four sources: from photos, brand color, swatch presets, or 3 pickers (primary, secondary, accent)
    - A font pairing picker with live specimens
    - Background style (solid, soft gradient, pattern, photo wash)
    - Corner style (sharp, soft, round)
    - Decoration (none, dots, confetti, botanical, stripes)
  - **Advanced** adds:
    - Surface, ink and muted overrides
    - Per-role font override (display, body, label, numerals)
    - Contrast readout
  - A live mini preview shows calendar, post and video frames side by side, using the cheap previews from Phase 8.
  - Save uses `useGuardedClose`.
- **Editor simple/advanced:** each editor's default sidebar shows only the basics. An **Advanced** toggle, remembered per editor in localStorage, reveals today's deep controls.

---

## Theme model

New file `lib/theme/marketingTheme.ts`. It is pure TypeScript and mirrored in `supabase/functions/_shared/marketingTheme.ts`, with a parity test like `posterEdgeParity.test.ts`.

```ts
type MarketingThemeTokens = {
  version: 1;
  palette: { primary: string; secondary: string; accent: string;
             surface?: string; ink?: string };        // advanced overrides are optional
  fonts: { pairing: MarketingFontPairingId;
           overrides?: Partial<Record<'display'|'body'|'label'|'numeral', string>> };
  background: { mood: 'solid' | 'soft-gradient' | 'pattern' | 'photo-wash';
                pattern?: 'dots' | 'grid' | 'lines' | 'diagonal' };
  shape: { corners: 'sharp' | 'soft' | 'round' };
  decoration: 'none' | 'dots' | 'confetti' | 'botanical' | 'stripes';
  photoLook?: GenerationLookId;                         // default mood for AI Photo/Video
};
type ResolvedMarketingTheme = { /* WCAG-derived roles */ accent, onAccent, secondary, onSecondary,
  surface, ink, muted, accentLight, accentDark, fonts: {display, body, label, numeral, script?},
  radius: {sm, md, lg}, ... };
```

- `resolveMarketingTheme(tokens)` derives roles with WCAG guarantees. It reuses the `posterColor.ts` contrast helpers (move them to `lib/theme/marketingThemeColor.ts`) together with `ui/src/lib/theme/colorConvert.ts`.
- **One font catalog:** `lib/theme/marketingThemeFonts.ts` holds about 10 pairings. Each pairing defines display, body, label, numeral and script families, limited to fonts already preloaded in `index.html` (whitelist in `lib/video/videoLayerTypography.ts:15`). Each pairing also maps to the existing per-surface enums:
  - calendar `FONT_PAIRINGS`
  - design `polotnoAiCampaignDocuments` pairings
  - video `VideoFontPairing`
  - poster `PosterFontPairingId`

  The existing AI enums stay as they are on the server, and the mapping table translates both ways.

- `themeHash(tokens)` is a stable hash used for thumbnail cache keys and for "theme changed" checks.

### Surface adapters (each one is pure and has unit tests)

| Adapter                                          | Built from                                                                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `themeToCalendarStyles(layoutId, theme, format)` | The calendar layouts (below). It reuses `applyFontPairing`, `applyBackgroundMood` and `ensureReadableCalendarContrast`, extracted from `calendarAiTokens.ts` into `lib/theme/calendarThemeAdapter.ts`. |
| `themeToCampaignPalette(theme)`                  | Replaces `resolveCampaignPalette` internals. That function stays as a thin wrapper used when no theme is set.                                                                                          |
| `themeToPolotnoFonts(theme)`                     | Parameterizes the four `FONT_*` constants. Builders receive `fonts` beside `palette`.                                                                                                                  |
| `themeToVideoTypography(templateId, theme)`      | Theme fonts replace the template pairing's families. The template keeps scale, weights and `VideoTemplateLook` craft. Palette goes to `CampaignPalette`.                                               |
| `themeToPosterInputs(theme)`                     | Returns `{accent, secondary, field}` for `derivePosterPalette`, plus the mapped `PosterFontPairingId`.                                                                                                 |
| `themeToAiPreferences(theme, contentType)`       | Returns the locked `lookPalette`, `fontPairing` and `backgroundMood` for the AI wizard, plus `lookMood` for video.                                                                                     |

### Role-tagged layouts (replaces the hex-guessing `recolorStyles`)

- **Calendar:** convert each of the 14 `CALENDAR_PRESET_STYLES` entries into `defineCalendarLayout((t) => Partial<CalendarStyles>)`, where colors and fonts reference theme roles (`t.accent`, `t.surface`, `t.fonts.display`, ...). Structure stays exactly as it is: patterns, radii scaled by `t.radius`, sizes, decorations and toggles.
- **Starter themes:** extract each preset's palette and fonts into `STARTER_THEMES`. A golden test asserts that `themeToCalendarStyles(layoutX, starterX)` deep-equals today's `resolveCalendarPresetStyles(X)` for all 14 presets × 3 formats.
- **Design and video:** builders already use palette roles. Add role tags so that saved documents can be re-themed:
  - Polotno: `custom.themeRole: { fill?: Role; font?: FontRole }` on each element.
  - Video: `textStyle` role, already present.
- Templates that use `preservePresetPalette` (`giveaway-raffle`, `fully-booked`, `sold-out-stamp`, `holiday-glow`) also become theme-driven. Their fixed accents become their starter-theme accents, and a test confirms the visuals are unchanged with that starter.

### Overrides, so theme edits keep manual tweaks

- **Calendar:** on save, store `designJson.styleOverrides = deepDiff(styles, themeToCalendarStyles(layout, themeAtSave, format))`. Re-theming computes `deepMerge(themeToCalendarStyles(layout, newTheme), styleOverrides)`. The full `styles` is still stored as a cache, so old readers keep working.
- **Polotno:** re-theme only those elements whose current fill or font still equals the old theme's value for their `themeRole`. Elements the user changed by hand keep their values. Untagged elements (from uploads or manual adds) are left alone.
- **Video:** re-theme `project.palette` and layers that use only `textStyle`. Layers with an explicit `typography.color` or `fontFamily` keep them.
- Each item stores `designJson.themeHash`. If it differs from the current theme, the item is re-themed when opened, plus a background pass after a theme save (see Phase 2).

---

## Data and backend

Each migration is a new file.

1. **`marketing_themes`**:
   - Columns: `id uuid pk, property_id fk, organization_id fk, name text, tokens jsonb not null, source text check (starter|photos|brand|custom|ai|duplicate), is_default bool, sort_order int, created_by, created_at, updated_at`.
   - Index on `property_id`.
   - Partial unique index on `(property_id) where is_default`.
   - RLS on, same pattern as `marketing_templates`. Access is enforced in the edge function.
2. **`marketing_templates.theme_id uuid null references marketing_themes on delete set null`**, plus `thumbnail_path text null` (see Phase 8).
3. **Backfill:** for each property that has templates, create a "Property colors" theme (`source='photos'`, tokens from the current brand color) and set `theme_id` on its rows. Stored `styles`, `polotno` and `project` stay as they are, so nothing changes visually. Document this in `docs/archive/operations/migration-runbook.md`.

**Edge function `marketing-themes`** (`serveAdmin`, `resolveScopedPropertyAccess`):

- **GET** lists themes with an item count per theme. **POST**, **PATCH** and **DELETE** manage themes.
  - DELETE returns 409 while items still use the theme, unless `?moveTo=<themeId>` is passed.
- **Permissions:** reuse `marketing:view` and `marketing.templates:add|edit|delete`. No new RBAC keys. Record this decision in `plans-and-permissions`.
- **Plan gate:** `marketingStudio`. Creating more than the built-ins requires `customTemplates`, as saved templates do today.
- **Activity log:** `logAssetActivity` events `marketing.theme.created|updated|deleted|set_default`.
- **Validation:** tokens are shape-checked server-side with the shared parser; hex values and enum ids are allow-listed.

**`marketing-templates` changes:**

- Accept and return `theme_id`.
- Add `?themeId=` and `?fields=summary` to GET, so the list skips `design_json` thumbnails and heavy payloads.
- Add `thumbnail_path`.

**AI server (`_shared/marketingTemplateGenerationAi.ts`, `marketingPosterDirector.ts`):** accept an optional `theme` (validated tokens). When present, palette and fonts are locked in the prompt and in post-processing, and the model chooses only layout, copy and photo order. The poster director keeps `brandColor` as a fallback.

---

## Phases and tasks

Each phase ships independently behind the flag `VITE_MARKETING_THEMES`, removed in Phase 10. Until a phase lands, the current UI keeps working.

### Phase 0: Plan housekeeping

- [ ] Copy this plan to `docs/workflow/planned/marketing-themes.md` and add a README row.
- [ ] Cross-link `docs/workflow/in-progress/marketing-ai-poster-studio.md` items 1.1 (brand kit colors and font) and 8.5 ("Save as my style"), which this plan absorbs. Also cross-link the collage plan's "Brand kit" item.

### Phase 1: Theme core (pure libs, no UI change)

- [ ] `lib/theme/marketingTheme.ts`: types, `parseMarketingThemeTokens`, `resolveMarketingTheme`, `themeHash`.
- [ ] `lib/theme/marketingThemeColor.ts`: move contrast helpers out of `posterColor.ts`; the poster code imports them back.
- [ ] `lib/theme/marketingThemeFonts.ts`: unified pairings plus mapping tables to calendar, design, video and poster enums.
- [ ] `lib/theme/starterThemes.ts`: 14 calendar looks, Quiet Coast, and the fixed accents of the four `preservePresetPalette` templates. Plus `buildPropertyColorsTheme(brandHex, photoPalette?)` reusing `resolveMarketingAiLookPresentation`.
- [ ] Adapters: `calendarThemeAdapter.ts`, `designThemeAdapter.ts`, `videoThemeAdapter.ts`, `posterThemeAdapter.ts`, `aiThemeAdapter.ts`.
- [ ] `lib/theme/themeOverrides.ts`: `deepDiff`/`deepMerge` for calendar, plus `rethemePolotnoDocument` and `rethemeVideoProject`.
- [ ] Tests:
  - Golden test: 14 layouts × starter × 3 formats equal the current presets.
  - Contrast guarantees for random palettes.
  - Overrides round-trip.
  - Re-theme keeps manual edits.
  - Edge parity for tokens.

### Phase 2: Backend

- [ ] Migrations (table, `theme_id`, `thumbnail_path`, backfill) and run them locally via `/fix-migration-issues`.
- [ ] `supabase/functions/marketing-themes/index.ts` plus its `config.toml` entry.
- [ ] `marketing-templates`: `theme_id`, `?themeId`, `?fields=summary`, `thumbnail_path`.
- [ ] AI functions accept `theme`.
- [ ] Deno tests: validation, 409 on delete, `moveTo`, permission and plan gates, activity events.
- [ ] Re-theme pass after a theme save: client-side for now. Open items are re-themed on load; others are re-themed lazily when opened, using `themeHash`. Server render is not in scope.

### Phase 3: Workspace shell and theme UI

- [ ] Routes in `routes/index.tsx`:
  - `marketing` redirects to the last theme. The last theme is stored in localStorage key `marketing-last-theme:{propertyId}`, falling back to the default theme, then to the picker.
  - `marketing/themes` is Themes home.
  - `marketing/t/:themeId/:tab` is the workspace.
  - Tab state moves from `useState` to the URL, so back and forward work. Old `?tab=` links keep working.
- [ ] Hooks:
  - `useMarketingThemes`, `useMarketingThemeMutations` (TanStack Query, invalidate on write)
  - `useActiveMarketingTheme()` returning `{tokens, resolved, hash}`, provided by a `MarketingThemeProvider` around the workspace
- [ ] Components (`components/themes/`):
  - `ThemesHomePage`
  - `ThemeCard` (CSS-only preview)
  - `NewThemeDialog` (sources)
  - `ThemeSwitcher`
  - `EditThemeSheet` (simple plus Advanced, `useGuardedClose`)
  - `ThemeFontPairingPicker`
  - `ThemePalettePicker`, reusing calendar `ColorPicker` and the photo sampler
  - `ThemeMiniPreviews`
- [ ] `MarketingStudioPage` becomes `MarketingThemeWorkspacePage`. `MarketingStudioShell` header gets the switcher and the Edit theme button. Tabs are relabeled Calendar · Posts · Videos · AI Studio.
- [ ] Mobile:
  - The switcher is a full-width row under the large title and opens a bottom sheet.
  - Edit theme is a bottom sheet with detents.
  - Themes home is a 2-column grid at 375px.
  - Check at 375, 768 and 1024px.

### Phase 4: Calendar under a theme

- [ ] Rewrite `CALENDAR_PRESET_STYLES` as role-tagged layouts. `CALENDAR_PRESET_CATEGORIES` becomes a layout catalog. Card labels become layout names (keep the current names), and the swatches show the active theme.
- [ ] `calendarBuilderStore`:
  - `applyPreset` becomes `applyLayout(layoutId, theme)`.
  - Drop `applyBrandAccentToCalendarStyles` usage when a theme is set.
  - Scope the persisted `calendar-builder-storage` key by property and theme. This fixes today's unscoped key.
- [ ] Autosave keys become `{themeId}:{layoutId}:{aspectPreset}`, with `styleOverrides` and `themeHash` in `designJson`. Update `calendarAutosave.ts`, `useCalendarTemplates.ts` and `useCalendarTemplateDedupe.ts` (v4 key).
- [ ] **Simple sidebar (default):**
  - Layouts grid
  - Format
  - Month
  - Show/hide elements (wire up the existing unused `CalendarElementToggles.tsx`)
  - Subtitle and watermark text
  - Booked label ("BOOKED")
  - Property photo
  - "Generate with AI"
- [ ] **Advanced toggle:** today's 12 panels unchanged. Edits there become overrides, with a small "Reset to theme" button on each panel.
- [ ] Re-theme on open when `themeHash` differs.

### Phase 5: Posts (design editor) under a theme

- [ ] `buildPolotnoCampaignDocument(templateId, binding, {theme})`: palette and fonts come from adapters, and elements are tagged with `custom.themeRole`. The collage builder and `polotnoAiCampaignDocuments` do the same.
- [ ] `PolotnoDesignStudio`:
  - The theme replaces `brandColor`/`useMarketingMediaAccent` as the style source. Media accent stays only inside the "Property colors" theme.
  - Saved items are filtered by `theme_id`.
  - Re-theme on open.
- [ ] **Simple mode (default):**
  - The Polotno side panel is limited to Templates, Photos, Text and Upload.
  - The toolbar shows text editing and "Theme color" swatches: a fill picker that offers theme roles first, and picking one sets the role tag.
- [ ] **Advanced:** the full Polotno panels (Elements, Background, Layers, Size) and a free color picker. A free color removes the role tag and becomes an override.
- [ ] Keep the categories (promo, slots, giveaway, fully-booked, reviews, custom), collage mode and the 4 formats (4:5 is still listed only for 4:5 docs).

### Phase 6: Videos under a theme

- [ ] `resolveVideoTypographyContext(templateId, theme)`: theme families, template craft, `project.palette` from the theme, and `templateId`/`themeHash` stamped on the project.
- [ ] `VideoEditor`:
  - Saved items are filtered by `theme_id`.
  - Re-theme on open.
  - The music default stays as it is.
- [ ] **Simple mode (default):** template, photos per scene, scene text, music, format.
- [ ] **Advanced:** `VideoSceneElementsPanel`, per-layer `VideoTextStyleControls`, transitions and timing. Per-layer color and font set explicitly become overrides.
- [ ] Keep the 16 recipes and 6 categories, and the formats story, post and landscape.

### Phase 7: AI under a theme

- [ ] **In-editor wizard** (`MarketingAiGeneratePanel`): the Look step defaults to **"Use this theme"**, which locks palette, fonts and background through `themeToAiPreferences`.
  - "Surprise me" lets the AI choose. If the result is liked, offer **"Save as new theme"** (creates a theme from the result's tokens).
  - Results are saved into the active theme.
- [ ] **AI Post:**
  - Palette comes from `themeToPosterInputs`, and the font pairing is the mapped id. Shuffle cycles archetypes only.
  - "Edit" saves with `theme_id` and opens Posts in the same theme.
  - Send `theme` to the director.
- [ ] **AI Photo/Video:** the Look picker preselects the theme's `photoLook` when set. Results are tagged with the active theme in `generation_options`, so the gallery can filter "This theme" or "All".
- [ ] **New theme → Describe it with AI:** a new `contentType: 'theme'` on `generate-marketing-template` returns `MarketingThemeTokens` (same quota and gate as `aiMarketingGeneration`).
- [ ] Update `posterEdgeParity`-style parity tests for the new theme input.

### Phase 8: Thumbnail performance

**Analysis:**

- Today every preset thumbnail is rendered live, one at a time behind a global lock: html-to-image for calendar, headless Konva for design, Remotion stills for video.
- Cache keys include brand and photo, so any accent change invalidates everything.
- Saved thumbnails are base64 inside `design_json`, and the list endpoint returns them all.

Themes make this worse unless it changes, because the number of previews multiplies by the number of themes.

- [ ] **Theme cards and theme pickers: zero render.** Pure CSS swatches plus a font specimen.
- [ ] **Calendar layout cards: drop capture.** Render the real `CalendarPreview` scaled with CSS `transform` inside a lazily mounted card (IntersectionObserver via `useVisibleThumbnailRequest`), with a static month and a mini property photo.
  - DOM is cheaper than html-to-image and is always in sync with the theme.
  - Remove `MarketingCalendarThumbnailHost` from the layout grid. Keep it only for export and saved items without a stored thumbnail.
  - Measure first: if more than 8 cards drop frames, fall back to a capture cache keyed by `themeHash`.
- [ ] **Design and video template cards:** keep capture, but key by `{templateId}:{format}:{themeHash}:{photoKey}` and persist to IndexedDB.
  - Precompute only the visible category.
  - Show the CSS theme-tinted skeleton (layout silhouette plus swatches) until the capture lands, so the grid never looks broken.
- [ ] **Saved items:**
  - On save, upload the JPEG thumbnail to Storage at `property-media/marketing-thumbs/{propertyId}/{templateId}-{updatedAt}.jpg` and set `thumbnail_path`.
  - Stop embedding `thumbnailDataUrl`, but keep reading it for old rows.
  - The list uses `?fields=summary`.
  - Re-theming an item regenerates its thumbnail lazily when it is next opened.
- [ ] **Measure:** time to first meaningful sidebar, number of captures per tab open, and list payload size, before and after. Record the numbers in the plan.

### Phase 9: Shared sidebar and consistency cleanup

- [ ] One `MarketingTemplatesPanel` for all three editors. The calendar sidebar is folded into it, keeping `CalendarTemplateSidebar` as a thin renderer, so "My items in this theme", categories, format and AI share one structure and the same copy.
- [ ] Catalog prefs (`useMarketingCatalog`): keep them in localStorage, keyed by property, theme and tab. Give the calendar its real categories instead of the Design fallback (`useMarketingCatalog.ts:49`).
- [ ] Copy pass with `human-copy`: short labels, no em dashes. Run `minimal-ui-copy`.

### Phase 10: Docs, tests, flag removal

- [ ] Docs:
  - `docs/guides/routes/org/property/marketing.md`: rewrite the sections for Themes home, workspace, Edit theme, simple vs advanced, and themes in AI (`route-guides` skill).
  - New `docs/architecture/marketing-themes.md`: model, adapters, overrides, thumbnails.
  - `docs/architecture/overview.md` and `docs/PROJECT.md`: routes, table, function.
  - `marketing-poster-studio.md`: theme input.
  - `plans-feature-matrix.md`: themes under `marketingStudio`/`customTemplates`.
  - Migration runbook.
- [ ] E2E (`ui/e2e/features/marketing/`):
  - New `marketingThemes.spec.ts`: first visit shows the picker; create from starter; workspace redirect to the last theme; switch theme and confirm the calendar, post and video previews change accent; edit theme, then confirm a saved calendar keeps its manual override; delete returns 409 and moves items; mobile 375px has no horizontal overflow.
  - Update the smoke, AI Post (Edit opens Posts in the same theme), collage and featureGates specs, plus `mockFixtures` for `marketing-themes`.
- [ ] Remove `VITE_MARKETING_THEMES`, and delete the dead `applyBrandAccentToCalendarStyles` path and the hex-heuristic `recolorStyles`.

---

## Checklists (CLAUDE.md gates)

- **plans-and-permissions:** themes are covered by `marketingStudio` (view/use) and `customTemplates` (create or edit beyond the built-ins). There are no new permission keys; reuse `marketing.templates:*`.
- **audit-logging:** `marketing.theme.*` events go through `logAssetActivity`. Re-theme writes to templates reuse the existing template update event.
- **unsaved-changes-guard:** `EditThemeSheet` uses `useGuardedClose`. Editors keep their current guards.
- **mobile-responsive:** every new surface is checked at 375, 768 and 1024px, using bottom sheets for the switcher and Edit theme.
- **booking-workflow:** not touched.

## Risks

- **Golden equality for 14 presets** is the riskiest step. Convert one preset end to end first, then batch the rest. If one cannot be expressed in roles, add an extra role such as `t.decor1` rather than hard-coding a hex.
- **Polotno re-theme** depends on role tags. Old saved designs have no tags, so they are only re-themed for elements whose values match the old campaign palette. Otherwise they stay as they are, and the editor shows an "Older design: theme colors apply to new elements" note.
- **Font loading:** pairings must use preloaded fonts only, or video and thumbnail renders flash fallback fonts.
- **Scope:** Phases 4 to 6 are each large. Ship and verify them one at a time.

## Verification

- Unit: `bun run test` (golden, adapters, overrides, parity). Edge: `bun run test:edge`.
- Then `bun run type-check && bun run lint && bun run check:filenames && bun run build`, or run everything with `bun run ci:quality`.
- E2E: `bun run test:e2e:ci`, which includes the marketing specs.
- Manual (local stack via `./dev.sh`, Playwright CLI):
  1. Open Marketing. The picker appears; pick "Bubble Pop". The calendar matches the old Bubble Pop preset.
  2. Switch to Posts and Videos. The promo, fully-booked and giveaway templates use the Bubble Pop palette and fonts, in all formats and orientations.
  3. Generate an AI Post and a calendar with AI. Both follow the theme. Edit opens Posts in the same theme.
  4. Edit the theme accent. The saved calendar, post and video update, while a manually changed calendar cell color stays.
  5. Create a second theme, switch back and forth, reload, and confirm Marketing opens in the last theme.
  6. Check the 375px phone layout.
  7. DevTools Performance: the theme cards and calendar layout grid trigger no html-to-image captures.
