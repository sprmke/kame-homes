---
stage: done
title: 'Custom Pages Module (v1: Stay Guide redesign) — Implementation Plan'
status: done
tags: [planning, planned-modules]
updated: 2026-08-15
---

# Custom Pages Module (v1: Stay Guide redesign) — Implementation Plan

## Shipped

**Manual testing:** [`docs/guides/testing/custom-pages-module-manual.md`](../../guides/testing/custom-pages-module-manual.md)

| Area                           | Feature                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data layer**                 | `custom_pages` table (`property_id`, `page_type`, `template_key`), unique per `(property_id, page_type)`; rows lazily created on first read, no backfill                             |
| **Backend**                    | `_shared/customPages.ts` (`getOrCreateCustomPage`, `resolveStayGuideTemplateKey`); `custom-pages-settings` GET edge function (`templates:view`)                                      |
| **Plumbing**                   | `template_key` threaded through `get-guest-stay-guide` + `preview-guest-stay-guide` response payloads (passthrough in v1)                                                            |
| **Dashboard module**           | New `/org/:orgSlug/property/:propertySlug/custom-pages` route + page + `Stay Guide` card + **Preview** action; nav entry between Templates and Settings                              |
| **Permissions**                | New `custom-pages` `PropertySection` gated by existing `templates:view` (no new permission literal)                                                                                  |
| **Guest redesign — hero**      | Full-bleed static hero photo, bottom gradient scrim, `Fraunces` title overlay, one-time scale-settle + fade-up motion                                                                |
| **Guest redesign — stay pass** | `StayPassCard.tsx` — boarding-pass-styled summary (guest, property, check-in/out date + time) overlapping the hero's bottom edge                                                     |
| **Guest redesign — chapters**  | `StayGuideChapter.tsx` + `lib/stayGuideChapters.ts` — sections regrouped into "Getting In" / "Make Yourself at Home" / "Before You Go", Sand-surfaced cards, scroll-reveal on enter  |
| **Guest redesign — quick-nav** | `StayGuideTabs.tsx` rebuilt as a sticky pill bar, `IntersectionObserver` scrollspy, jump-to-anchor (replaces the old tabbed single-section view)                                     |
| **Guest redesign — gallery**   | `StayGuideGalleryCarousel.tsx` rebuilt as an editorial horizontal scroll-snap film strip (was a full-bleed swipeable hero carousel)                                                  |
| **Guest redesign — footer**    | `StayGuideHelpSection.tsx` restyled to match the warm palette; now a quick-nav target (`id="need-anything"`)                                                                         |
| **Theming**                    | Page-scoped warm-neutral palette (Paper/Ink/Sand/Umber) with light **and** dark variants; brand teal kept as the single interactive accent; `Fraunces` added to `tailwind.config.js` |
| **Preview parity**             | `preview-guest-stay-guide` renders the identical template — hosts see exactly what guests see                                                                                        |
| **Accessibility/motion**       | All entrance/scroll animation gated behind `useReducedMotion` (`framer-motion`)                                                                                                      |

**Not shipped (deferred, per plan scope):** template picker / multiple templates, showcase/pre-booking pages, drag-and-drop editor, `PATCH` on `custom-pages-settings` (no second template to switch to yet).

## Context

`docs/planning/CLAUDE_TO_PLAN.md` records two related backlog ideas: "Improve stay guide UI/UX" (Option A) and "Templated configurable & shareable custom pages" (Option B — a new dashboard module where hosts pick from templated, shareable pages built from property/booking data). The user wants both folded into one effort: a new **Custom Pages** module, general enough to support multiple page types over time (stay guides today, showcase/marketing pages later), but shipped end-to-end for a **single template first** to prove the pipeline before investing in more designs or a page editor.

Research this session found a working foundation already in place: a token-gated stay guide exists today (`ui/src/features/guest/stay-guide/`), tied to a specific booking, pulling property media and four "standard" content sections from `property_template_contents` — it is functionally complete but visually plain (flagged directly in the backlog note). Nothing today lets a host choose _how_ that page looks. This plan adds that missing layer: a `custom_pages` table + a new "Custom Pages" dashboard module for template selection, and a full visual redesign of the stay guide as the first template — reusing all existing content/token/media plumbing rather than rebuilding it.

## Decisions made during brainstorming (do not re-litigate during implementation)

1. **Scope**: v1 = infrastructure (table + dashboard module) + exactly **one** template, which upgrades the existing stay guide. No template picker with multiple options, no showcase/pre-booking pages, no drag-and-drop editor yet — all deferred to follow-up specs.
2. **Relationship to existing stay guide**: this is a **full replace**, not a parallel feature. Same route, same token mechanism, same content source — only the rendering changes. No feature flag/toggle needed since there is only one template.
3. **Nav placement**: property-level module (alongside Templates, Inbox, Finance, etc.) at `/org/:orgSlug/property/:propertySlug/custom-pages`, not org-level. Data model supports multiple pages per property long-term, but v1 constrains to one active `stay_guide` config per property via a unique constraint.
4. **Data model**: new dedicated `custom_pages` table (not `properties.settings` JSONB, not shoehorned into `property_template_contents`) — matches this repo's existing pattern of small dedicated tables per feature, and is the only option that cleanly supports future showcase pages with their own share tokens without overloading an existing table's purpose.
5. **Content editing stays separate**: the Custom Pages module is template/visual selection only. Section text (check-in instructions, house rules, etc.) is still edited on the existing Property Templates page (`TemplatesPage.tsx`) — no duplicate editor.
6. **Sharing mechanism unchanged**: reuses the existing opaque `stay_guide_token` and `/properties/:slug/stay-guide?token=...` URL issued at `READY_FOR_CHECKIN`. Custom Pages configures _how_ that link renders, not a new link.
7. **"Refine Property Templates page" (tabs for standard/email/other + custom template add)** — explicitly a separate, unrelated backlog item. Not touched by this plan.
8. **Visual direction** (via `frontend-design` + `competitive-ux-research` skills) is locked in: warm-neutral palette anchored on the existing brand teal accent, Fraunces display type (already loaded, zero new cost) + existing Plus Jakarta Sans body, and a "stay pass" boarding-pass-styled booking summary as the signature element.

## Current state (verified this session)

- **Guest-facing stay guide**: `ui/src/features/guest/stay-guide/pages/StayGuidePage.tsx` + `components/StayGuideHero.tsx`, `StayGuideTabs.tsx`, `StayGuideSection.tsx`, `StayGuideCheckInLocation.tsx`, `StayGuideGalleryCarousel.tsx`, `StayGuideHelpSection.tsx`; hook `hooks/useGuestStayGuide.ts`; client `lib/api.ts` / `lib/previewApi.ts`. URL: `/properties/:propertySlug/stay-guide?token=<opaque>` (guest) or `?preview=1&property_id=<uuid>` (admin, JWT-gated) via `guestStayGuidePath()`/`guestStayGuidePreviewPath()` in `ui/src/features/guest/lib/guestPublicPaths.ts:107-119`.
- **Token gating**: `stay_guide_token` on `guest_submissions`, issued at `READY_FOR_CHECKIN` by `ensureGuestStayGuideToken()` (`supabase/functions/_shared/guestStayGuide.ts:101-142`), valid Manila check-in-day-00:00 through end-of-day-after-checkout. Edge functions: `get-guest-stay-guide`, `preview-guest-stay-guide`, `issue-guest-stay-guide-token`.
- **Content source**: `property_template_contents` (`property_id`, `template_key`, `category`, `name`, `content`, `section_image_url`) — four standard keys (`check-in-instructions`, `house-rules`, `parking-reminders` (conditional), `check-out-instructions`), falling back to server defaults in `supabase/functions/_shared/propertyTemplates.ts` when no row exists. Managed today via `ui/src/features/dashboard/bookings/pages/TemplatesPage.tsx` (route `/org/:orgSlug/property/:propertySlug/templates`).
- **Property media**: bucket `property-media`, appended into `properties.settings.media` JSON array; hook `ui/src/features/dashboard/org/hooks/useUploadPropertyMedia.ts`, components under `ui/src/features/dashboard/org/components/property-settings/`.
- **Brand tokens** (`ui/tailwind.config.js`, `ui/src/index.css`): body font is `Plus Jakarta Sans`; brand accent is `--primary: 168 65% 40%` (teal), referenced via `hsl(var(--primary))`. `ui/index.html` already loads `Fraunces`, `Playfair Display`, `Cormorant Garamond`, `Lora` (for Marketing Studio's font picker) — **Fraunces is available for the new hero/heading type with zero new font-loading cost.**
- **Competitive UX research** (Touch Stay, Duve, industry guidance): the recurring, actionable finding is that guests want practical info (how to get in, wifi, house rules, emergency contact) surfaced first and in modular, scannable blocks — not buried under narrative/marketing content. This directly informed the "stay pass" signature element (surfaces booking dates/access immediately) and the chaptered section layout (below).

## Architecture

### 1. Data layer — new `custom_pages` table

New migration `supabase/migrations/<timestamp>_custom_pages.sql`:

```sql
create table custom_pages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  page_type text not null check (page_type in ('stay_guide')),
  template_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, page_type)
);
```

- No `theme` or `label` column — nothing reads/writes them in v1 (YAGNI trim from the brainstormed design).
- No backfill migration/script: rows are **lazily created on first read** (mirrors `property_template_contents`'s existing default-fallback pattern) — if a property has no `custom_pages` row for `stay_guide`, the read path creates one with `template_key = 'stay-guide-warm-arrival'` (the only v1 value).
- `page_type`'s `CHECK` constraint is widened by a **new** migration (never edit a shipped one) when showcase mode ships later — same convention as the booking-status enum.

### 2. Backend

- **New shared helper** `supabase/functions/_shared/customPages.ts`: `getOrCreateCustomPage(propertyId, pageType)` — lazy get-or-create described above; `resolveStayGuideTemplateKey(propertyId)` thin wrapper used by the render path.
- **New edge function** `supabase/functions/custom-pages-settings/index.ts` (`serveAdmin`, property-scoped via `propertyScope.ts#verifyPropertyAccess`): `GET` returns the property's current `custom_pages` row(s) (v1: just the one `stay_guide` row) for the dashboard module; no `PUT`/update needed yet since there's only one `template_key` value to select — the endpoint exists so the dashboard module has real data to render rather than being hardcoded, and so adding a second template later is additive (a `PATCH` to change `template_key`), not a rebuild.
- **Existing functions extended**: `get-guest-stay-guide/index.ts` and `preview-guest-stay-guide/index.ts` call `getOrCreateCustomPage()` and include `template_key` in their response payload (unused by v1's single-template frontend beyond a passthrough, but wires the plumbing end to end).
- Register `custom-pages-settings` in `supabase/config.toml` with the standard admin JWT policy, following the `property-templates-settings` entry as a template.

### 3. Frontend — dashboard module

- **New route** `/org/:orgSlug/property/:propertySlug/custom-pages` under `ui/src/features/dashboard/property/` (new module folder `custom-pages/` — this is genuinely new domain UI, not a `bookings/` add-on, per this repo's module-layout convention).
  - `pages/CustomPagesPage.tsx` — page shell + nav registration (mirror how `templates` is registered in the property sidebar nav config).
  - `hooks/useCustomPages.ts` — TanStack Query hook against `custom-pages-settings`, following `usePropertyTemplates.ts`'s shape.
  - `components/CustomPageCard.tsx` — one card per page type; v1 renders exactly one ("Stay Guide") with a static preview thumbnail image, a **Preview** button (`window.open`s the existing `guestStayGuidePreviewPath()`), and one line of copy explaining guests get their personalized link automatically at check-in (no "copy link" button — there is no single static link, it's per-booking).
  - Card grid container is a plain responsive grid (no empty "coming soon" placeholder cards — ship exactly what exists).
- **Nav registration**: add "Custom Pages" to the property sidebar/menu config alongside the existing Templates entry (find the shared property nav config file used by `templates` today and add a sibling entry).

### 4. Frontend — guest-facing template redesign

Rebuild `StayGuidePage.tsx` and its child components in place (same route, same data hook `useGuestStayGuide.ts`, same underlying API response — this is a visual rebuild, not a data/API change beyond the `template_key` passthrough above).

**Design tokens** (page-scoped, not global theme changes):

- Colors: Paper `#F7F2E8` (base bg), Ink `#221F1A` (text), Sand `#ECE3D2` (section surfaces), Umber `#8A7A62` (muted captions/dividers), plus existing `hsl(var(--primary))` teal as the single interactive accent (buttons, active nav pill, links) — keeps brand continuity, avoids introducing a second competing accent color.
- Type: `Fraunces` (already loaded) for the hero property name + chapter headings (`StayGuideHero.tsx`, section heading components); existing `Plus Jakarta Sans` for all body/instructional copy.
- Layout: full-bleed hero photo (from `properties.settings.media`) with a bottom gradient scrim + serif title overlay; all content capped to a centered ~640–720px column (including on desktop) so the page reads as a considered "digital pamphlet," not a stretched dashboard page.
- **Signature element — the "stay pass" card**: a new component, e.g. `StayPassCard.tsx`, replacing/absorbing the current plain guest-name/dates display in `StayGuideHero.tsx`. Boarding-pass-styled summary (guest name, check-in date/time, check-out date/time, property name, a CSS `clip-path`/mask die-cut notch detail), positioned to overlap the hero's bottom edge (`translate-y` partial overlap). This is the "wow factor" element, and it is also the most useful one — it puts the guest's practical booking facts front and center, per the competitive-research finding.
- **Chapters**: rename/restyle the existing four sections into a chaptered layout — "Getting In" (check-in-instructions), "Make Yourself at Home" (house-rules + parking-reminders when applicable), "Before You Go" (check-out-instructions), "Need Anything?" (existing `StayGuideHelpSection.tsx`, host contact). Each chapter: eyebrow label (small-caps, teal) + Fraunces heading + Sand-surfaced body with a hairline top rule (no heavy box-shadow/border).
- **Quick-nav**: restyle `StayGuideTabs.tsx` into a sticky pill bar under the hero (same jump-to-section interaction, new visual treatment).
- **Gallery**: restyle `StayGuideGalleryCarousel.tsx` — an editorial horizontal film-strip rather than a generic full-width carousel, placed after the hero/pass rather than dominating the top of the page.
- **Motion**: one orchestrated hero-load sequence (image scale-settle + stay-pass slide-up), then a quiet scroll-reveal per chapter on enter (`IntersectionObserver`, small stagger). Respect `prefers-reduced-motion` (existing app convention — check how other animated pages in this repo gate motion, e.g. the marketing/for-hosts work, and follow the same pattern).
- **Preview route** (`preview-guest-stay-guide` + its consuming page) gets the identical visual treatment — hosts must see exactly what guests see.
- Mobile-first: this page is opened on a phone far more often than desktop; the centered-column layout described above is intentionally the _same_ layout at every breakpoint, not a separate desktop treatment.

### 5. Rollout

Full replace, no feature flag. Ship as the new default render for `StayGuidePage.tsx` and the preview page in one PR/deploy — v1 has exactly one template so there is no meaningful old/new toggle to offer.

### 6. Docs to update (per `documentation-maintenance.mdc` / CLAUDE.md's "docs are the source of truth")

- `docs/guides/routes/stay-guide.md` — update to describe the new visual structure, the `custom_pages` table, and the lazy-create pattern.
- New `docs/guides/routes/org/property/custom-pages.md` — new route guide for the dashboard module (follow the existing `templates.md` doc's structure).
- `docs/PROJECT.md` — add `custom_pages` table to the data model section and the new route to the route table.
- `docs/workflow/planned/README.md` — add index row for this plan.

## Verification

- **Type-check/lint/build**: `bun run type-check`, `bun run lint`, `bun run build` (no test suite exists in this repo yet).
- **Local Supabase**: `bun run start:supabase`, apply the new migration, confirm `custom_pages` table exists via `mcp__supabase__list_tables` (local) or `supabase db diff`.
- **Edge function**: `bun run dev:api`, curl `custom-pages-settings` for a seeded property, confirm lazy-create returns a row with `template_key = 'stay-guide-warm-arrival'` on first call and the same row (not a duplicate) on a second call.
- **Dashboard module (Playwright/manual)**: navigate to `/org/:orgSlug/property/:propertySlug/custom-pages`, confirm the "Stay Guide" card renders, **Preview** opens the redesigned guest page via the existing preview route.
- **Guest flow (Playwright/manual)**: drive a booking to `READY_FOR_CHECKIN` locally (or reuse an existing seeded booking with a valid token), open `/properties/:slug/stay-guide?token=...`, confirm: hero renders with correct property photo, stay-pass card shows correct guest name/dates, all four chapters render with real content from `property_template_contents`, quick-nav jump-scrolls correctly, motion respects reduced-motion, and the page is usable at 375/768/1024px+ per the `mobile-responsive` skill.
- **Regression check**: confirm the existing token validity window (Manila check-in-day through end-of-day-after-checkout) and admin-preview JWT gating still function unchanged — this plan should not touch `ensureGuestStayGuideToken()`'s logic, only its consumers' rendering.
