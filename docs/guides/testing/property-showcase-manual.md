---
title: 'Property Showcase — manual test script'
status: active
tags: [guides, testing, showcase]
updated: 2026-08-28
---

# Property Showcase — manual test script

Companion to [`property-showcase.md`](../routes/property-showcase.md) and [`public-pages.md`](../routes/org/property/public-pages.md).

## Preconditions

- Local or hosted-dev stack with migrations applied (`property_showcase` page type + `propertyShowcase` entitlement).
- A Growth+ property (or temporarily entitle `propertyShowcase` on the plan under test).
- A Free or Starter property for the locked-card check.
- User with `publicPages.showcase:edit`.

## Gallery

1. Open `/org/.../property/.../public-pages`.
2. **Design your pages** includes **Showcase**.
3. Growth+: chip shows **Draft** or **Published**; **Edit** opens the editor.
4. Free/Starter: **Upgrade** instead of Edit; opens upgrade modal for Showcase.
5. Live iframe preview loads (`?embed=1`); last-edited line updates after a save.

## Editor — templates & publish

1. Open Showcase editor.
2. Switch Aurora → Monolith → Editorial; live preview swaps template.
3. Toggle **Publish** off → guest URL (no embed) shows Not available.
4. Toggle **Publish** on → guest URL renders the page.
5. Leave with unsaved edits → Save & leave / Discard dialog works.

## Editor — sections & style

1. Reorder sections (drag); preview order updates.
2. Hide a section; it disappears from preview and guest nav.
3. Edit copy override / image slot / columns; preview updates.
4. Change palette, display font, type scale, motion intensity, parallax, canvas.
5. Undo / redo restores prior snapshots.
6. Focus a section control → preview scrolls to that section (`data-page-editor-anchor`).

## Guest route

1. `/properties/:slug/showcase` — standalone chrome (no marketing nav); page scrolls (mouse + touch).
2. Header shows property logo when set; mobile hamburger opens section list.
3. Gallery thumbnails open GalleryLightbox; prev/next + close work.
4. `#amenities` (or other section id) scrolls to that section on load.
5. `?embed=1` works when unpublished; canvas degraded.
6. `prefers-reduced-motion: reduce` — no heavy parallax/canvas animation.
7. Title / favicon follow property branding conventions.

## Permissions & plans

1. User without `publicPages.showcase:edit` — no Edit CTA / editor redirect.
2. Starter entitled for public pages but not Showcase — locked Upgrade card.
3. Server rejects showcase publish/template PATCH without `propertyShowcase`.

## Perf smoke (optional)

1. Lighthouse mobile on published Aurora with embed off — note LCP / TBT.
2. Confirm gallery iframe remains responsive (embed degradation).
