---
title: 'Stay Guide — Showcase template engine parity'
status: done
stage: done
tags: [planning, stay-guide, showcase, page-editor, public-pages, templates]
updated: 2026-09-01
---

# Stay Guide — Showcase template engine parity

> **Stage:** [`done`](./README.md) — Phases 0–6 shipped (2026-09-01). Stay Guide guest page + Page Editor use the same 6-template Showcase engine; manual regression script: [`../../guides/testing/stay-guide-manual.md`](../../guides/testing/stay-guide-manual.md).

## Progress log

- **2026-08-29 — Feedback round 1 (parity with Showcase editor):**
  1. **Contained chrome fix.** `useShowcaseContainedChrome` / `useShowcaseConfigControlled`
     (`showcase/lib/showcaseChrome.ts`) now accept the `stay-guide` preview-override kind, not
     only `property-showcase` — the template header no longer escapes the editor frame as a
     `fixed` bar over the dashboard, and palette/motion follow the editor config live.
  2. **Live template thumbnails.** New `StayGuideTemplatePicker` + `StayGuideTemplatePreviewThumb`
     - `lib/stayGuideTemplateThumbData.ts` — the exact Showcase pipeline (scaled inert mobile
       render, `ShowcaseTemplateThumbSurface`, `PreviewViewportProvider="mobile"`,
       `useDeferredValue`). Replaces the plain radio-card grid. `StayGuidePageEditor` passes the
       merged preview DTO to the panel.
  3. **Default all-visible confirmed.** `defaultStayGuideConfigV2()` already sets every section
     `visible: true`; the earlier scrambled/hidden state was leftover local test config — cleared.
     Verified live: fresh default renders all 8 sections.
  4. **Editor parity pass** vs `PropertyShowcaseEditorPanel` / `PropertyShowcasePageEditor`:
     template-change scrolls the preview to top (`handleTemplateChange`); Section-details copy
     fields **prefill with the resolved default** and store only diffs (`baselineCopy` via
     `mapStayGuideData` with copy stripped); `AdminMobilePage title="Stay Guide"` (was
     "Public Pages", now matches Showcase's `title="Showcase"`); `stayGuideConfigForSave` helper
     used for the two save paths; hero CTA points at in-page anchors (`#<first-chapter>` /
     `#host`) with label "Open the guide" instead of dead booking links.
  - `type-check` / `lint` (0 errors) / `build` clean. Guest render re-verified (Aurora + Haven,
    8/8 sections, hero anchors, 0 console errors).
  - **Still cosmetic:** the hero **secondary** button label ("Check dates" / "View calendar")
    is hardcoded per-template hero component — for Stay Guide it scrolls to `#host` but keeps
    the booking-flavoured label. Rich-text ink tone item from the earlier list still stands.

- **2026-08-29 — Phases 3 + 4 + 5 shipped.**
  - **Types** (`showcase/types/showcase.ts`): `TemplateSectionKind`, `pageKind`,
    `ShowcaseStayGuideExtras` (pass + checkInDocuments), `ShowcaseResolvedSection` gains
    `id: string` + `kind` + `bodyHtml` + `blocks` + `accentColor`. `mapShowcaseData` sets
    `kind = id` / `pageKind: 'showcase'` — **Showcase render verified unchanged** (all 9
    sections, 0 console errors, `Monaco 2612 - Showcase` title).
  - **`mapStayGuideData.ts`** (new): `GuestStayGuideDto` + v2 config → `ShowcaseData`
    (`pageKind: 'stay-guide'`). Hero/gallery image-slot resolution, chapter HTML merge
    (`check-in-instructions` / `house-rules`+`parking-reminders` / `check-out-instructions`),
    preview lorem/stock fill, live-page empty-section drop.
  - **`templates/shared/StayGuideSections.tsx`** (new): one palette-skinned
    `StayGuideTemplatedSection` rendering `passCard` / `checkInDocuments` / `chapter` /
    `host` (Need anything) / `quickNav` (→ null). All 6 `*Sections.tsx` delegate to it for
    stay-guide kinds (`sec.kind !== 'gallery'`); `hero` + `gallery` keep bespoke per-template
    renderers. `shouldRenderShowcaseSection` + `ShowcaseShell` nav + page title branch on
    `pageKind`.
  - **`StayGuidePage.tsx`** rewritten — resolves token/preview/editor data → `mapStayGuideData`
    → `getShowcaseTemplate(templateKey).component` under `<Suspense>`. **Verified live**
    against a token property (`kame-home`): Aurora shell renders hero + stay-pass (real
    booking data) + check-in doc chips + chapters (rich HTML + section images + accent) +
    Need-anything, section visibility + `accentColor` from the migrated v2 config respected,
    0 console errors, `Kame Home - Stay Guide` title.
  - **Editor** (Phase 4): new `stores/stayGuideEditorStore.ts` (v2, snapshot = config +
    templateKey, `applyTemplateTypography`), new `StayGuideEditorPanel.tsx` (Template picker
    - `SectionReorderList` + `Palette/Typography/Motion` controls + per-section detail
      accordions with nested `StayGuideSectionContentCard` for chapters), new
      `StayGuidePageEditor.tsx` (config + template-key + chapter-content autosave tracks,
      mirrors `PropertyShowcasePageEditor`). `PageEditorPage.tsx` swapped to it; inline
      `StayGuidePageEditor` + dead imports removed. `usePublicPageConfig` typed `StayGuideConfigV2`.
  - **Cleanup:** deleted `StayGuideHero` / `StayGuideCompactHeader` / `StayGuideTabs` /
    `StayGuideChapter` / `StayGuideCheckInLocation` / `StayPassCard` /
    `StayGuideCheckInDocumentsSection` / `StayGuideGalleryCarousel` / `StayGuideHelpSection`
    / `lib/stayGuideChapters.ts` + v1 config types in `api.ts` + the transitional
    `coerceStayGuideConfigV1` guard.
  - **Docs:** rewrote `docs/guides/routes/stay-guide.md`; updated `public-pages.md`,
    `property-showcase.md`, `PROJECT.md` (Page Editor table + data model).
  - `bun run type-check` / `lint` (0 errors) / `build` / `check:filenames` all clean.
  - **Gating deferred to the concurrent workstream.** That session landed
    `20261212120000_public_pages_explore_open.sql` (re-opens `customPages` on Free/Starter)
    - a Showcase guest-page plan-lock overlay + `useShowcaseData` status wrapping — i.e.
      **explore-open editor, gate on save (`publicPagesAutosave` Pro+) + live-URL Pro lock**.
      They reverted this plan's `RequirePropertyFeature` route wrapper; not re-applied to avoid
      thrash. Net effect still satisfies "Stay Guide + Showcase are Pro capabilities" (save +
      live URL). `custom-pages-settings` stay_guide template PATCH gates on `publicPagesAutosave`
      (their edit) rather than `customPages` — equivalent post-migration.

- **2026-08-29 — Concurrent workstream note:** another session is pushing plan-tier cleanups
  through the same tree (`20261210120200_marketing_studio_pro_tier.sql`, `planPresentation.ts`
  label tweaks, `plans-feature-matrix.md` / `for-hosts.md` edits — Content Studio → Pro; a
  `team/` + `TierBadge` refactor). Complementary with this plan's Pro move; migration
  numbering coordinated (mine: `…120000` / `…120100` / `…120300`; theirs: `…120200`).
  **Their `team/` edits currently leave `bun run type-check` red** (`TeamInviteTierBadgeAnchor`
  unused import) — unrelated to this plan's files, which type-check clean in isolation.
- **2026-08-29 — Phase 2 (server template keys + payload) shipped:**
  - `_shared/customPages.ts` — Stay Guide reuses the 6 `showcase-*` keys.
    `STAY_GUIDE_DEFAULT_TEMPLATE_KEY = showcase-aurora`; `normalizeTemplateKey` coerces any
    non-`showcase-*` key to Aurora for both page types; `resolveStayGuideTemplateKey` now
    returns a normalized `ShowcaseTemplateKey`.
  - `custom-pages-settings/index.ts` PATCH — no longer rejects `stay_guide`; validates the
    key against `SHOWCASE_TEMPLATE_KEYS`; permission `publicPages.stayGuide:edit` and plan
    gate `customPages` for stay_guide, `publicPages.showcase:edit` / `propertyShowcase` for
    showcase.
  - `supabase/migrations/20261210120300_stay_guide_template_keys.sql` — repoints legacy
    `stay-guide-warm-arrival` rows to `showcase-aurora`. Applied; all 3 local rows now Aurora.
  - `guestStayGuide.ts` already emits the v2 `sectionConfig` (Phase 1). Hero-image-from-slot
    resolution deferred to client `mapStayGuideData` (matches Showcase's `resolveImages`).
  - Client `type-check` clean.
- **2026-08-29 — Phase 5.20 (Pro gating) shipped first** as a self-contained slice:
  - `supabase/migrations/20261210120000_public_pages_pro_tier.sql` — `customPages` +
    `publicPagesAutosave` → `false` for free/starter/commission, `true` for
    growth(Pro)/pro(Business)/managed. Applied + verified on local DB.
  - `ui/.../custom-pages/routes/index.tsx` — `/public-pages` and
    `/public-pages/:pageId/edit` wrapped in `<RequirePropertyFeature feature="customPages">`.
  - `featureGateCopy.customPages` rewritten (was "no longer gates anything").
  - `planPresentation.ts` — `'Public pages access & editor + autosave'` moved from the
    `starter` card bullets to `growth`; added `'Property showcase & stay guide templates'`.
  - Docs: `plans-feature-matrix.md`, `org/plans.md`, `for-hosts.md`,
    `org/property/public-pages.md` (progress table + plan-requirement line).
  - `type-check` / `lint` / `build` clean.
  - **Deferred to Phase 4:** server `customPages` gate on `custom-pages-settings` PATCH for
    the `stay_guide` template key (only `property_showcase` is gated there today).
- **2026-08-29 — Phase 1 (config v2) shipped:**
  - `ui/.../stay-guide/lib/stayGuideConfig.ts` (new) — `StayGuideConfigV2`,
    `STAY_GUIDE_SECTION_IDS`, `defaultStayGuideConfigV2`, `normalizeStayGuideConfigV2`,
    `upgradeStayGuideConfigV1toV2`, `stayGuideConfigForSave`. Reuses Showcase's
    palette/typography/motion types + `normalizeShowcasePaletteMode`.
  - `_shared/publicPageConfigs.ts` — v1 type kept as `StayGuideConfigV1`; `StayGuideConfig`
    now = `StayGuideConfigV2`; `defaultStayGuideConfig` / `normalizeStayGuideConfig` return
    v2 (delegating palette/typo/motion cleanup to `normalizePropertyShowcaseConfig`);
    `upgradeStayGuideConfigV1toV2` added. `normalizePublicPageConfig('stay_guide')` →
    v2 automatically (upsert + guest read paths).
  - `supabase/migrations/20261210120100_stay_guide_config_v2.sql` — one-shot v1→v2
    backfill (PL/pgSQL). Applied + verified locally against a reordered/hidden-chapter
    row: order, `accentColor`, and every `visible` flag preserved; all 3 local rows now v2.
  - `public-page-configs/index.ts` — header comment only (PATCH already routes through
    `normalizePublicPageConfig`; no shape validation to change).
  - Runbook: `docs/archive/operations/migration-runbook.md` § 11a.
  - `type-check` / `check:filenames` clean. No client consumer flipped to v2 yet — v1
    render/editor paths still run on the (now v2) DB via the in-memory upgrade until
    Phases 3–4 land.
  - **Transitional guard:** `coerceStayGuideConfigV1(raw)` in `stayGuideChapters.ts`
    (tagged `TODO(Phase 3/4): remove`) returns v1 defaults for any v2/malformed config, so
    the legacy renderer (`StayGuidePage`) and editor (`PageEditorPage` hydrate) don't crash
    on the missing `.chapters` while the DB is already v2. `type-check` / `lint` (0 errors,
    272 baseline warnings) / `build` all green.
- **2026-08-29 — Phase 0 deviation:** NOT doing the physical
  `showcase/` → `marketing/page-templates/` directory move. ~70-file `git mv` balloons the
  diff and risk for zero user-visible benefit. The shared engine stays physically under
  `ui/src/features/guest/marketing/showcase/`; `stay-guide` imports the registry + style
  system from there. `TemplatePageData` / `ResolvedSection` kinds are added under
  `showcase/types/`. Revisit the move later if the cross-feature import proves painful.

## Goal

Bring the **Stay Guide** guest page + Page Editor to full parity with **Property Showcase**:
the same 6 animated templates (Aurora, Monolith, Editorial, Verso, Atlas, Haven), the same
per-template chrome / motion / typography / palette system, the same editor (live template
picker, section reorder + visibility, style controls, per-section copy/image detail cards),
and the same live preview pipeline. **Only the content differs** — Stay Guide keeps its
current sections and content model.

### Decisions locked (2026-08-29)

| Question     | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template set | **Same 6 templates**, names and chrome unchanged; they render Stay Guide sections instead of marketing sections.                                                                                                                                                                                                                                                                                                                                   |
| Rollout      | **Full replace.** The current chapter/tabs/rich-text Stay Guide design is deleted. New template-based page + editor is the only Stay Guide. Existing saved `stay_guide` configs migrate.                                                                                                                                                                                                                                                           |
| Guest access | **Keep the per-booking token.** `get-guest-stay-guide?token=…` gate stays; guest name / dates / parking endorsement / check-in documents still inject. Only the visual layer + editor change.                                                                                                                                                                                                                                                      |
| Plan gate    | **Explore-open + Pro save.** Gallery and all three Page Editors stay open on Free; **save/autosave** requires **Pro** (`publicPagesAutosave`). Live Showcase URL requires **Pro** (`propertyShowcase`) with non-dismissible blur overlay when denied.                                                                                                                                                                                              |
| Sections     | **Keep the existing Stay Guide section set + content model** — Hero, Stay Pass card, Check-in documents, Gallery, Quick-nav, the three chapters (Getting In / Make Yourself at Home / Before You Go, backed by the `check-in-instructions` / `house-rules` / `parking-reminders` / `check-out-instructions` property templates), Need Anything / Host. No marketing sections (about / amenities / highlights / testimonials / book-CTA) are added. |

## Current state (what exists today)

**Showcase** — `ui/src/features/guest/marketing/showcase/` (~70 files)

- `templates/registry.ts` → 6 lazy template components, each `({ data: ShowcaseData }) => JSX`.
- `templates/{aurora,monolith,editorial,verso,atlas,haven}/` — per-template `*Sections.tsx` +
  `*Template.tsx`; shared shell/host/panels/kinetic in `templates/shared/`.
- `lib/` — `mapShowcaseData.ts` (DTO → `ShowcaseData` with `sections: ShowcaseResolvedSection[]`),
  `showcaseThemeTokens.ts`, `showcaseStyleConfig.ts`, `showcaseEditorStyleFields.ts`,
  `showcaseSectionMock.ts`, palette/motion/scroll libs, `ShowcaseStyleProvider`, `ShowcaseShell`,
  `ShowcaseGalleryCarousel`, `ShowcaseLocationSection`, `ShowcaseMobileMenu`.
- `types/showcase.ts` — `PropertyShowcaseConfig` (palette / typography / motion / `sections[]` with
  `copy` / `imageSlots` / `columns` / `ctaLabel` / `heroEyebrow` / `locationLead`), mirrored server-side
  in `_shared/publicPageConfigs.ts`.
- Editor — `dashboard/page-editor/components/property-showcase/` (`PropertyShowcasePageEditor`,
  `PropertyShowcaseEditorPanel`, `ShowcaseTemplatePicker` + `ShowcaseTemplatePreviewThumb`),
  `stores/propertyShowcaseEditorStore.ts`, shared controls in `page-editor/components/shared/`
  (`StyleControls`, `SectionReorderList`, `CopyOverrideField`, `CtaOverrideField`,
  `ImageSlotPicker`, `HeroEyebrowField`, `ShowcaseCustomPalettePicker`).
- Data — `get-public-showcase` (`?property=` + published gate), `public-page-configs`
  (`page_type=property_showcase`), `custom-pages-settings` (`template_key`).
- Plan gate — `propertyShowcase` (Growth+) for editor/publish/template; `publicPagesAutosave` for autosave.

**Stay Guide** — `ui/src/features/guest/stay-guide/` (~17 files)

- `pages/StayGuidePage.tsx` — hand-built single design: `StayGuideHero` / `StayGuideCompactHeader`,
  `StayPassCard`, `StayGuideCheckInDocumentsSection`, `StayGuideGalleryCarousel`, `StayGuideTabs`,
  `StayGuideChapter` (rich HTML), `StayGuideHelpSection`.
- `lib/stayGuideChapters.ts` — builds 3 chapters from the 4 standard property-template sections.
- `lib/api.ts` — `GuestStayGuideDto` (property + booking + contact + host + `sections[]` (key / label /
  displayHeading / html / imageUrl) + `checkInDocuments[]` + `sectionConfig`), token fetch.
- Editor — `dashboard/page-editor/components/stay-guide/` (`StayGuideEditorPanel`,
  `StayGuideSectionContentCard` — rich-text WYSIWYG + section image per property template),
  `stores/stayGuideEditorStore.ts`, `lib/stayGuideChapterSections.ts`.
- `StayGuideSectionConfig` — `version` + per-section `{ visible }` + `chapters[]`
  (`id` / `visible` / `order` / `accentColor`). **No** palette / typography / motion / templateKey.
- Content stays on **property templates** (`usePropertyTemplates`, `saveTemplate`, placeholders) —
  the Page Editor edits template `content` + `sectionImageUrl` per key, autosaved separately.
- Data — `get-guest-stay-guide` (`?token=`), `_shared/guestStayGuide.ts#loadGuestStayGuideByToken`
  → resolves `templateKey` (`resolveStayGuideTemplateKey`) + `sectionConfig`
  (`getPublicPageConfigOrDefault`) + placeholder-filled `sections[]`.
- Route — `properties/:propertySlug/stay-guide` (outside `MainLayout`, same as showcase).
- Plan gate — `customPages` (Starter+) for the editor; `publicPagesAutosave` for autosave.

## Target architecture

Extract the Showcase template layer into a **shared page-template engine** that both page kinds
feed. A template component renders a list of **resolved sections keyed by `kind`**; each page kind
supplies its own section kinds + resolver. Per-template chrome/motion/typography/palette is applied
uniformly by the engine, not re-implemented per page kind.

```
ui/src/features/guest/marketing/page-templates/            (NEW – moved from showcase/)
├── engine/
│   ├── registry.ts            6 template entries: ({ data: TemplatePageData }) => JSX
│   ├── TemplatePageData.ts    { pageKind, templateKey, palette/typo/motion config,
│   │                            brand, chrome (logo/name/nav), sections: ResolvedSection[],
│   │                            embed, reducedMotion, preview }
│   ├── ResolvedSection.ts     discriminated union by `kind`
│   ├── TemplateStyleProvider  (was ShowcaseStyleProvider)  — palette/typo/motion CSS vars
│   ├── TemplateShell / MobileMenu / GalleryCarousel / MapLocation / kinetic  (moved as-is)
│   └── themeTokens / styleConfig / editorStyleFields / sectionMock / palette libs (moved)
├── templates/{aurora,monolith,editorial,verso,atlas,haven}/
│   └── *Sections.tsx now switch on section.kind → renderers for every kind either page uses
└── section-kinds/
    ├── showcase.ts   hero | gallery | about | amenities | highlights | location | testimonials | host | cta
    └── stayGuide.ts  hero | passCard | checkInDocuments | gallery | quickNav | chapter | host
```

`showcase/` keeps only `pages/PropertyShowcasePage.tsx`, `hooks/useShowcaseData.ts`,
`lib/mapShowcaseData.ts` (now → `TemplatePageData`) and re-exports for back-compat.

### Section kind → renderer coverage

Every template's `*Sections.tsx` must render **all** kinds from both pages. Reuse mapping:

| Stay Guide kind    | Reuse from Showcase renderer    | Notes                                                                                                                                                                                                                   |
| ------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero`             | `hero`                          | Same. Eyebrow source = property location/development/custom (already shared). Hero image slot picker.                                                                                                                   |
| `chapter`          | `about` (rich-body block)       | Renders sanitized template HTML (`StayGuideRichContent`) inside the template's body-section frame + eyebrow/heading chrome. One section per chapter; chapter may hold 2 sub-sections (house-rules + parking) → stacked. |
| `gallery`          | `gallery`                       | Same `GalleryCarousel` / Verso pinned gallery.                                                                                                                                                                          |
| `host`             | `host`                          | Host avatar/org/contact + "Need anything?" copy; reuse `ShowcaseHostSections` variants.                                                                                                                                 |
| `passCard`         | _new_ small renderer            | Booking Stay Pass (dates, check-in/out times, codes). Template-styled card; one shared component themed by CSS vars, like `ShowcaseInfoPanels`.                                                                         |
| `checkInDocuments` | _new_ small renderer            | GAF / pet / parking endorsement doc chips. Shared component themed by vars.                                                                                                                                             |
| `quickNav`         | template header nav / scrollspy | Fold into the shared `TemplateShell` sticky nav (Showcase already has per-template header nav + scrollspy) instead of a separate tab bar.                                                                               |

New shared components live in `section-kinds/` and read the same `--template-*` CSS vars the 6
templates set, so they inherit each template's look with no per-template code.

## Config model

Extend the Stay Guide config to the Showcase shape (keep Stay Guide section ids):

```ts
// ui/src/features/guest/stay-guide/lib/api.ts  (mirror in _shared/publicPageConfigs.ts)
type StayGuideSectionId =
  | 'hero'
  | 'passCard'
  | 'checkInDocuments'
  | 'gallery'
  | 'quickNav'
  | 'chapter:getting-in'
  | 'chapter:make-yourself-at-home'
  | 'chapter:before-you-go'
  | 'host';

type StayGuideSectionConfigV2 = {
  version: 2;
  published: boolean; // token pages ignore; kept for parity + future
  palette: PropertyShowcaseConfig['palette'];
  typography: PropertyShowcaseConfig['typography'];
  motion: PropertyShowcaseConfig['motion'];
  sections: Array<{
    id: StayGuideSectionId;
    visible: boolean;
    order: number;
    copy?: { heading?: string; subheading?: string; body?: string }; // body unused for chapter (rich text lives on template)
    imageSlots?: string[]; // hero + gallery
    heroEyebrow?: ShowcaseTextSourceConfig; // hero only
    accentColor?: string | null; // chapter only (carries the old per-chapter accent)
  }>;
};
```

- `templateKey` continues to live in `custom_pages` (`resolveStayGuideTemplateKey`) — already
  supports all 6 `showcase-*` keys server-side (`SHOWCASE_TEMPLATE_KEYS`). No new key list.
- **Chapter rich text + section images stay on property templates** (`check-in-instructions`
  etc.) exactly as today — the Page Editor keeps its dual autosave (config + template content).
- `columns` / `ctaLabel` / `ctaTarget` / `locationLead` from the Showcase config are **omitted**
  for Stay Guide (no amenities grid, no booking CTA, no standalone location section).

### Migration

`supabase/migrations/<ts>_stay_guide_config_v2.sql` — one-shot: for every `public_page_configs`
row with `page_type='stay_guide'`, transform `version:1` → `version:2`:

- map `hero/stayPassCard/checkInDocuments/galleryCarousel/quickNavTabs/helpSection.visible` +
  `chapters[]` → the new flat `sections[]` (preserve order; `helpSection`→`host`;
  `stayPassCard`→`passCard`; `quickNavTabs`→`quickNav`; each `chapters[i]`→`chapter:<id>` with
  `accentColor` carried; `order` = interleave chapters into their saved slot, others in the
  legacy fixed order).
- add `palette`/`typography`/`motion` = Showcase defaults (`default` / `jakarta` `md` /
  `standard` `parallax` `canvas`), then apply `applyTemplateTypography(templateKey)` equivalent
  server-side so a pre-existing non-Aurora `template_key` gets its display font.
  Guard reads with a `normalizeStayGuideConfig()` that upgrades v1 in memory too (belt + braces
  for any row the migration misses / configs created between deploy steps).

Runbook entry: `docs/archive/operations/migration-runbook.md`.

## Work breakdown

### Phase 0 — Extract the shared engine (no behavior change)

1. Move `showcase/components`, `showcase/lib` (style/theme/palette/motion/mock/scroll),
   `showcase/templates`, `showcase/hooks` (`useScrollSpy`, parallax) → `marketing/page-templates/`.
   Keep `showcase/` re-export shims so imports elsewhere don't break in one commit.
2. Rename `Showcase*` → `Template*` for the truly generic pieces (`StyleProvider`, `Shell`,
   `MobileMenu`, `GalleryCarousel`, `MapLocation`, `ThemeProvider`, kinetic). Leave
   `mapShowcaseData` / `useShowcaseData` / `PropertyShowcasePage` in `showcase/`.
3. Introduce `TemplatePageData` + `ResolvedSection` union; make `mapShowcaseData` return it
   (showcase section kinds only). Templates switch on `section.kind`; today only showcase kinds
   exist so output is identical. **Verify:** showcase guest page + editor pixel-identical.
   `bun run type-check && bun run lint && bun run build`.

### Phase 1 — Stay Guide config v2 (client + server types)

4. `stay-guide/lib/api.ts`: add `StayGuideSectionConfigV2` + `normalizeStayGuideConfig()`
   (v1→v2 upgrade). Keep the old type exported as `StayGuideSectionConfigV1` for the migration.
5. `_shared/publicPageConfigs.ts`: mirror v2 type; `getPublicPageConfigOrDefault('stay_guide')`
   returns v2 default; add server `normalizeStayGuideConfig`. `custom-pages-settings` /
   `public-page-configs` PATCH validation accepts v2 (+ still tolerates v1 on read).
6. Migration + in-memory upgrade (see Migration above). `bun run db:migrate` locally,
   `/fix-migration-issues` if drift.

### Phase 2 — Server payload

7. `_shared/guestStayGuide.ts`: return v2 `sectionConfig`; keep `sections[]` (rich HTML) as-is;
   add `heroImageUrl` resolution from `sections[hero].imageSlots` (fallback: property primary).
   Payload otherwise unchanged (booking / contact / host / checkInDocuments still injected).
8. `get-guest-stay-guide` unchanged (still token-only). No new edge function.

### Phase 3 — Guest renderer

9. `stay-guide/lib/mapStayGuideData.ts` (NEW): `GuestStayGuideDto` + v2 config →
   `TemplatePageData` with Stay Guide `ResolvedSection`s. Placeholder/mock fill for
   preview/embed/editor via a Stay-Guide `sectionMock` (chapters get lorem HTML, gallery gets
   stock images; Stay Pass / check-in docs use `isPreviewSample`). Reuse
   `applyShowcasePreviewMocks` pattern.
10. New shared section renderers in `page-templates/section-kinds/` for `passCard`,
    `checkInDocuments`, `chapter` (wraps existing `StayGuideRichContent`), `quickNav` fold-in.
11. Extend each `templates/*/​*Sections.tsx` to render the Stay Guide kinds (mostly delegate to
    the shared renderers inside the template's section frame + eyebrow/heading chrome).
12. Rewrite `StayGuidePage.tsx`: resolve token/preview/editor-override data → `mapStayGuideData`
    → `getTemplate(templateKey).component`. Delete `StayGuideHero`, `StayGuideCompactHeader`,
    `StayGuideTabs`, `StayGuideChapter`, `StayPassCard` (replaced by shared renderers),
    `stayGuideChapters.ts` chapter-builder (replaced by section resolver). Keep
    `StayGuideRichContent`, `StayGuideGalleryCarousel` (or swap for the shared one),
    `StayGuideCheckInDocumentsSection` internals (rewrapped), `useGuestStayGuide`.
13. `previewOverrideContext` — extend the `stay-guide` override kind to carry
    `templateKey` + v2 config (mirror the `property-showcase` override shape).

### Phase 4 — Page Editor

14. New `dashboard/page-editor/components/stay-guide/StayGuidePageEditor.tsx` modeled on
    `PropertyShowcasePageEditor` — config autosave (`public-page-configs` `stay_guide`) +
    template autosave (`custom-pages-settings` `stay_guide`) + **keep** the existing per-template
    rich-text/image content autosave (that stays a Stay-Guide-only third track).
15. New `StayGuideEditorPanel` (replaces current) mirroring `PropertyShowcaseEditorPanel`:
    - **Template** — `TemplatePicker` (reuse `ShowcaseTemplatePicker` generalized +
      `ShowcaseTemplatePreviewThumb` fed Stay Guide data).
    - **Sections** — `SectionReorderList` over the 9 Stay Guide section ids
      (`hero` locked visible; others toggleable/reorderable; chapters reorder among themselves
      and with the rest).
    - **Style** — reuse `PaletteControl` / `TypographyControl` / `MotionControl` +
      `resolveTemplateEditorStyleFields(templateKey)` (same template-aware visibility).
    - **Section details** — accordion per section: Hero (eyebrow + heading/sub + single image +
      picker), Gallery (heading/sub + multi image), chapters (heading override + the existing
      `StayGuideSectionContentCard` rich-text + section-image editor nested per property
      template key), Stay Pass / Check-in docs / Host (heading/sub overrides only), quickNav
      (visible toggle only).
16. New `stores/stayGuideEditorStore.ts` (replace) modeled on `propertyShowcaseEditorStore`
    (snapshot = `{ config, templateKey }`, history/undo/redo, `normalizeStayGuideConfig`,
    hero locked visible).
17. `PageEditorPage.tsx` `StayGuidePageEditor` wrapper — swap to the new component; keep the
    content-drafts wiring (still needed for chapter rich text).
18. `page-editor/lib/stayGuideChapterSections.ts` — remap to the new section ids.

### Phase 5 — Cleanup, gating, docs

19. Delete dead Stay Guide components/libs (list in Phase 3.12) and their tests/e2e refs.
20. **Plan gate — move Public Pages (editor + Showcase + Stay Guide) to Pro** (decided
    2026-08-29). "Pro" = the tier card labeled **Pro**, internal plan code `growth`.
    - NEW `supabase/migrations/<ts>_public_pages_pro_tier.sql`:
      `pricing_plans.features` → `customPages` **and** `publicPagesAutosave` = `false` for
      `free` / `starter` / `commission`, `true` for `growth` / `pro` / `managed`.
      `propertyShowcase` already `growth`+ — leave. (Mirrors the pattern in
      `20261209120100_property_showcase_entitlement.sql`.)
    - Client + server `_shared/planFeatures.ts` / `plans/lib/planFeatures.ts` — defaults
      already `false`; no code change, only DB.
    - `plans/lib/planPresentation.ts` `PLAN_TIER_CARD_GAINS` — move
      `'Public pages access & editor + autosave'` from the `starter` list to the `growth`
      list (next to `'Property showcase landing pages'`); the comparison **matrix** rows
      (`PLAN_FEATURE_ROWS` for `customPages` / `publicPagesAutosave` / `propertyShowcase`)
      are data-driven from `pricing_plans.features`, so they follow the migration
      automatically — just re-verify the rendered check/× per tier.
    - Gating code already routes through `customPages` (`custom-pages/routes/index.tsx`,
      `CustomPagesPage.tsx`) and `propertyShowcase` (`PropertyShowcasePageEditor`); the new
      `StayGuidePageEditor` gets an explicit `customPages` gate (upgrade CTA → `customPages`)
      for parity. `PageEditorPage` stay-guide/listing branches gain the same `customPages`
      check so a deep link can't bypass the module gate.
    - Regression: Starter test org loses the Public Pages card + `/public-pages/*` routes
      (upgrade prompt); Pro test org keeps everything.
21. Docs (same change):
    - `docs/guides/routes/org/property/public-pages.md` — Stay Guide card now has template
      picker + style; drop "v1: one template"; plan requirement Starter → **Pro**.
    - `docs/guides/routes/stay-guide.md` (exists) — rewrite for 6 templates, style controls,
      section list, token behavior; mirror the Showcase guide structure.
    - `docs/guides/routes/property-showcase.md` — note the shared engine.
    - **Pricing/plan docs (CLAUDE.md-mandated set):** `docs/architecture/plans-feature-matrix.md`
      (move Public pages + autosave rows to Pro), `docs/guides/routes/org/plans.md`,
      `docs/guides/routes/for-hosts.md` (`/for-hosts/pricing` copy). Live pricing renders from
      `list-public-pricing-plans` + `planPresentation.ts` + DB `features`, so the migration +
      `PLAN_TIER_CARD_GAINS` edit cover the app; these docs must match.
    - `docs/PROJECT.md` — routes/data-model/API deltas (config v2, shared engine path, Pro gate).
    - `.cursor/rules/*` — none touched (no booking-workflow / admin-auth surface).
    - `docs/guides/testing/property-showcase-manual.md` sibling for Stay Guide, or a shared file.
    - `docs/archive/operations/migration-runbook.md` — v2 backfill + Pro-tier feature flip.
    - Route-guides skill + documentation-maintenance skill checklists.

### Phase 6 — Verify (`verify` skill)

- `bun run type-check && lint && check:filenames && build`.
- Local stack: token stay guide for a `READY_FOR_CHECKIN` booking renders each of the 6
  templates; Page Editor picker switches live; style/motion controls affect preview; chapter
  rich-text still autosaves; mobile preview (375/768/1024) via Playwright MCP.
- Migration: seed a v1 `stay_guide` config row, run migration, confirm v2 shape + visibility/
  order/accent preserved.
- Regression: Showcase guest + editor unchanged; `?embed=1` / `?preview=1` still work for both.

## Remaining / follow-ups (post-2026-08-29)

**Closed in code (2026-09-01):**

- Rich-text ink tone — `StayGuideRichContent` uses `--showcase-ink` / `--showcase-ink-muted` vars.
- Hero secondary CTA — **Contact host** on Stay Guide (was hardcoded **Check dates**).
- In-page hero CTAs — shared `ShowcaseSectionLink` scrolls `#anchor` targets in guest pages **and** the Page Editor preview frame (Stay Guide + Showcase).
- CTA label helper — all templates use `resolveShowcaseSecondaryCtaLabel` (no hardcoded **View calendar** on closing bands).
- Single-block chapters — no redundant inner card when `blocks.length === 1`.
- Template picker thumbnails — `StayGuideTemplatePicker` + live scaled previews (shipped 2026-08-29).
- Legacy v1 components removed (`StayGuideHero`, `StayGuideTabs`, `StayGuideChapter`, etc.).

**Manual QA only:**

- Editor click-test in signed-in dashboard (template picker, reorder, style, chapter autosave, leave-confirm).
- Phase 6 verify checklist — [`../../guides/testing/stay-guide-manual.md`](../../guides/testing/stay-guide-manual.md).

**Decided — no code change:**

- **Gating model** — explore-open editor + Pro save (`publicPagesAutosave`); live URL plan overlay when denied. Hard route gate on Free not required.

## Risks / open items

- **Scope.** This is a large refactor (Phase 0 alone touches ~70 files via moves). Land Phase 0
  as its own PR (pure move + shim) so the diff is reviewable, then Phases 1–3, then 4–5.
- **Quick-nav vs. tab bar.** Folding `quickNav` into each template's header nav is cleaner than a
  bolted-on tab strip but means 6 header components learn "chapter" anchors. Fallback: keep a
  shared themed tab bar section renderer if per-template nav proves too invasive.
- **Chapter = rich HTML inside animated templates.** Verso/Atlas kinetic section frames assume
  short copy; long sanitized HTML needs a readable-prose container that opts out of
  word-fade/mask effects. Add a `prose` escape hatch in the kinetic primitives.
- **Two content stores.** Stay Guide keeps config (page_configs) **and** chapter content
  (property_templates). The editor already juggles both; the new panel must preserve that.
- **Plan gating** — decided: **Pro** (`growth`). Starter orgs lose Public Pages entirely; the
  migration is a one-way tier change — coordinate the deploy with any Starter orgs mid-edit.
- Legacy `houseRules`→`host` normalization already exists for Showcase; add the analogous
  v1→v2 Stay Guide normalization in the same spot.

## Implementation map (new/changed paths)

| Layer             | Path                                                                                                                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared engine     | `ui/src/features/guest/marketing/page-templates/**` (moved from `showcase/`)                                                                                                                                                              |
| Showcase glue     | `showcase/pages/PropertyShowcasePage.tsx`, `showcase/hooks/useShowcaseData.ts`, `showcase/lib/mapShowcaseData.ts`                                                                                                                         |
| Stay Guide guest  | `stay-guide/pages/StayGuidePage.tsx` (rewrite), `stay-guide/lib/mapStayGuideData.ts` (new), `stay-guide/lib/stayGuideSectionMock.ts` (new), `stay-guide/lib/api.ts` (v2 types), delete Hero/CompactHeader/Tabs/Chapter/StayPassCard       |
| Section renderers | `page-templates/section-kinds/{showcase,stayGuide}.ts` + shared `passCard` / `checkInDocuments` / `chapter` components                                                                                                                    |
| Editor            | `page-editor/components/stay-guide/{StayGuidePageEditor,StayGuideEditorPanel}.tsx` (rewrite), `StayGuideSectionContentCard.tsx` (keep, nested), `stores/stayGuideEditorStore.ts` (rewrite), `page-editor/lib/stayGuideChapterSections.ts` |
| Shared editor UI  | reuse `page-editor/components/shared/*` + `property-showcase/ShowcaseTemplatePicker` (generalize)                                                                                                                                         |
| Server            | `_shared/publicPageConfigs.ts` (v2), `_shared/guestStayGuide.ts` (v2 payload + hero image), `custom-pages-settings` / `public-page-configs` validation                                                                                    |
| Migration         | `supabase/migrations/<ts>_stay_guide_config_v2.sql`                                                                                                                                                                                       |
| Docs              | `public-pages.md`, new `stay-guide.md` route guide, `PROJECT.md`, migration runbook, testing guide                                                                                                                                        |
