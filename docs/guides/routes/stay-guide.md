---
title: 'Guest stay guide (token-gated brochure)'
status: active
tags: [guides, routes]
updated: 2026-08-29
---

# Guest stay guide (token-gated brochure)

Route: `/properties/:propertySlug/stay-guide?token=<opaque>`

> **Status:** Documented — v2 renders through the **Property Showcase template engine**.

**Manual testing:** [`stay-guide-manual.md`](../testing/stay-guide-manual.md) · [`custom-pages-module-manual.md`](../testing/custom-pages-module-manual.md)

## Purpose

Mobile-first page for booked guests: check-in / house-rules / parking / check-out content
from **Property Templates** (standard keys), a booking **Stay Pass**, approved check-in
**documents**, a photo **gallery**, and a **Need anything?** host block — rendered through the
**same 6 animated templates as [[property-showcase|Property Showcase]]** (Aurora, Monolith,
Editorial, Verso, Atlas, Haven). Hosts pick a template, reorder/toggle sections, and set
palette / typography / motion in **Public Pages → Stay Guide → Edit**; the guest link is still
per-booking and token-gated. Linked from the **ready-for-checkin** email
(`{{stay_guide_cta_section}}`).

**What changed vs. v1:** the bespoke chapter/tabs "digital pamphlet" design is gone. Stay Guide
now feeds `mapStayGuideData` → `ShowcaseData` (`pageKind: 'stay-guide'`) and renders via
`getShowcaseTemplate(templateKey).component`, exactly like Showcase. Only the **section set**
and **content source** differ.

While the guide or its template chunk loads, the page shows a full-bleed skeleton: header, hero,
then stacked sections (a two-column block from `lg`).

---

## Host-facing knowledge

After you approve a guest for check-in, they get a private link to a stay guide with your
rules, check-in steps, parking notes, and contact details. You choose how it looks in
**Public Pages → Stay Guide → Edit**: pick one of 6 templates, drag sections to reorder,
hide the ones you don't need, and set colours / fonts / motion — the same controls as Showcase.

**Common host questions**

- Q: When does the guest get the link? A: When the booking reaches ready-for-check-in
  (in that email, and from the booking in your dashboard).
- Q: Can anyone open it? A: No — each link uses a unique token tied to that booking and only
  works during the stay window.
- Q: How do I change the wording? A: **Public Pages → Stay Guide → Edit → Section details** —
  expand a chapter to edit its text and section image (also editable under **Templates**).
- Q: How do I change how it looks? A: Same editor — **Template**, **Sections** (reorder /
  hide), and **Style** (palette / type / motion).
- Q: Which plan? A: Editing is available on every plan; **saving** needs Pro
  (`publicPagesAutosave`) — same as Showcase and the listing editor.

---

## Access

| Rule       | Detail                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| **Token**  | Opaque `stay_guide_token` on `guest_submissions`; issued when booking reaches **`READY_FOR_CHECKIN`**         |
| **Window** | **Asia/Manila** check-in day `00:00` through end of day **after** check-out (`23:59:59+08:00`)                |
| **Status** | `READY_FOR_CHECKIN`, `READY_FOR_CHECKOUT`, `PENDING_SD_REFUND`, or `COMPLETED` (not `CANCELLED` or pre-ready) |
| **Slug**   | API accepts optional `?property=`; must match booking property when provided                                  |
| **Title**  | `{Property Name} - Stay Guide` via `usePageTitle` / `ShowcaseShell`                                           |

Expired or invalid token → generic unavailable message (no leak of booking existence).
`?preview=1&property_id=<uuid>` (signed-in host, `templates:view`) and `?embed=1` bypass the
token and inject sample booking data + lorem/stock placeholders for empty sections.

## Sections (v2)

`StayGuideConfigV2.sections[]` — a flat, reorderable list (mirrors `PropertyShowcaseConfig`):

| Section id                                               | Kind               | Content source                                                                                                                                                                |
| -------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero`                                                   | `hero`             | Property name / logo / photo (per-template hero); eyebrow = location / custom; top inset from `showcaseHeroLayout` clears portaled fixed header (live + Page Editor)          |
| `passCard`                                               | `passCard`         | Booking: guest name, check-in/out date + time, parking / pet pills                                                                                                            |
| `checkInDocuments`                                       | `checkInDocuments` | Approved GAF / pet / parking-endorsement doc chips (`isPreviewSample` in preview)                                                                                             |
| `gallery`                                                | `gallery`          | Property photos (`ShowcaseGalleryCarousel`); host can curate slots                                                                                                            |
| `quickNav`                                               | `quickNav`         | Renders nothing in the body — shared `ShowcaseShell` header covers it (inline links or hamburger when full name + labels would not fit with comfortable gaps)                 |
| `getting-in` / `make-yourself-at-home` / `before-you-go` | `chapter`          | Rich HTML from property templates (`check-in-instructions`, `house-rules` + `parking-reminders`, `check-out-instructions`), one block per template; per-chapter `accentColor` |
| `host`                                                   | `host`             | Host avatar / name + phone / email / Facebook ("Message host" / "Email host")                                                                                                 |

**Hero is always visible** (`STAY_GUIDE_REQUIRED_VISIBLE`). Chapters + check-in docs that have
no real content are dropped on a live (non-preview) page.

Chapter template HTML is filled with the same booking placeholders as workflow emails
(`buildBookingPlaceholderVars`). The Stay-Guide-only kinds (`passCard`, `checkInDocuments`,
`chapter`, `host`, `quickNav`) render via one shared, palette-skinned component
(`templates/shared/StayGuideSections.tsx#StayGuideTemplatedSection`) that every template's
`*Sections.tsx` delegates to; `hero` / `gallery` keep each template's bespoke renderer.

### Config (`StayGuideConfigV2`)

From **`public_page_configs`** (`page_type = stay_guide`). v1 rows (`version: 1`,
`chapters[]`) are upgraded on read (`normalizeStayGuideConfig` client + server) and by the
one-shot backfill `20261210120100_stay_guide_config_v2.sql`.

```ts
{
  version: 2;
  published: boolean;                    // token pages ignore it
  palette / typography / motion;         // identical to PropertyShowcaseConfig
  sections: { id; visible; order;
              copy?: { heading?; subheading? };
              imageSlots?;               // hero (1) + gallery (multi)
              heroEyebrow?;              // hero only
              accentColor? }[];          // chapter sections only
}
```

`templateKey` is one of the 6 `showcase-*` keys, stored in **`custom_pages`**
(`page_type = stay_guide`) — `resolveStayGuideTemplateKey` normalizes legacy
`stay-guide-warm-arrival` rows to `showcase-aurora`
(`20261210120300_stay_guide_template_keys.sql`).

## API

| Function                   | Method | Auth                                                 | Query                                                            |
| -------------------------- | ------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `get-guest-stay-guide`     | GET    | anon                                                 | `?token=` required; `?property=<slug>` optional                  |
| `preview-guest-stay-guide` | GET    | JWT + `templates:view`                               | `?property_id=` required; `?property=<slug>` optional slug guard |
| `public-page-configs`      | PATCH  | `publicPages.stayGuide:edit` + `publicPagesAutosave` | `{ pageType: 'stay_guide', config }` (v2)                        |
| `custom-pages-settings`    | PATCH  | `publicPages.stayGuide:edit` + `publicPagesAutosave` | `{ pageType: 'stay_guide', templateKey }` (a `showcase-*` key)   |

Both GET responses include **`sectionConfig`** (v2) and **`templateKey`**.

## Email / Admin

Unchanged: on **`READY_FOR_CHECKIN`** the orchestrator calls **`ensureGuestStayGuideToken`**
before **`sendReadyForCheckin`** (`{{stay_guide_cta_section}}` when token + slug resolve);
**WorkflowPanel** shows the **Stay guide** row with **Open** + copy from
`READY_FOR_CHECKIN` onward.

## Page Editor

**Public Pages → Stay Guide → Edit** — `page-editor/components/stay-guide/StayGuidePageEditor.tsx`

- `StayGuideEditorPanel.tsx` + `stores/stayGuideEditorStore.ts`, live preview via
  `previewOverrideContext` (`kind: 'stay-guide'`, the DTO carries the v2 config + templateKey).
  Mirrors `PropertyShowcasePageEditor`. Three autosave tracks:

1. **Config** → `public-page-configs` (`stay_guide`)
2. **Template key** → `custom-pages-settings` (`stay_guide`)
3. **Chapter content + section images** → `property-templates-settings` (same rows as Templates)

**Panel** (mirrors `PropertyShowcaseEditorPanel` 1:1 — only the section set + fields differ):

- **Template** — 3×2 grid of **live scaled mobile previews** (`StayGuideTemplatePicker` /
  `StayGuideTemplatePreviewThumb`, same pipeline as `ShowcaseTemplatePicker`: inert, motion
  toned down, `useDeferredValue`). Clicking a template scrolls the main preview to the hero.
- **Sections** — `SectionReorderList` (drag reorder + visibility; hero locked visible).
- **Style** — `PaletteControl` / `TypographyControl` / `MotionControl`, template-aware via
  `resolveShowcaseEditorStyleFields(templateKey)`; `useShowcaseMediaPalette` for "from photos".
- **Section details** — per-section accordion; copy fields prefill with the resolved default
  (clearing to the default stores no override). Hero: eyebrow + heading/sub + single photo.
  Gallery: heading/sub + multi photo. Pass / docs / host: heading/sub. Chapters: heading
  override + accent colour + nested `StayGuideSectionContentCard` rich-text editors per
  property-template key.

The preview shares `useShowcaseContainedChrome` / `useShowcaseConfigControlled` with Showcase
(both accept the `stay-guide` preview-override kind) so the template chrome stays inside the
editor frame and palette/motion follow the config live.

## Implementation map

| Layer           | Path                                                                                                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest page      | `ui/src/features/guest/stay-guide/pages/StayGuidePage.tsx` (resolves data → `mapStayGuideData` → registry)                                                                                                                                                           |
| Data mapper     | `ui/src/features/guest/stay-guide/lib/mapStayGuideData.ts`                                                                                                                                                                                                           |
| Config model    | `ui/src/features/guest/stay-guide/lib/stayGuideConfig.ts` (v2 types, normalize, v1→v2 upgrade)                                                                                                                                                                       |
| Template engine | `ui/src/features/guest/marketing/showcase/templates/*` + `registry.ts`; Stay-Guide section renderers in `templates/shared/StayGuideSections.tsx`; shell / style / motion in `showcase/components/*` + `showcase/lib/*`                                               |
| Shared types    | `ui/src/features/guest/marketing/showcase/types/showcase.ts` (`TemplateSectionKind`, `pageKind`, `ShowcaseStayGuideExtras`, `ShowcaseResolvedSection.blocks/bodyHtml/accentColor`)                                                                                   |
| Editor          | `ui/src/features/dashboard/page-editor/components/stay-guide/{StayGuidePageEditor,StayGuideEditorPanel,StayGuideTemplatePicker,StayGuideTemplatePreviewThumb}.tsx`, `stores/stayGuideEditorStore.ts`, `lib/{stayGuideChapterSections,stayGuideTemplateThumbData}.ts` |
| Hook            | `ui/src/features/guest/stay-guide/hooks/useGuestStayGuide.ts` (+ `previewApi.ts`)                                                                                                                                                                                    |
| Edge            | `get-guest-stay-guide/`, `preview-guest-stay-guide/`, `public-page-configs/`, `custom-pages-settings/`                                                                                                                                                               |
| Shared server   | `_shared/guestStayGuide.ts`, `_shared/publicPageConfigs.ts` (v2 + v1 upgrade), `_shared/customPages.ts`                                                                                                                                                              |
| Migrations      | `20261210120100_stay_guide_config_v2.sql`, `20261210120300_stay_guide_template_keys.sql` (+ token / custom_pages / public_page_configs base migrations)                                                                                                              |

---

## Testing

| Layer | Path / spec                                                                         | Manual                                     |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| Unit  | `ui/src/features/guest/lib/guestPublicPaths.test.ts` (stay-guide URLs)              | —                                          |
| E2E   | `ui/e2e/features/guest-form/stayGuideToken.spec.ts` (`@ci`, token 404 + happy mock) | `docs/guides/testing/stay-guide-manual.md` |
| N/A   | —                                                                                   | Editor preview canvas animations           |
