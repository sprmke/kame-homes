---
title: 'Marketing themes'
status: active
tags: [architecture, marketing, themes]
updated: 2026-10-19
---

# Marketing themes

Marketing Studio is theme-first: a host picks a theme, and every calendar, post, video and AI result made in it uses the theme's colors and fonts. Plan: [`docs/workflow/in-progress/marketing-themes.md`](../workflow/in-progress/marketing-themes.md). Host behavior and save paths: [Marketing route guide → Themes](../guides/routes/org/property/marketing.md#themes).

## Model

`MarketingThemeTokens` (`ui/src/features/dashboard/marketing/lib/theme/marketingTheme.ts`, mirrored for validation in `supabase/functions/_shared/marketingTheme.ts`, kept in sync by `marketingThemeEdgeParity.test.ts`):

| Field                  | Values                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `palette`              | `primary` (main brand color) · `secondary` (soft tone) · `accent` (highlight) · `surface` (paper) · `ink` (text). `#rrggbb`.                                                                      |
| `fonts`                | `display` · `body` · `label`, from one allow-list usable by DOM, Konva and Remotion (`marketingThemeFonts.ts`). Families not preloaded in `index.html` load on demand (`marketingFontLoader.ts`). |
| `photoLook` (optional) | One of the AI Photo / Video looks (`GENERATION_LOOKS` ids, parity-tested). Present only when set; an unknown value is dropped, not fatal.                                                         |
| `background`           | `solid` · `soft-gradient` · `pattern` · `photo-wash`                                                                                                                                              |
| `corners`              | `sharp` · `soft` · `round`                                                                                                                                                                        |

`resolveMarketingTheme` derives roles with contrast guarantees (`readableInk` ≥ 7:1 on surface, `muted` ≥ 4.5:1, readable text on each fill). `marketingThemeHash` is a canonical FNV-1a hash used for "theme changed" checks and thumbnail cache keys.

**Keys** (`marketingThemeKeys.ts`): `property-colors` (derived per property from photos, else brand color), `starter:<id>` (code-defined looks), or a `marketing_themes.id`. Built-ins need no row, so every tier can use them; saving a built-in creates a copy.

## The re-theming engine (`themeRemap.ts`)

Designer presets are hand-tuned with many shades per look, so a theme is applied **relative to the theme the design was made in**, not by hand-written role maps:

1. Each color is matched to an anchor of the source theme. Saturated colors match within their hue family first (a pale pink "today" fill is a tint of the pink accent); others use OKLab distance.
2. The color moves the way its anchor moved, in OKLCh. Hue keeps its offset (large offsets are damped). Chroma scales around saturated anchors and shifts around near-neutral ones. Lightness is remapped piecewise, so white stays white and black stays black. An exact anchor maps exactly onto the new anchor. Alpha and notation (`#rgb`, `#rrggbbaa`, `rgba()`) are preserved.
3. Fonts map by role. A family filling two roles is disambiguated by the field path (`dayNames` → label, `monthYear` → display).
4. Radii scale by corner style; pills stay pills unless the target is `sharp`.
5. Text keys, ids, URLs and types are never touched. Locked paths (calendar) or locked element ids (posts) are skipped.

Same source and target theme returns the same object, which is what makes **starter theme + its layout = the original preset** exact (golden test over 14 layouts × 3 formats).

## Surface adapters

| Surface           | Adapter                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Calendar          | `calendarThemeAdapter.ts`                                            | `resolveThemedCalendarLayout(layoutId, theme, format)`: preset styles → remap from the layout's source theme (`calendarLayoutSourceTokens`, derived from the preset itself) → background style when it changes → `preserveCalendarReadability` (no text pair drops below the original contrast, capped at WCAG targets) → frame color = theme main color. `themedSavedCalendarStyles` re-themes a saved row from its snapshot. |
| Posts (Polotno)   | `designThemeAdapter.ts`                                              | `themeToCampaignPalette` feeds the campaign builders; `themeCampaignFontMap` swaps the four Quiet Coast faces for the theme roles. `rethemePolotnoDocument` re-themes saved documents, skipping hand-edited elements found by `polotnoHandEditedIds` (signature diff against the baseline taken right after a themed load; user-added elements count as edited).                                                               |
| Videos (Remotion) | `videoTemplateTypography.ts#resolveVideoTypographyContext(…, theme)` | Palette and fonts come from the theme at render time; each template keeps its look (scrims, scale, pill and CTA chrome). Saved videos therefore always render in the current theme; per-layer overrides stay.                                                                                                                                                                                                                  |
| AI wizard         | `aiThemeAdapter.ts`                                                  | Calendar: the AI archetype's seed layout in the theme + AI subtitle. Design: theme palette, editorial pairing then the font map, background from the theme. Video: no AI palette. The wizard hides look templates and type/background pickers when a theme is passed.                                                                                                                                                          |
| AI Post           | `posterThemeAdapter.ts`                                              | Theme palette into `derivePosterPalette`; the archetype's pairing keeps its script accent and effects while display/body/label use the theme.                                                                                                                                                                                                                                                                                  |

## Items and themes

- `marketing_templates.theme_key` + `designJson.themeTokens` / `themeHash` (+ `lockedPaths` for calendars, `lockedElementIds` for posts), stamped by `themeStampForSave` on every save path (autosave, Save template, AI saves, AI Post Edit).
- Each editor scopes its list, autosave lookups and format siblings to `templatesInTheme(rows, key)` and is remounted per theme (`key={theme.key}`).
- **Legacy rule** (`effectiveTemplateThemeKey`, mirrored in `marketing-themes` GET counts): no key + calendar with a designer `sourcePresetId` → `starter:<presetId>`; anything else → `property-colors`. Legacy rows with no snapshot are not re-themed (calendars from a designer look use that look's palette as the source).
- Cleanup planners (calendar dedupe, design purge, related format ids) group by theme, so the same layout in two themes is never treated as a duplicate. The design purge now keeps the newest row per theme + preset + format instead of deleting every preset autosave.

## Thumbnails

| Card                                                 | How                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Theme library cards, editor preview, New theme looks | `ThemeShowcase.tsx`: always the sample post, the theme's calendar layout, and a sample clip (`ThemePreview.tsx` + `CalendarMiniPreview`). Saved thumbnails stay on library cards. Nothing is captured. |
| Theme bar and switcher                               | CSS swatch dots                                                                                                                                                                                        |
| Calendar layouts and saved calendars                 | Live calendar DOM scaled with CSS (`CalendarLayoutLivePreview`), mounted when near the viewport. The html-to-image capture host was removed.                                                           |
| Post / video presets                                 | Captured once per theme: `themeHash` in the cache key, IndexedDB persisted; video pre-warm only for the open category.                                                                                 |
| Saved posts / videos                                 | Embedded thumbnail unless its `themeHash` is stale; then re-rendered (posts headlessly with unique page ids so the capture never picks the live editor's page).                                        |

## Navigation and theme UI

- **Library** (`ThemesHome`): the themes root. The **New theme** tile is always the first card, then the host's themes. No back control to the open theme. Starter looks live in `NewThemeDialog` (one per group via `MarketingThemeEntry.featured`, the rest behind **More looks**), next to Describe a look.
- **Theme bar** (`ThemeContextBar`): Themes › name ▾ · Edit / Customize. Rendered in the page header on `lg+` (`AdminMobilePage desktopActions`) and as the first row of the studio card below `lg`.
- **Editor**: palette grid and per-role colors from `themePaletteSuggestions.ts` (OKLab de-duplication, shades, per-role suggestions). No color codes in the UI; **Any color** is the native color input.
- Themes created from a starter (or a copy of one) inherit its `calendarLayoutId` through `sourceRef`, so the calendar tab opens on that layout.

## Page state

`MarketingThemeProvider` owns the library (built-ins + `marketing-themes` rows), the active theme, fallback to Property colors when a saved theme disappears (only after the list is fresh), last theme per property in `localStorage`, and URL state (`?theme`, `?tab`, `?view=themes`). Theme writes upsert into the TanStack cache before invalidating, so opening a just-created theme never races the refetch.

## Access, plans, audit

- Permissions reuse `marketing:view` / `marketing.templates:add|edit|delete`; no new leaves.
- Plans: GET `marketingStudio`; POST/PATCH `customTemplates`; built-ins on every tier.
- Activity: `marketing.theme_saved` (create/edit), `marketing.theme_deleted` (with moved item count). Re-theming an item is a normal template save (`marketing.template_saved`).

## AI theme creation

`generate-marketing-template` with `contentType: 'theme'` (`_shared/marketingThemeDirector.ts`, prompt `marketing_template_theme`) turns a description (up to 300 characters) into tokens. The JSON schema enumerates fonts, backgrounds, corners and photo looks; `parseGeneratedTheme` → `coerceMarketingThemeTokens` repairs any off-list field, so the response is always a valid theme. Same gate, quota and rate limit as the other template generations. The client runs it from the New theme dialog (`ThemeAiDescribe`) and opens the result as an unsaved draft in the editor; saving records `source: 'ai'`. "Save an AI result as a theme" is not needed: inside a theme, AI results already use the theme.

## Saved thumbnails in Storage

`marketing_templates.thumbnail_path` (migration `20261316127200`). `_shared/marketingTemplateThumbnails.ts` strips `designJson.thumbnailDataUrl` on POST/PATCH, validates real image bytes (JPEG/PNG/WebP, 600 KB max), uploads to `property-media/{propertyId}/marketing-thumbs/{templateId}-{ts}.ext` (immutable, cached for a year), links it, then deletes the previous object. Thumbnail failures never fail a save. PATCH also accepts a top-level `thumbnailDataUrl` alone. GET migrates up to 6 legacy embedded thumbnails per call. A table-specific trigger (`marketing_templates_touch_updated_at`) keeps `updated_at` for thumbnail-only writes so lists do not reorder. DELETE removes the object. Clients read `thumbnailUrl` first (`savedRecordThumbnail`). With images out of `design_json`, a separate summary GET was not needed.

Library cards (Marketing Studio Library) read `thumbnailUrl` from `view=library`; calendars without one get `previewStyles` and draw an SVG (`CalendarMiniPreview`). The editor session (`useMarketingDesignSession`) stores a fresh thumbnail after the first save, at most every 30 seconds while editing, on leave, and when a saved item opens with a missing or other-theme (`themeHash`) thumbnail. Built-in template art renders headlessly (posts in a hidden offscreen OpenPolotno workspace, videos as a Remotion still) through one global slot gated by `marketingRenderGate` (paused during canvas drags and video playback) and is cached per theme in IndexedDB; low-spec devices render only on hover / focus. Theme cards draw sample art and do not read `view=showcase`.

## Not in this slice

- Theme colors in OpenPolotno's color picker (the toolbar bundle keeps its preset list private).
