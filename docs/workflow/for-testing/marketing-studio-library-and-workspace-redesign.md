---
stage: for-testing
title: 'Marketing Studio — library-first workspace, save model and AI Studio redesign'
status: for testing
tags: [workflow, planned, marketing, ux, performance, mobile-responsive]
updated: 2026-10-20
kind: plan
---

# Marketing Studio — library-first workspace, save model and AI Studio redesign

**Route:** `/org/:orgSlug/property/:propertySlug/marketing` · **Module:** `ui/src/features/dashboard/marketing/` · **Guide:** [`docs/guides/routes/org/property/marketing.md`](../../guides/routes/org/property/marketing.md) · **Related:** [`marketing-studio-mobile-and-dashboard-responsive.md`](../in-progress/marketing-studio-mobile-and-dashboard-responsive.md), [`marketing-meta-publishing-gaps.md`](../planned/marketing-meta-publishing-gaps.md), [`docs/architecture/marketing-themes.md`](../../architecture/marketing-themes.md)

## 1. Why

The theme layer (pick / switch / customize a theme) is in good shape and stays as is. Everything _inside_ a theme is where hosts get lost:

1. **AI Studio is last.** It is the fastest way for a non-technical host to get something postable, but it sits behind Calendar / Posts / Videos.
2. **Hosts cannot find their own work.** Every editor opens straight into a canvas with a long template sidebar. "What I made last week" is either hidden behind a preset card, mixed into the template grid, or (for video) duplicated many times.
3. **The app silently creates rows.** Editing a preset autosaves a hidden row; re-picking a video preset creates a brand-new row on the next edit; AI generate writes three rows per run. The result is bloat the host never asked for and cannot see clearly.
4. **The sidebar does too much.** Start-from, AI button, format, category chips (with rename / add / move), template grid, saved items, reviews, collage, blank: all stacked in one 300px column, on every visit, even the 50th.
5. **AI Studio has tabs inside tabs.** Outer: Calendar / Posts / Videos / AI Studio. Inner: AI Post / Photo / Video. "Video" vs "Videos" and "AI Post" vs "Posts" read as duplicates.
6. **Thumbnails are expensive.** Live calendar DOM per card, headless Polotno / Remotion renders per preset per theme per format, all while the real editor canvas is also running. Low-spec laptops and phones stall.

**Goal:** a host who has never used a design tool can (a) land, (b) get a finished post from AI or a template in under a minute, and (c) come back later and find, continue, copy or delete what they made, without ever wondering "did that just make another copy?".

## 2. Audit — what is actually happening today

### 2.1 Information architecture

| Area                   | Today                                                                                                                                                        | Problem                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Tab order              | `calendar · design · video · generate` (`lib/theme/marketingStudioNav.ts`), fallback tab `calendar`                                                          | AI Studio is last and never the landing tab                                                                                |
| Entry into a tab       | Editor mounts immediately with a preset loaded (Posts loads Polotno + first preset, Videos loads Remotion)                                                   | No "home" state. Fresh and returning hosts see the same thing. Heavy chunks load just to look around                       |
| Your work vs templates | Saved items and presets are in the **same grid**, filtered by the currently selected format + category (`MarketingTemplatesPanel.tsx` `visibleSavedRecords`) | A saved Story post is invisible while the Square format is selected; a saved item in "Promos" is invisible under "Reviews" |
| Calendar               | "Your calendars" (Blank + custom saves) then 7 category sections × 2 presets (`CalendarTemplateSidebar.tsx`)                                                 | Edited presets are not shown as "yours" at all: they are hidden autosave rows replayed when you click the preset card      |
| Category management    | Add / rename / remove categories, rename / move built-in presets, persisted in **localStorage** per browser (`useMarketingCatalog.ts`)                       | Power-user feature most hosts never need; silently differs per device; adds a ⋮ menu to every chip and card                |
| Publish history        | `PublishHistory` under the whole studio card                                                                                                                 | Unrelated to the open editor; pushes the page taller on every tab                                                          |

### 2.2 Save model (root cause of the bloat)

| Editor                          | What creates rows today                                                                                                                                                                                                                                                                                                                                                                               | Where                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Posts (Polotno)                 | Any edit to a preset autosaves a **hidden** row keyed by theme + preset + format (`sourcePresetId = presetId`). Next time the preset card is clicked, that row is replayed, so the "template" is now secretly the host's edit. `+ Save template` creates a separate visible custom row. Client-side `useDesignTemplateCleanup` deletes "duplicate" autosave rows once per browser (localStorage flag) | `PolotnoDesignStudio.tsx` ~L586–628, `lib/designAutosave.ts`, `hooks/useDesignTemplateCleanup.ts` |
| Videos (Remotion)               | `useMarketingAutoSave` has **no `resolveTemplateId`**, and picking a preset sets `savedTemplateId = null` (`VideoEditor.tsx` L305, L1033). Every "pick preset → edit" creates a **new row**. This is the "auto-creates new files" bug                                                                                                                                                                 | `VideoEditor.tsx` ~L523                                                                           |
| Calendar                        | Designer presets autosave per theme + preset + format (hidden, replayed like Posts). Blank calendar needs a manual "Save Template" that creates a custom row. Client-side `useCalendarTemplateDedupe` deletes rows (orphans, duplicates, blank autosaves) once per browser                                                                                                                            | `CalendarBuilder.tsx` ~L329–400, `lib/calendarAutosave.ts`, `hooks/useCalendarTemplateDedupe.ts`  |
| AI generate (all three editors) | One run writes **3 rows** (one per format) immediately, before the host chooses anything                                                                                                                                                                                                                                                                                                              | `PolotnoDesignStudio.tsx` ~L712, `VideoEditor.tsx` ~L890, `CalendarBuilder.tsx` ~L906             |
| AI Post (AI Studio)             | Nothing until **Edit**, which saves one row in an auto-created "AI posts" category                                                                                                                                                                                                                                                                                                                    | `AiPostPanel.tsx` ~L194                                                                           |

Consequences: presets are mutable in practice, "my work" is not a first-class concept, the same edit can live in two places, video duplicates pile up, and two client hooks run destructive deletes based on browser-local flags (a real data-loss risk on a new device).

### 2.3 Sidebar and chrome overload

- The Posts tab has **two** left panels: our `MarketingEditorSidebar` (templates) **and** Polotno's own icon rail (Text / Elements / Uploads / Background / Layers). On a 1280px laptop the canvas gets roughly half the width.
- Calendar puts both "pick a layout" and "style it" (Show on calendar, Advanced panels) in the same left column, toggled between views.
- Video puts templates on the left, scene settings elsewhere, timeline at the bottom.
- "Generate with AI" is a full-width button at the top of every sidebar, and also in the mobile ⋯ sheet, and also the AI Studio tab: three entry points with different engines.
- Header: theme bar, tabs, autosave status, Download, Publish share one row. There is no design name, no rename, no "back to my designs".

### 2.4 AI Studio

- Inner `SegmentedControl` (AI Post / Photo / Video) duplicates the outer tab vocabulary (`AiStudioSection.tsx` `MODE_OPTIONS`).
- AI Post and Photo / Video use completely different layouts (AI Post: its own panel; Photo / Video: composer rail + gallery).
- The gallery is split by mode, so a host who made a photo and a post can never see "everything AI made for me".
- Posts editor "Generate with AI" (wizard, 3 formats, `MarketingAiGeneratePanel.tsx`, 1,313 lines) and AI Studio "AI Post" (poster compiler, 4 variants) are two different engines for the same job.

### 2.5 Thumbnail performance

| Source                | Cost                                                                                                                                                                                      | Where                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Calendar layout cards | Full `CalendarFrame` + `CalendarPreview` DOM (42 day cells, legend, fonts, photo backgrounds) per card, ~16+ cards, never unmounted once visible, re-rendered when styles / theme change  | `CalendarLayoutLivePreview.tsx`, `CalendarTemplateSidebar.tsx`           |
| Post presets          | Headless Polotno store + Konva render per preset, per theme hash (pixelRatio 0.2), cached in memory (LRU 80) + IndexedDB                                                                  | `renderMarketingDesignThumbnail.ts`, `useMarketingTemplateThumbnails.ts` |
| Video presets         | Remotion still of first clip, per preset × format × theme × property-media key                                                                                                            | `renderMarketingVideoThumbnail.ts`                                       |
| Saved posts / videos  | Stored thumbnail when theme hash matches; otherwise **re-rendered headlessly**                                                                                                            | `useMarketingTemplateThumbnails.ts` `loadSaved`                          |
| Eager requests        | `MarketingTemplatesPanel` calls `requestThumbnails(visiblePresetIds)` for the whole category on mount, which bypasses the per-card `IntersectionObserver` in `useVisibleThumbnailRequest` | `MarketingTemplatesPanel.tsx` ~L226–236                                  |
| List payload          | `GET marketing-templates` returns `select('*')`, i.e. **every row's full `design_json`** (Polotno JSON, video projects), on every editor mount                                            | `supabase/functions/marketing-templates/index.ts` L153                   |

The renders are serialized (`withGlobalRenderSlot`, concurrency 1, idle-gated), which avoids contention but means the main thread is busy for a long stretch on a cold cache, exactly while the host is trying to use the canvas. Data URLs (not blob URLs) are kept in React state.

### 2.6 What already works and must be kept

Theme model and theme bar; autosave status UI; unsaved-changes guard on the editors; plan watermarks and `TierBadge` placement; collage composer; reviews seeding; mobile bottom dock + sheets; container-query layout of AI Studio; upload persistence (no `blob:` in saved JSON); stored thumbnails in Storage (`thumbnail_path`).

## 3. How popular tools handle this

| Tool              | Home / fresh state                                                      | Returning state                                                    | Templates                                                                                                                  | Saving                                                                                                                            | Copies                                                                  |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Canva**         | Home: "What will you design?" search + format shortcuts + template rows | "Recent designs" grid first, with thumbnails, name, edited time    | Separate browse (Home and the editor's **Design** rail tab). Applying a template to a design asks to replace or add a page | Every design autosaves. Opening a template creates a **new design** only once you are in the editor; a template is never modified | Explicit **Make a copy**. **Resize** offers "Copy & resize" or "Resize" |
| **Adobe Express** | Quick actions + "Start from" format tiles                               | "Your stuff → Recent"                                              | Template gallery with category chips and format filter                                                                     | Autosave per project                                                                                                              | Explicit Duplicate                                                      |
| **CapCut**        | Big "New project" + templates                                           | Project list ("Drafts") with first-frame thumbnail, duration, size | Separate Templates tab                                                                                                     | Autosave per draft                                                                                                                | Duplicate in ⋯                                                          |
| **Figma**         | Recents                                                                 | Recents / Drafts                                                   | Community templates are duplicated into your drafts explicitly                                                             | Autosave, version history                                                                                                         | Duplicate                                                               |

**Takeaways we adopt:**

1. **Library first, editor second.** The first thing on a tab is _your designs_ (or a friendly start screen if you have none), not a canvas.
2. **Templates are read-only starting points.** Opening one starts a new design; editing never changes the template.
3. **One design = one item that autosaves.** No hidden rows, no per-preset replay. A row is created only when the host actually changes something.
4. **Copies are explicit**: Duplicate, Copy to another size, Save as template. Never implicit.
5. **Templates live in a browser** (full gallery sheet, and a compact rail tab inside the editor), not in a permanent wall of cards next to the canvas.
6. **Thumbnails of your work are static images** captured when you save; the library never runs the editor engine.

## 4. Target experience

### 4.1 Tab order, names and landing

| Order | Id (unchanged) | Label     |
| ----- | -------------- | --------- |
| 1     | `generate`     | AI Studio |
| 2     | `design`       | Posts     |
| 3     | `video`        | Videos    |
| 4     | `calendar`     | Calendar  |

- **Landing tab** when `?tab` is absent: the last tab used on this property (`localStorage` `marketing-last-tab:{propertyId}`, same try/catch pattern as `writeLastMarketingTheme`); first visit → `generate` if the host can use any AI mode (`aiMarketingGeneration` or `aiMarketingImageGeneration`) and has `canGenerate`, else `design`. `normalizeMarketingStudioTab` fallback changes from `calendar` to this resolver.
- Calendar moves last because it is a "set up once a month" tool; Posts and Videos are daily. (Decision D1 below if the team prefers Calendar second.)
- Tab ids stay stable for links, tests and the AI assistant `open_page` targets.

### 4.2 Two states per editor tab: Library → Editor

Each of Posts, Videos and Calendar has two states, driven by the URL:

```
?theme=<key>&tab=design                 → Library (home of the tab)
?theme=<key>&tab=design&item=<uuid>     → Editor on a saved design
?theme=<key>&tab=design&item=new&from=<presetId>&format=<fmt>
                                        → Editor on an unsaved draft from a template
```

- Browser back / the in-app back link returns from Editor to Library. Refresh keeps you in the same design. Links into a design can be shared with teammates.
- Heavy editor chunks (Polotno, Remotion) load **only** in the Editor state. The Library is plain cards with `<img>` tags. Prefetch the editor chunk on card hover / focus and on idle after the Library renders.
- `item=new` drafts are not persisted until the first real edit (see 4.5).

### 4.3 Library — fresh state (no designs in this theme yet)

Desktop (inside the existing studio card; theme bar and tabs unchanged):

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [AI Studio] [Posts] [Videos] [Calendar]                       (no actions) │
├───────────────────────────────────────────────────────────────────────────┤
│  Make your first post                                                     │
│                                                                           │
│  ┌ Start with AI ─────────────┐  ┌ Pick a size ──────────────────────────┐│
│  │ ✨ Describe it, we design it│  │ [▢ Square] [▯ Portrait] [▯ Story]     ││
│  │ [ Open AI Studio ]          │  │ [▭ Facebook]                          ││
│  └─────────────────────────────┘  └───────────────────────────────────────┘│
│                                                                           │
│  Templates          [All] [Promos] [Last slots] [Giveaway] [Reviews] …    │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                       [ See all templates ]│
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                                            │
│  ┌ Blank ┐ ┌ Collage ┐                                                    │
└───────────────────────────────────────────────────────────────────────────┘
```

- One short heading, no paragraphs (`minimal-ui-copy`).
- Templates row shows ~12 cards for the selected size; "See all templates" opens the **Template gallery** (4.6).
- Blank and Collage are peers of templates (they replace the current "Start from" segmented control).
- Videos: same layout, sizes Story / Post / Landscape, categories from `videoCategories.ts`. Calendar: sizes Square / Portrait / Landscape, "layouts" grouped by style, plus Blank.

### 4.4 Library — returning state (has designs)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [AI Studio] [Posts] [Videos] [Calendar]                        [ + New ▾ ] │
├───────────────────────────────────────────────────────────────────────────┤
│  Start new   [▢ Square] [▯ Portrait] [▯ Story] [▭ Facebook] [✨ AI] [All templates]
│                                                                           │
│  Your posts            [All sizes ▾] [Sort: Last edited ▾] [🔍]  [Select] │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                             │
│  │ thumb│ │ thumb│ │ thumb│ │ thumb│ │ thumb│   uniform tiles, image is    │
│  │      │ │      │ │      │ │      │ │      │   object-contain on a soft   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   backdrop, size badge       │
│  Summer promo  Weekday deal  Guest love …                                 │
│  Story · 2h    Square · Mon  Square · Oct 2                               │
│                                                                           │
│  Your templates (only when the host saved some)                           │
│  Recent publishes (collapsed, moved here from under the card)             │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Card:** thumbnail (stored image), name, size badge (`Story`, `Square` …), relative edited time, "AI" badge for AI-made items, "Collage" badge kept, "3 sizes" chip when the item belongs to a size group (4.5.6). Hover / long-press reveals ⋯: **Open**, **Rename**, **Duplicate**, **Copy to another size**, **Save as template**, **Delete**.
- Click opens the editor. Keyboard: Enter opens, Delete key on a focused card opens the delete confirm.
- **Select** mode enables multi-select + bulk Delete (the cleanup tool hosts need for existing bloat).
- Filters: size, sort (Last edited / Name / Created), search by name. "All themes" toggle shows items from other themes with a theme chip; opening one switches the theme (existing theme rule: items belong to a theme).
- Empty filter result: one line ("No posts in this size") + "Show all sizes".
- Pagination: infinite scroll, 24 per page, using the new light list endpoint (5.2).

**Mobile (`max-lg`):** same content as a native list screen: segmented tabs on top, a horizontal "Start new" chip row, then a 2-column grid of cards; **New** is a floating `+` button above the bottom nav that opens a bottom sheet (sizes, AI, Blank, Collage, All templates). ⋯ on a card opens a bottom action sheet. Select mode via long-press. 44px targets throughout.

### 4.5 Save and copy model

#### 4.5.1 Kinds of items

| Kind                    | What it is                                                                          | Created by                                                                                    | Editable in place                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Template (built-in)** | Code presets (Posts campaign templates, video storyboard recipes, calendar layouts) | Code                                                                                          | **Never.** Opening one starts a design                                                                        |
| **Template (yours)**    | A design the host chose to reuse                                                    | **Save as template** (plan `customTemplates`)                                                 | Yes, from "Your templates" ⋯ → Edit template (opens it explicitly as a template, banner "Editing a template") |
| **Design**              | The host's work                                                                     | First real edit of a draft, Duplicate, Copy to another size, AI result the host chose to keep | Yes, autosaves                                                                                                |

Stored in `marketing_templates` with a new `kind` column (`design` | `template`), see 5.1.

#### 4.5.2 Opening a template

1. Host picks a template (Library, gallery, or the editor's Templates rail tab).
2. Editor opens `item=new&from=<id>&format=<fmt>` with the template loaded. Status shows nothing (not "Unsaved").
3. Nothing is written until the content fingerprint differs from the template baseline. On the first real edit, autosave **creates** one design row named after the template ("Weekday deal"), the URL is replaced with `item=<uuid>` (no extra history entry), and status shows **Saving… → Saved**.
4. Closing an untouched draft writes nothing. This alone removes most of the bloat.

**Opening a template you already used:** if this theme already has designs made from the same template in the last 30 days, the gallery card shows a small "Used 2×" chip and picking it opens a compact choice: **Continue "Weekday deal"** (most recent) or **Start new**. Prevents accidental near-duplicates without blocking a fresh start.

#### 4.5.3 Editing a design

- Autosave exactly as today (`useMarketingAutoSave`, 2.5s debounce, Unsaved → Saving… → Saved, unsaved-changes guard on pending / error), but **always by row id**. `resolveTemplateId` lookups by preset + format are deleted.
- Name is shown in the editor top bar and is **renamable inline** (click, type, Enter / blur saves; Escape cancels).
- **Replace with template** inside the editor (Templates rail tab) asks: "Replace this design?" **Replace** / **Open as new design** / Cancel. Default for a design that has edits is "Open as new design".

#### 4.5.4 Explicit copies

| Action                   | Result                                                                                                                                                                                                                                                           | Gate                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Duplicate**            | New design "Name (copy)" in the same size and theme, opens it                                                                                                                                                                                                    | `marketing.templates:add`                          |
| **Copy to another size** | New design in the chosen size, joined to the same size group; Posts preset-based designs re-render the preset in the new size with the same text / photo bindings; custom / collage designs use the existing resize path (collage relayout, Polotno page resize) | `marketing.templates:add`                          |
| **Resize this design**   | Same row, new size (with confirm, since layout may shift)                                                                                                                                                                                                        | `marketing.templates:edit`                         |
| **Save as template**     | New `kind = template` row, a frozen copy; the design stays a design                                                                                                                                                                                              | `customTemplates` plan + `marketing.templates:add` |

Server-side duplicate (5.2) copies the stored thumbnail too, so the new card has art immediately.

#### 4.5.5 Delete

- Single delete: confirm dialog (existing copy pattern). Bulk delete from Select mode: "Delete 6 posts?".
- **Recommended (Phase 5b, decision D4):** soft delete into **Recently deleted** (`deleted_at`, restore within 30 days, nightly `pg_cron` purge) since autosave makes "I deleted the wrong one" more likely. Published Meta posts are unaffected either way (same as today).

#### 4.5.6 Sizes and AI results

- A **size group** (`group_id`) ties designs that are the same idea in different sizes (AI runs today, Copy to another size). Library shows them as **one card** with a "3 sizes" chip; opening shows the most recently edited size; the editor's size switcher lists siblings ("Story · Square · Facebook") and switches between rows, not between presets.
- **AI generate inside an editor** no longer writes rows up front. Results appear in a picker sheet ("Pick a design"); the host picks one, which becomes **one design** (or one size group when the engine produced all sizes). Others are discarded. Same rule as AI Post today.
- Rename / delete on a grouped card apply to the group (existing `planSavedTemplateRelatedIds` behavior, now driven by `group_id`), with the dialog stating it.

#### 4.5.7 Concurrency (hardening)

`PATCH` accepts `ifUpdatedAt`; when the row changed since load (another tab / teammate) the edge returns **409**, autosave pauses and shows "Changed elsewhere" with **Reload** / **Keep mine** (Keep mine re-sends without the check). Prevents silent overwrites now that rows are long-lived.

### 4.6 Template gallery

One shared component, `MarketingTemplateGallery`, used three ways: Library "See all templates", the `+ New` menu, and the editor's Templates rail tab (compact variant).

- **Desktop:** large `Dialog` (max 1100px), left category list, top size filter + search, grid of cards at the correct orientation (portrait cards are taller, landscape wider, in a justified row grid so mixed sizes stay aligned).
- **Mobile:** full-height bottom sheet, category chips row, 2-column grid.
- Categories are **fixed** per content type (no add / rename / move). "Your templates" is the first category when the host has any. Built-in category labels come from code.
- Hover / focus shows a larger preview; Videos show a short muted animated preview only on hover / tap-and-hold (never autoplay a grid).
- Locked items (plan) keep today's watermark pattern; picking still opens the editor (preview-open policy).

**Removed:** add / rename / remove category, rename / move built-in template, localStorage catalog prefs (`useMarketingCatalog`), the per-category saved-item filtering. Saved designs carry their original `categoryId` only as a filter hint for "From template: Promos" (optional).

### 4.7 Editor layout (one shell for all three editors)

```
┌ Top bar ──────────────────────────────────────────────────────────────────┐
│ ‹ Posts │ Summer promo ✎ │ ✓ Saved │      [↶][↷] [Size: Story ▾] [⬇] [Publish] │
├──────┬────────────────────────────────────────────────────┬───────────────┤
│ Rail │                                                    │ Inspector     │
│ ▦ Templates                                               │ (selection /  │
│ T Text                         Canvas                     │  scene /      │
│ ◇ Elements                                                │  calendar     │
│ ⬆ Uploads                                                 │  style;       │
│ 🖼 Photos                                                 │  Basic ⇄      │
│ ★ Reviews                                                 │  Advanced)    │
│ ✨ AI                                                     │               │
├──────┴────────────────────────────────────────────────────┴───────────────┤
│ Video only: timeline                                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

Rules that apply to every editor:

1. **Top bar** replaces the tab row while editing (focus mode, decision D2): back link `‹ Posts` (to the Library), inline name, save status, undo / redo, **Size** menu (switch sibling / Copy to another size / Resize this design), **Download** (icon + label on `xl`, icon only below), **Publish** (primary). Download / Publish keep their `TierBadgeAnchor`s. The theme bar stays in the page header.
2. **Left rail = things you add or start from**, a single icon rail with a slide-out panel (Canva model). One rail only: for Posts we register our sections as **custom Polotno side-panel sections** (`KameBuiltinPanels.tsx` already customizes them) and delete `MarketingEditorSidebar` from the Posts tab, so the canvas gains ~300px.
3. **Right inspector = properties of what is selected** (Calendar style, Video scene). Collapsible; Basic first, **Advanced** behind a toggle (today's "Advanced" panels move here unchanged).
4. **Mobile:** rail items become the bottom dock buttons (max 5, overflow in ⋯), each opening a bottom sheet with the same panel content; inspector opens as a sheet when something is selected (Calendar: a "Style" dock button). Top bar compresses to `‹` · name · status · ⋯ (Download, Publish, Size, Undo / Redo live in ⋯, as today). Keeps the existing `MarketingEditorMobileToolbar` / `MarketingEditorMobilePanel` primitives.

Per-editor rail contents:

| Editor   | Rail tabs                                                                                                                                                                                   | Inspector                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Posts    | Templates · Text · Elements (with Logo) · Uploads · Photos (property gallery) · Background · Layers · Collage · Reviews (only when the design is a review layout or the host opens it) · AI | Polotno's contextual toolbar stays on top of the canvas (no right inspector needed)                                                                             |
| Videos   | Templates · Scenes (add / reorder; timeline stays at the bottom) · Photos · Text · Music · Reviews · AI                                                                                     | Selected scene: Layout, Overlay, Motion, Transition, Duration, Elements, Text style                                                                             |
| Calendar | Templates (layouts) · Show on calendar (toggles) · Photos (background) · AI                                                                                                                 | Calendar style: Basic (colors follow theme, fonts, corners) / Advanced (existing panels: Container, Header, Day names, Cells, States, Legend, Watermark, Frame) |

Removed from the sidebar: the full-width "Generate with AI" button (→ rail ✨ AI and the Library "Start with AI" card), format picker (→ top bar Size menu + Library start row), "Start from" segmented control (→ Library / gallery entries Blank and Collage, plus the Collage rail tab).

### 4.8 AI Studio redesign

**Problem to solve:** inner tabs that echo outer tabs, two layouts, split galleries.

**New structure: one composer, one feed.**

```
Desktop (container ≥ 56rem)                         Mobile
┌ Composer (26rem) ─────────┐ ┌ Your AI creations ───────────┐   Composer card
│ What do you want to make? │ │ [All] [Posts] [Photos] [Clips] │   (collapses to a
│ ( Post ) ( Photo ) ( Clip )│ │ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │   "New creation"
│                           │ │ └───┘ └───┘ └───┘ └───┘       │   bar after first
│ Describe it               │ │ newest first, mixed types,    │   result)
│ [                       ] │ │ in-flight cards on top        │   ↓
│ Your photos  [+ Add]      │ │                               │   Feed (1 column,
│ Post: Goal · Size         │ │                               │   2 from 28rem)
│ Photo: Look · Size · Qual.│ │                               │
│ Clip: Camera move · Length│ │                               │
│ [ Generate · 4 credits ]  │ │                               │
└───────────────────────────┘ └───────────────────────────────┘
```

- **Output choice is the first field of one form**, not a tab bar: three large choice tiles with an icon and a 3-word hint ("Ready-to-post design", "New photo", "8s video clip"). Only the fields that differ swap below it; Describe and Your photos are shared and **keep their values when switching** (today switching to AI Post clears the draft).
- **Rename the generative video output to "Clip"** everywhere in AI Studio, so it no longer collides with the Videos tab (which makes slideshow videos from templates). Ids in code (`mediaType: 'video'`) unchanged.
- **One feed** ("Your AI creations") with filter chips All / Posts / Photos / Clips. AI Post results become feed items too: a poster batch is shown as one row of 4 variants with Edit / Shuffle / Download / Post on each (Edit saves one design to Posts and opens it, as today). Poster batches are kept for the session (in memory, as today) plus the last batch per property in `sessionStorage` so a refresh does not lose them (decision D5 on persisting server-side).
- **Cross-links instead of duplication:** a Photo result gets **Use in a post** (opens a new Posts draft with the photo as background) next to Publish / Download / ⋯. A Clip gets **Add to a video** (new Videos draft with the clip as first scene, if Remotion import of mp4 scenes is supported; otherwise hidden, decision D6).
- **Fresh state:** composer + 3 example prompts per output type as tappable chips (fills Describe), no empty gallery box. **Returning state:** feed first on mobile (composer collapsed into a sticky "New creation" bar that expands into a sheet), side by side on desktop.
- Plan gating per output tile: locked tiles stay selectable and the Generate button shows the `TierBadge` + opens the upgrade modal (today's behavior, moved to the tile).
- Landing output: last used, else Post when `aiMarketingGeneration` allowed, else Photo, else Clip (today's rule).

**Editor AI entry points (Phase 7, decision D3):**

| Editor   | Today                                                                   | Proposed                                                                                                                                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Posts    | Wizard (`MarketingAiGeneratePanel`, category → message → look, 3 sizes) | Rail ✨ AI opens the **AI Post** composer in a sheet bound to the open size; results picker; chosen variant replaces or opens as new (4.5.3). One engine for posts. Requires goal parity: add Last slots / Giveaway / Fully booked / Reviews goals to the poster compiler, or keep the wizard only for those categories until parity |
| Videos   | Wizard → Remotion storyboard                                            | Keep (no AI Studio equivalent); label "Write with AI"; results picker instead of 3 auto rows                                                                                                                                                                                                                                         |
| Calendar | Wizard → style tokens                                                   | Keep; label "Style with AI"; results picker instead of 3 auto rows                                                                                                                                                                                                                                                                   |

### 4.9 Thumbnail pipeline (performance)

Principle: **the Library and the gallery never run the editor engine on the main thread for the host's own work, and run it at most once per template per theme for templates, only when visible, only on capable devices.**

| Item                          | New approach                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Designs (all editors)**     | Static image in Storage. Captured (a) on first create, (b) at most every 30s during autosave when idle, (c) on leaving the editor (flush), (d) when the theme changed since capture (on next open only, never in the Library). Capture size: long edge 480px, WebP 0.8 (JPEG fallback), via `toBlob` + blob URL, never data URLs in React state. Calendar gains capture via the existing html-to-image path (`marketingHtmlToImageOptions.ts`) instead of live DOM cards                                                                                                                                                                                                       |
| **Library cards**             | `<img loading="lazy" decoding="async" width height>` with `content-visibility: auto` on rows; skeleton until load; stale-theme cards show the old image with no re-render (the item re-themes when opened, same as today's rule for saved items)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Calendar layout templates** | New `CalendarMiniPreview`: a lightweight themed **SVG** (frame, header bar, 7×5 cell grid with booked / available / blocked colors and the layout's cell shape: circle / ring / block / ruled, legend dots). Generated from the layout's styles in a few hundred nodes, no fonts or photos. The full live preview is used only for the large hover preview in the gallery                                                                                                                                                                                                                                                                                                      |
| **Post / video templates**    | Keep the headless renders + IndexedDB cache, but: (1) request only on `IntersectionObserver` visibility (delete the eager `requestThumbnails(visiblePresetIds)` call), (2) never while an editor canvas is mounted and busy (pause queue on `pointerdown` / while playing video, resume on idle), (3) cap 6 renders per idle window, (4) store blob URLs, revoke on eviction (cache already supports it), (5) **low-spec mode** when `navigator.deviceMemory ≤ 4`, `hardwareConcurrency ≤ 4`, or `saveData`: show a themed SVG wireframe from the preset definition (`preview.primary/secondary`, layout blocks) and render the real thumb only for the hovered / focused card |
| **List payload**              | Light list endpoint without `design_json` (5.2). Full JSON fetched on open (`?id=`) with TanStack Query cache, prefetch on hover                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Theme showcase**            | Already uses stored thumbnails; switch its calendar from live DOM to the captured design thumbnail or `CalendarMiniPreview`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Budgets (verify in Phase 0 and Phase 8):** Library on a 4× CPU-throttled Chrome profile: first cards visible < 1.5s, no long task > 200ms, Polotno / Remotion chunks **not** requested. Opening Posts editor: no thumbnail render until 2s idle after canvas ready. Memory: no growth beyond 80 cached thumbnails.

### 4.10 Copy (human-copy + minimal-ui-copy)

| Place                 | String                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Fresh Library heading | Make your first post / video / calendar                                                    |
| AI card               | Start with AI · Describe it and get a ready design                                         |
| Start row             | Start new                                                                                  |
| Section               | Your posts / Your videos / Your calendars / Your templates                                 |
| Card menu             | Open · Rename · Duplicate · Copy to another size · Save as template · Delete               |
| Reuse prompt          | Continue "{name}" · Start new                                                              |
| Replace prompt        | Replace this design? · Replace · Open as new design                                        |
| Conflict              | Changed elsewhere · Reload · Keep mine                                                     |
| Bulk delete           | Delete {n} posts? · Deleted items can be restored for 30 days (only with Recently deleted) |
| AI outputs            | Post · Photo · Clip, hints: Ready-to-post design · New photo · 8s video clip               |
| AI feed               | Your AI creations                                                                          |

No em dashes in UI strings. Final strings go through the `human-copy` skill during implementation.

## 5. Data model and API

### 5.1 Migration (new file, never edit shipped ones)

`supabase/migrations/<ts>_marketing_templates_library.sql`:

```sql
ALTER TABLE public.marketing_templates
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'design',
  ADD COLUMN IF NOT EXISTS group_id UUID,
  ADD COLUMN IF NOT EXISTS source_template_id TEXT,   -- preset id or template uuid it started from
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;    -- Phase 5b, Recently deleted
ALTER TABLE public.marketing_templates
  ADD CONSTRAINT marketing_templates_kind_check CHECK (kind IN ('design', 'template'));
CREATE INDEX IF NOT EXISTS idx_marketing_templates_library
  ON public.marketing_templates (property_id, content_type, kind, theme_key, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_templates_group ON public.marketing_templates (group_id);
```

**Backfill (same migration, idempotent):**

1. `group_id` ← `design_json->>'aiGenerationId'` cast to uuid when valid (one group per AI run).
2. `source_template_id` ← `design_json->>'templateId'` (posts / videos) or `design_json->>'sourcePresetId'` (calendar presets).
3. **Hidden preset autosaves become visible designs:** rows where `sourcePresetId` is a preset id (not `custom` / `default`) stay `kind = 'design'`; `design_json.sourcePresetId` is rewritten to `custom` so no client code path treats them as presets. They now appear in "Your posts / calendars" named after the preset (append nothing; the Library shows the edited time).
4. Explicit "Save template" rows (`sourcePresetId = 'custom'`) → `kind = 'design'` (they behave like designs today: they autosave). Decision D7 if the team wants them as `template`.
5. Calendar blank / orphan rows that the client dedupe would have deleted: left in place as designs; hosts can bulk-delete. **No server-side deletes in the migration.**
6. `kind = 'template'` is only produced by the new Save as template action.

Copy-settings (org **Properties → Copy settings**) must carry the new columns; check `copy-property-settings` (or equivalent) and the property clone path.

### 5.2 `marketing-templates` edge function

| Change                                         | Detail                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET` list (light)                             | `?view=library&content_type=&kind=&theme_key=&q=&size=&cursor=&limit=24` → `id, name, kind, content_type, aspect_preset, theme_key, group_id, source_template_id, thumbnailUrl, updated_at, created_at, ai_generated, is_collage` (derived server-side). Excludes `design_json`. Ordered `updated_at DESC, id`. Filters `deleted_at IS NULL` |
| `GET ?id=`                                     | Unchanged (full row)                                                                                                                                                                                                                                                                                                                         |
| `POST`                                         | Accepts `kind`, `groupId`, `sourceTemplateId`                                                                                                                                                                                                                                                                                                |
| `POST {action:'duplicate', id, aspectPreset?}` | Server-side copy of the row + Storage copy of the thumbnail; `name` + " (copy)" unless `aspectPreset` given (then same name, same `group_id`, creating one when missing)                                                                                                                                                                     |
| `PATCH`                                        | Accepts `ifUpdatedAt` → 409 `{ code: 'conflict', updatedAt }` on mismatch                                                                                                                                                                                                                                                                    |
| `DELETE`                                       | Accepts `ids[]` (bulk, max 50, same property). Phase 5b: sets `deleted_at`; `POST {action:'restore', id}`; `GET ?view=deleted`                                                                                                                                                                                                               |
| Old list callers                               | Keep `GET` without `view` working until all editors switch (one release), then remove the full-payload list                                                                                                                                                                                                                                  |
| Tests                                          | Extend `supabase/functions/tests/*` handler tests + `_shared` unit tests for backfill helpers                                                                                                                                                                                                                                                |

Auth unchanged: `serveAuthenticated` + `verifyPropertyAccess`; permission leaves `marketing.templates:add / :edit / :delete` as today.

### 5.3 Activity log

| Event                                         | When                                                                               | Note                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `marketing.template_saved` (existing)         | Create of a design (first edit), Save as template, Duplicate, Copy to another size | `details.kind`, `details.action` (`create` / `duplicate` / `save_as_template` / `copy_size`) |
| `marketing.template_deleted` (existing)       | Single and bulk delete (one event per row, or one event with `count` for bulk)     |                                                                                              |
| `marketing.template_restored` (new, Phase 5b) | Restore from Recently deleted                                                      | Add to `activityLog.ts` registry                                                             |
| —                                             | Autosave `PATCH`                                                                   | **activity-log: N/A** — content edits every few seconds; would flood the log                 |

Verify whether `marketing.template_saved` is emitted today from `marketing-templates`; wire it if not.

### 5.4 Plans and permissions

No new plan keys and no new permission leaves. Mapping: Save as template → `customTemplates` (Starter+) as today; Duplicate / Copy to size → `marketing.templates:add`; rename / resize → `:edit`; delete / restore → `:delete`; AI outputs keep `aiMarketingGeneration` / `aiMarketingImageGeneration` / `aiMarketingVideoGeneration`; Download `marketingStudio`; Publish `marketingPublishLimitPerGroup`. `plans-and-permissions`: N/A for new keys, update copy in `plans-feature-matrix.md` only if labels change.

## 6. Phases

Each phase ships independently, keeps CI green (`bun run ci:quality`), updates the route guide, and is verified at 375 / 768 / 1280px.

### Phase 0 — Baseline (no product code)

- Screenshot every tab, fresh and returning, at 375 / 768 / 1280 (Playwright CLI) → attach to the PR description of Phase 1 as "before".
- Performance trace (Chrome, 4× CPU, Fast 4G) of: landing on Posts, scrolling the template grid, switching category, opening Videos, Calendar sidebar scroll. Record long tasks, thumbnail render count, JS requested.
- Row audit on hosted dev (read-only SQL via MCP): rows per property by `content_type`, preset-autosave vs custom vs AI, video rows sharing `templateId` (duplicate estimate), `design_json` size p50 / p95.
- Output: numbers table appended to this plan.

### Phase 1 — Quick wins (small, safe, visible)

1. Tab order AI Studio · Posts · Videos · Calendar; landing resolver + `marketing-last-tab:{propertyId}` (`marketingStudioNav.ts`, `MarketingStudioModeTabs.tsx`, `MarketingThemeProvider.tsx`).
2. **Fix the video duplicate-row bug** now, before the bigger model change: add a `resolveTemplateId` that reuses the row created in this editing session for the selected preset + format (session map), so re-picking a preset and editing does not create a second row in the same session.
3. Delete the eager `requestThumbnails(visiblePresetIds)` / `requestThumbnails(saved…)` effects in `MarketingTemplatesPanel.tsx`; rely on per-card visibility.
4. AI Studio: rename output "Video" → "Clip" in labels, empty states, generating stage and guide; keep Describe / photos when switching mode.
5. Move `PublishHistory` into a collapsed "Recent publishes" disclosure (temporary home until Phase 3).
6. Tests: `marketingStudioNav` resolver unit tests; video session-reuse unit test.

### Phase 2 — Data model + API

1. Migration + backfill (5.1). Run locally with `bun run db:migrate`; dev via `bun run deploy:supabase:dev` (prod only with explicit unlock).
2. Edge function changes (5.2) + handler tests; activity log (5.3).
3. Client: `useMarketingLibrary(contentType, filters)` infinite query (light list), `useMarketingDesign(id)` (full row), `useDuplicateMarketingDesign`, `useDeleteMarketingDesigns` (bulk), query keys under `['marketing-templates', propertyId, …]` so existing invalidations keep working.
4. Remove `useDesignTemplateCleanup` and `useCalendarTemplateDedupe` (and their `plan*Purge/Dedupe/Orphan` helpers once unused). Client code must never bulk-delete on a localStorage flag again.
5. Docs: data model, migration runbook entry, `docs/architecture/overview.md` + `docs/PROJECT.md` API rows.

### Phase 3 — Library home + URL state + editor top bar

1. `MarketingLibraryHome` (shared, takes `contentType`): fresh and returning states (4.3, 4.4), size / sort / search / all-themes filters, Select mode + bulk delete, Recent publishes section.
2. `MarketingDesignCard` (replaces `MarketingTemplateCard` for user items): stored thumbnail, badges, ⋯ actions, keyboard, long-press on touch.
3. URL `item` / `from` / `format` params handled in `MarketingThemeProvider` (or a new `useMarketingStudioRoute`), with `replace` on draft → saved.
4. `MarketingEditorTopBar` (back, inline rename, status, undo / redo slot, Size menu, Download, Publish) replacing `MarketingBuilderHeader` while an editor is open; tabs hidden in editor (D2).
5. Lazy editor mount: `MarketingStudioPage` renders Library by default; Polotno / Remotion chunks load only with `item`. Prefetch on hover / idle.
6. Mobile: Library native list screen, FAB `+` → New sheet, card action sheet, compressed top bar.
7. Unsaved guard: leaving the editor via back link uses the existing `useUnsavedChangesGuard` path (`saveNow`).

### Phase 4 — Save model in all three editors

1. Draft mode (`item=new`): baseline fingerprint = template output; first divergence creates the row (`kind: 'design'`, `source_template_id`, `group_id` null) then switches to id-based autosave.
2. Delete preset + format autosave resolution: `findDesignAutosaveTemplate`, `findCalendarAutosaveTemplate`, `isDesignPresetAutosave`, `isCalendarPresetAutosave`, the replay-on-preset-click logic in `PolotnoDesignStudio.tsx` / `CalendarBuilder.tsx`, the blank-calendar manual "Save Template" button (blank becomes a normal draft).
3. Duplicate, Copy to another size, Resize this design, Save as template, inline rename, Replace with template prompt, "Used 2×" reuse prompt.
4. AI generate in editors → results picker; only the chosen result is saved (one design or one size group).
5. Optimistic concurrency (`ifUpdatedAt`, 409 UI).
6. Tests: autosave draft-to-row transition, no row for untouched drafts, group rename / delete, duplicate naming, conflict handling (Vitest with mocked API; Playwright mocked E2E for "open template → close untouched → Library has no new card" and "edit → card appears").

### Phase 5 — Template gallery + editor rails

1. `MarketingTemplateGallery` (dialog / sheet / compact rail variant), fixed categories, size filter, search, justified orientation grid, hover preview.
2. Posts: register Templates / Photos / Collage / Reviews / AI as custom Polotno side-panel sections; remove `MarketingEditorSidebar` + `MarketingTemplatesPanel` from the Posts tab.
3. Videos: icon rail + panels (Templates, Scenes, Photos, Text, Music, Reviews, AI) + right scene inspector; timeline stays.
4. Calendar: rail (Templates, Show on calendar, Photos, AI) + right style inspector with Basic / Advanced.
5. Shared `MarketingEditorRail` component used by Videos and Calendar, styled to match the Polotno rail (`polotno-design-studio.css`) so all three look the same.
6. Remove `useMarketingCatalog` localStorage categories, category menus, `MarketingMoveTemplateDialog`, `MarketingCategoryChip` menus.
7. Mobile: rail → dock buttons + sheets (existing primitives), inspector → sheet.
8. **5b (optional, D4):** Recently deleted (soft delete, restore, purge cron via `pg_cron` per `scheduled-jobs-and-testing.md`).

### Phase 6 — Thumbnail pipeline

1. Design capture policy (create / 30s idle / leave / theme-stale-on-open), 480px WebP, blob URLs.
2. Calendar design capture via html-to-image; delete `CalendarLayoutLivePreview` from cards.
3. `CalendarMiniPreview` SVG for layout templates (+ unit snapshot tests per layout shape).
4. Render queue: pause while canvas interaction / video playback, cap per idle window, visibility-only requests.
5. Low-spec mode detector (`lib/marketingDeviceTier.ts`) + preset SVG wireframes.
6. Theme showcase calendar switched to captured thumbnail / mini preview.
7. Re-run the Phase 0 traces; budgets in 4.9 must pass.

### Phase 7 — AI Studio redesign

1. Replace the inner `SegmentedControl` with output choice tiles inside one composer (`AiStudioComposer` absorbs AI Post fields; `AiPostPanel` becomes the Post-specific field group + results renderer).
2. Unified feed "Your AI creations" (jobs + session poster batches), filter chips, in-flight cards on top, infinite scroll.
3. Cross-links: Photo → Use in a post; Clip → Add to a video (D6).
4. Fresh state example prompts; returning state collapsed composer on mobile.
5. Editor AI entries per 4.8 table (D3): Posts rail AI → AI Post composer sheet; Videos / Calendar keep their wizards with results picker and new labels.
6. Tests: composer field persistence across output switch, gating per tile, feed filtering.

### Phase 8 — Hardening, consistency and docs

1. Consistency pass: same top bar, rail width, panel padding, card style, empty states, focus rings, 44px targets across the three editors and the Library.
2. Accessibility: rail is a `tablist`, gallery grid keyboard navigation, live region for save status, dialogs trap focus, reduced-motion respected for hover previews.
3. `production-readiness-review` on the module; Playwright mocked E2E updates under `ui/e2e/features/marketing*`; smoke suite green.
4. Docs (required in each phase, consolidated here): route guide `org/property/marketing.md` (rewrite Content Studio tabs, Templates menus, autosave sections and Host-facing Q&A: "Where are my designs?", "Does opening a template change it?", "How do I make a copy?", "Why didn't my edit create a new file?"), `docs/architecture/marketing-themes.md` (thumbnails), `marketing-poster-studio.md` (AI Post entry), `data-model.md`, `edge-functions.md`, `overview.md`, `PROJECT.md`, `migration-runbook.md`, this plan → `in-progress` → `done` via `/workflow-start` / `/workflow-done`.

## 6b. Implementation status (2026-10-20)

All phases are implemented on `develop` (uncommitted working tree). The migration is applied **locally only**; hosted dev / prod are not deployed.

| Phase                     | Status  | Notes                                                                                                                                                                                                                                                                            |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Baseline                | Partial | Local row audit only (below). Hosted-dev SQL audit, before screenshots and Chrome perf traces not run.                                                                                                                                                                           |
| 1 Quick wins              | Done    | Tab order + last-tab resolver; Clip rename; Recent publishes collapsed. The interim video session-reuse fix was superseded by the Phase 4 draft model.                                                                                                                           |
| 2 Data model + API        | Done    | Migration `20261316128400` (backfill with the touch trigger disabled), RPCs, edge views / actions, conflict + 410, activity events, Deno tests. Client cleanup hooks removed.                                                                                                    |
| 3 Library + URL + top bar | Done    | Fresh / returning / select / Recently deleted; focus mode; lazy editors with hover preload. Mobile uses a **New** button in the start row (no FAB).                                                                                                                              |
| 4 Save model              | Done    | Draft → first edit creates one row, URL replace without remount; duplicate, copy / resize size, Save as template, Replace / Open as new, Used N× → Continue / Start new; `ifUpdatedAt` conflicts. AI in editors saves **one** item at the current size (no multi-result picker). |
| 5 Gallery + rails         | Done    | Uniform 4:5 tiles (no justified grid or hover preview). Posts: Templates / Collage / Reviews / AI as Polotno sections. Videos rail: Templates / Reviews / AI (scene, text, music stay in the inspector). Calendar rail: Layouts / Show / AI. Recently deleted (D4) shipped.      |
| 6 Thumbnails              | Done    | Capture policy, calendar mini SVG + `preview_styles`, render gate, low-spec mode, offscreen Polotno export, showcase view. Phase 0 budgets not re-measured (no baseline trace).                                                                                                  |
| 7 AI Studio               | Done    | Post / Photo / Clip radiogroup, shared description, unified feed + filter chips, Use in a post, session batch (D5). Add to a video hidden (D6). Posts keeps the existing AI wizard (D3: no parity yet).                                                                          |
| 8 Hardening + docs        | Done    | Route guide, PROJECT, overview, data model, edge functions, plans matrix, themes, poster studio, runbook, scheduled jobs. Not done: keyboard Delete on Library cards, long-press select on touch.                                                                                |

**Phase 0 local numbers (before backfill):** 213 `marketing_templates` rows; 51 duplicate "Quiet morning" video rows and 16 `promo-500-off` post rows for one property (the bloat this plan removes); `design_json` average ~3 KB, max 46 KB.

**Known follow-ups**

- Deploy the migration and functions to hosted dev (`bun run deploy:supabase:dev`), then verify the backfill counts and the purge job there.
- Rows purged by the SQL cron leave their Storage thumbnail behind (unreferenced, harmless); the edge lazy purge removes thumbnails only for rows it deletes itself.
- Host templates are editable only by saving a new template from an item (no in-place template editing).
- Real two-tab conflict and the hosted 30-day purge need manual QA.

## 7. Testing matrix

| Layer               | What                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vitest              | nav resolver, draft-to-row autosave transition, size group planning, duplicate naming, reuse-prompt selection (last 30 days), device tier, mini preview geometry, gallery filtering                          |
| Deno                | edge list view (no `design_json`), filters, cursor pagination, duplicate (row + thumbnail copy), bulk delete scope (cannot delete another property's ids), 409 conflict, backfill SQL on fixtures            |
| Playwright (mocked) | fresh Library → template → no edit → back → still empty; edit → card appears once; duplicate; copy to size; bulk delete; AI Studio output switch keeps Describe; mobile 375 Library + editor sheets          |
| Manual              | 4× CPU throttle budgets; real Meta publish from an opened design; plan tiers Free / Starter / Pro / Business; team member with view-only marketing permission (Library visible, no New / Duplicate / Delete) |

## 8. Required checklists per phase

- `documentation-maintenance` + `route-guides` (every phase changes the Marketing route UX).
- `mobile-responsive` (every UI phase).
- `unsaved-changes-guard`: editors keep `useUnsavedChangesGuard`; inline rename commits on blur; Replace / Resize prompts are confirms, not editable forms.
- `audit-logging`: 5.3.
- `plans-and-permissions`: 5.4 (no new keys).
- `human-copy` / `minimal-ui-copy`: 4.10.
- `performance`: 4.9 budgets.

## 9. Decisions

**Confirmed 2026-10-19:** all recommendations below accepted as written (D1 Posts · Videos · Calendar after AI Studio; D2 focus mode; D3 one post engine after goal parity; D4 Recently deleted; D5 sessionStorage only; D6 only if mp4 scenes work; D7 old saves → `design`; D8 theme-scoped Library with All themes toggle).

| #   | Question                                                     | Recommendation                                                                       |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| D1  | Tab order after AI Studio                                    | Posts · Videos · Calendar (daily tools first). Alternative: keep Calendar second     |
| D2  | Hide the tab row while an editor is open                     | Yes (focus mode, back link to Library). Alternative: keep tabs visible on `xl+` only |
| D3  | One AI engine for posts (AI Post) replacing the Posts wizard | Yes, after goal parity; wizard stays for missing goals until then                    |
| D4  | Recently deleted (soft delete, 30 days)                      | Yes, Phase 5b                                                                        |
| D5  | Persist AI Post batches server-side                          | Not now; `sessionStorage` last batch only                                            |
| D6  | "Add to a video" for Clips                                   | Only if Remotion scenes can play an mp4 cleanly; otherwise hide                      |
| D7  | Old "Save template" rows → `design` or `template`            | `design` (they autosave in place today, which is design behavior)                    |
| D8  | Library scoped to open theme with "All themes" toggle        | Yes (matches the theme model)                                                        |

## 10. Risks

| Risk                                                                         | Mitigation                                                                                                                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosts used the "click preset → see my edit" replay as their way back to work | Backfill turns those rows into visible designs named after the preset; guide Q&A explains; Library shows them first                                   |
| Polotno custom side-panel sections behave differently on mobile              | Prototype in Phase 5 behind the existing mobile dock; keep `MarketingEditorMobilePanel` as fallback                                                   |
| Thumbnail capture on leave races navigation                                  | Capture before navigation resolves (await with 1.5s cap), otherwise mark stale and capture on next open                                               |
| Large refactor of 1,300–1,700 line editor files                              | Phase 4 extracts draft / autosave wiring into `useMarketingDesignDocument(contentType)` shared by all three editors first, then deletes the old paths |
| AI Studio redesign changes muscle memory                                     | Same fields, same buttons, only the mode switch moves into the form                                                                                   |
| Copy-settings / property clone miss new columns                              | Explicit check in Phase 2                                                                                                                             |

## 11. Out of scope

Version history; folders / tags for designs; team comments on designs; scheduling (tracked in `marketing-meta-publishing-gaps.md`); new templates or new AI capabilities; theme editor changes.
