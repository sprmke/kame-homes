---
title: 'Property Showcase — Custom Animated Landing Pages'
status: done
tags: [workflow, done, public-pages, page-editor, showcase, marketing, guest]
updated: 2026-08-28
stage: done
kind: plan
---

# Property Showcase — Custom Animated Landing Pages

## Goal

Give every property a **shareable, standalone showcase landing page** that a host can copy‑paste and send
directly to a guest. Unlike the marketing listing detail page (`/properties/:propertySlug`,
`page_type = 'property_landing'`), the showcase is a single‑scroll, brand‑forward landing page with its own
navigation and footer, signature motion (parallax, animated canvas, scroll‑driven reveals), and **three
distinct, professionally‑designed templates** the host picks from. Every section, text block, image slot,
grid column and style token is editable inside an **extended Page Editor** that stays visually and
behaviourally consistent with the existing Stay Guide / Property Landing editors. All content still derives
from the property data we already store — the config layer only holds visibility, order, style and copy/image
overrides.

## Scope

### In

- New guest route `/properties/:propertySlug/showcase` (standalone — **not** inside `MarketingLayoutShell` or
  `GuestPublicLayout`), rendered by one of three template component trees.
- New `page_type = 'property_showcase'` for both `custom_pages` (`template_key` = chosen design) and
  `public_page_configs` (`PropertyShowcaseConfig` JSON: sections, per‑section style/copy/image overrides,
  global palette/type/motion, `published` flag).
- New public edge function `get-public-showcase` composing property detail + template + config in one payload.
- Three templates under `ui/src/features/guest/marketing/showcase/templates/` — each self‑contained with its
  own animated nav (scroll‑spy + smooth scroll to anchors), hero animation, section set, and footer.
- Shared showcase runtime: data mapper, motion primitives, `ShowcaseCanvas`, smooth‑scroll provider,
  reduced‑motion + `?embed=1` degradation, scroll‑spy hook.
- Deep‑link scroll: `/properties/:slug/showcase#amenities` scrolls to that section on load.
- Page Editor extension: template picker, section reorder + visibility (dnd‑kit), per‑section copy/image/column
  controls, global palette/typography/motion controls, `property-showcase` preview‑override kind, autosave
  wiring, plan gate + upgrade modal, new permission leaf, preview click‑to‑focus.
- Public Pages gallery integration: new **editable** card, last‑edited meta, scaled live iframe preview.
- New plan entitlement `propertyShowcase` (proposed Growth+); Starter/Free see a locked card + upgrade CTA.
- Full docs pass (PROJECT.md, route guides — new + updated, data‑model, edge‑functions, routing,
  plans‑feature‑matrix, pricing surfaces, manual test doc).

### Out

- Multi‑page templates (v1 = one scrolling page per design; anchors only, no nested routing).
- A generic drag‑and‑drop block CMS (Puck/GrapesJS/Craft.js) — see Approach for why we extend the current
  structured‑config editor instead. Puck is noted only as a rejected alternative.
- Host‑uploaded imagery beyond existing property media (image slots pick from `properties.settings.media`).
- Custom domains / white‑label hosting of the showcase URL.
- i18n / multi‑language showcase content.
- Editors for the other guest pages (calendar/form/SD/parking) — unchanged, still their own future phases.
- Parking showcase (property‑only for v1; parking parity is a follow‑up, tracked separately).

## Approach

### Why a new page type, not an extension of `property_landing`

`property_landing` **is** the marketing listing detail (`PropertyDetailPage.tsx`) — it carries `BookingCard`,
`SimilarProperties`, and lives inside the shared marketing nav/footer. The showcase is a different product
surface: standalone chrome, template‑swappable visual language, motion‑heavy, "send this link to a guest".
`custom_pages` was **designed** for exactly this ("a single `template_key` string for future full alternate
visual template selection" — `page-editor-public-pages.md`), and `public_page_configs` was built to widen its
`page_type` CHECK per new surface. So:

- `custom_pages` row `(property_id, 'property_showcase')` → `template_key ∈ { showcase-aurora, showcase-monolith, showcase-editorial }` (final names from Phase 0).
- `public_page_configs` row `(property_id, 'property_showcase')` → `PropertyShowcaseConfig` (deep customization).
- Content stays in `properties.settings.*` / `app_settings.*` — **no relocation**, mirroring the locked
  decision in the prior plan. Copy/image overrides that have no home elsewhere live inside
  `PropertyShowcaseConfig`.

### Why extend the current editor rather than adopt a page‑builder library

The prior plan locked the rendering model: _"keep the existing coded React components; the editor writes
structured JSON config that drives their props — not a generic block/CMS system."_ A block editor
(`@measured/puck`, GrapesJS, Craft.js) would (a) break preview parity with the real guest component,
(b) be inconsistent with the Stay Guide / Property Landing editors hosts already use, (c) require every
template's bespoke animation to be re‑expressed as generic blocks. Instead we **level up** the existing
structured editor: dnd‑kit reorder (already used for Stay Guide chapters + `PropertyMediaUpload`), a richer
shared control library, per‑element copy/image/column overrides, global style tokens, and
click‑element‑in‑preview → focus‑its‑control (extending the existing `data-page-editor-anchor` /
`PageEditorRevealTarget` mechanism to element granularity). Puck stays documented as the rejected option if
the product later wants a true freeform canvas.

### Live preview reuse

`PageEditorShell` (480px controls / live preview) + `PreviewOverrideProvider` already feed a merged preview
object into the actual guest page component. Add `kind: 'property-showcase'` carrying
`{ data: ResolvedPropertyDetail; showcaseConfig: PropertyShowcaseConfig; templateKey: string }`. The showcase
page reads `usePreviewOverride()` first (editor), otherwise fetches via `get-public-showcase`. Desktop/mobile
preview toggle and reveal‑scroll come for free from the shell.

### Motion & libraries (all MIT, tree‑shakeable, lazy‑loaded)

- **`framer-motion`** (already v12): `useScroll` / `useTransform` / `useSpring` parallax, stagger reveals,
  layout transitions, drag galleries.
- **`lenis`** (~3 kB) — smooth momentum scroll + programmatic `scrollTo(anchor)` for nav + deep links.
- **`embla-carousel-react`** (~5 kB) — drag testimonial / gallery carousels.
- **Hand‑rolled 2D `<canvas>`** (`ShowcaseCanvas`) for gradient‑mesh / particle‑field / film‑grain / noise
  backdrops. No three.js in v1 (weight); `@react-three/fiber` explicitly deferred.
- **Guardrails baked into the shared runtime**: honour `prefers-reduced-motion` (canvas + parallax fall back
  to static), `IntersectionObserver` to pause off‑screen canvases, `content-visibility: auto` on below‑fold
  sections, lazy‑mount heavy sections, and **`?embed=1` disables canvas + heaviest parallax** so the gallery
  iframe preview stays cheap.

### Design direction (Phase 0 firms this — anti‑generic per `DESIGN.md`, `frontend-design`, `high-end-visual-design`)

Study Behance / Dribbble / One Page Love hospitality + real‑estate landing pages. Three deliberately
different visual languages, none reading as "AI default" (no purple‑indigo gradients, no terracotta‑on‑cream,
no neon glow stacks — `DESIGN.md §2/§6`):

| Template | Working name                              | Language                                                                                             | Signature motion                                                                                                   |
| -------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A        | **Aurora** — cinematic parallax           | Full‑bleed imagery, layered depth, large tracking‑tight editorial sans, sticky section‑progress rail | Multi‑layer parallax hero over an animated gradient‑mesh canvas; horizontal‑scroll gallery; magnetic buttons       |
| B        | **Monolith** — brutalist‑lux              | High contrast, oversized type, visible grid lines, noise texture, dark‑mode default                  | Scroll‑pinned sections with scroll‑driven reveal; amenity marquee ticker; cursor‑follow spotlight; number counters |
| C        | **Editorial** — warm hospitality magazine | Serif display + generous whitespace, asymmetric image collage, muted film‑grain                      | Soft scroll‑fade + stagger; drag testimonial carousel; animated map pin; "chapters" nav                            |

Each template supplies its **own** `<ShowcaseNav>` and `<ShowcaseFooter>`; shared section components accept a
`variant`/render‑prop so a template controls layout while reusing data plumbing. Google Fonts is the only
permitted external asset host (per Artifact/CSP norms and repo font setup) — display faces loaded there with
real fallback stacks; body stays Plus Jakarta Sans unless a template's direction needs otherwise.

### Publish semantics

`PropertyShowcaseConfig.published` (default `false`). Unpublished → guest URL returns a lightweight
"not available" state (200, no property data leak); host preview (`?embed=1` or editor) always renders. Gallery
card shows a Published / Draft chip and a publish toggle.

## Implementation tasks

> Ordered. Each phase is shippable. File paths are precise; `<ts>` = migration timestamp.

### Phase 0 — Design & technical spike (no production code)

- [x] Invoke `frontend-design` + `high-end-visual-design` skills; re‑read root `DESIGN.md`.
- [x] Collect 15–20 references into
      [`assets/property-showcase-moodboard.md`](./assets/property-showcase-moodboard.md).
- [x] Lock the three template directions — [`property-showcase-templates-brief.md`](./property-showcase-templates-brief.md).
- [x] Spike approach locked in brief (mesh canvas + Lenis/framer; implement in shared runtime Phase 2).
- [x] Deps confirmed via Phase 0 lock: `lenis` + `embla-carousel-react`, lazy per showcase route.
- [x] Perf/a11y budget defined in templates brief.
- [x] **Open questions locked** (see Decisions table in templates brief + Open questions § below).

### Phase 1 — Data & edge foundation

- [x] Migrations for `property_showcase` page type + `propertyShowcase` entitlement
- [x] `publicPageConfigs` / `customPages` shared types + normalize
- [x] `get-public-showcase` + `config.toml`
- [x] `public-page-configs` / `custom-pages-settings` extended
- [x] Plan + permission leaves mirrored on UI
- [x] UI types under `showcase/types/showcase.ts`

### Phase 2 — Shared showcase runtime

- [x] Feature scaffold + mapper + hooks + smooth scroll + canvas + section shells + shell

### Phase 3–5 — Templates

- [x] Aurora / Monolith / Editorial via shared shell variants + lazy registry

### Phase 6 — Guest route

- [x] `/properties/:propertySlug/showcase` standalone route, deep-link, embed, title/favicon

### Phase 7 — Page Editor (template + sections)

- [x] Template picker, publish, section visibility, preview override, plan gate

### Phase 8 — Advanced element / style controls

- [x] Shared CopyOverride / ImageSlot / Palette / Typography / Motion controls
- [x] Click-to-focus preview (section anchors); full undo/redo history store

### Phase 9 — Public Pages gallery

- [x] Showcase gallery card + last-edited + live preview height
- [x] Explicit Published/Draft chip + locked Free/Starter upgrade card polish

### Phase 10 — QA, docs

- [x] Route guide `property-showcase.md` (initial)
- [x] Full docs matrix + manual test script + a11y/perf budget (Lighthouse optional smoke in manual doc)
- [x] `/workflow-done` when Phase 8–10 closed

## Docs to update

| Doc                                                                                                                     | Change                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PROJECT.md`                                                                                                       | New public route `/properties/:propertySlug/showcase`; `page_type = 'property_showcase'` on `custom_pages` + `public_page_configs`; `get-public-showcase` edge fn; `propertyShowcase` entitlement; env vars none new.                                                      |
| `docs/guides/routes/property-showcase.md` **(new)**                                                                     | Guest‑facing route guide — invoke `route-guides` skill. Purpose, three templates, per‑section behaviour, publish semantics, deep‑link anchors, embed mode, Host‑facing knowledge + common questions. Register in `docs/guides/routes/README.md`.                           |
| `docs/guides/routes/org/property/public-pages.md`                                                                       | New **Showcase** editable card in "Design your pages"; template picker; advanced section/style/copy/image controls; Publish toggle; permission leaf `publicPages.showcase:edit`; plan gate `propertyShowcase`. Update Progress overview + Implementation map + API tables. |
| `docs/guides/routes/org/property/custom-pages.md`                                                                       | Note `custom_pages.page_type` now includes `property_showcase` with a real `template_key` picker (first true multi‑template use).                                                                                                                                          |
| `docs/architecture/data-model.md`                                                                                       | Widened CHECKs; `PropertyShowcaseConfig` shape; where showcase content resolves from (no relocation).                                                                                                                                                                      |
| `docs/architecture/edge-functions.md`                                                                                   | `get-public-showcase` (public, `verify_jwt=false`); `public-page-configs` / `custom-pages-settings` extended for the new page type.                                                                                                                                        |
| `docs/architecture/routing.md`                                                                                          | New standalone guest route (outside marketing + operational layouts).                                                                                                                                                                                                      |
| `docs/architecture/plans-feature-matrix.md`                                                                             | New `propertyShowcase` row + which tiers; note editor PATCH still gated by `publicPagesAutosave`, publish/template‑select additionally gated by `propertyShowcase`.                                                                                                        |
| `/for-hosts/pricing` + `docs/architecture/plans-feature-matrix.md` + `docs/guides/routes/org/plans.md` + `for-hosts.md` | Surface the new entitlement in `planPresentation.ts` `PLAN_FEATURE_ROWS` + tier card gains + host Plans guides.                                                                                                                                                            |
| `.cursor/rules/`                                                                                                        | No canonical rule owns this; if the new permission leaf needs documenting, add a line to the team‑permissions reference the route guide points at. `booking-workflow.mdc` / `admin-auth.mdc` untouched.                                                                    |
| `docs/guides/testing/property-showcase-manual.md` **(new)**                                                             | Manual test script (three templates, editor flows, publish, deep links, embed preview, reduced‑motion). Link from `public-pages.md`.                                                                                                                                       |
| `docs/archive/reference/project-structure.md`                                                                           | Add `features/guest/marketing/showcase/` module map + `page-editor/components/shared/`.                                                                                                                                                                                    |
| `docs/workflow/in-progress/README.md`                                                                                   | Index row added on `/workflow-start` (this session).                                                                                                                                                                                                                       |

## Open questions

**Locked 2026-08-28 (Phase 0 — proceeding with plan proposals):**

1. **Plan tier** — **Growth+** new entitlement `propertyShowcase`.
2. **Permission** — new leaf **`publicPages.showcase:edit`**.
3. **Deps** — add **`lenis`** + **`embla-carousel-react`** (lazy).
4. **Templates** — **3** firm: Aurora / Monolith / Editorial.
5. **Publish default** — **Draft** (`published: false`).
6. **Parking** — property-only v1; parking showcase later.
7. **Images** — existing property media only.
