---
title: 'Stay Guide — manual test script'
status: active
tags: [guides, testing, stay-guide]
updated: 2026-09-01
---

# Stay Guide — manual test script

Companion to [`stay-guide.md`](../routes/stay-guide.md) and [`public-pages.md`](../routes/org/property/public-pages.md).

## Preconditions

- Local stack (`./dev.sh`) or hosted dev with migrations applied (`stay_guide` config v2 + template keys).
- A property on **Pro+** (or entitled `publicPagesAutosave`) for editor save tests.
- A booking in **`READY_FOR_CHECKIN`** (or later in-stay status) with a valid `stay_guide_token`.
- User with `publicPages.stayGuide:edit` and `templates:edit`.

## Guest route (token)

1. Open `/properties/:slug/stay-guide?token=…` from the ready-for-checkin email or DB token.
2. Page title: `{Property Name} - Stay Guide`.
3. Hero primary CTA **Open the guide** scrolls to first visible chapter; secondary **Contact host** scrolls to `#host` (works in Page Editor preview via `ShowcaseSectionLink`).
4. Stay Pass shows guest name, dates, check-in/out times.
5. Check-in document chips appear when GAF/pet/parking docs are approved.
6. Chapters render rich HTML with readable contrast on light and dark template palettes (Haven sand regression).
7. Single-template chapters (e.g. Getting In) render without a redundant inner card frame.
8. `?embed=1` and `?preview=1&property_id=` show placeholders; unpublished config still previews in editor.

## Editor

1. **Public Pages → Stay Guide → Edit**.
2. Template picker: live scaled thumbs for all 6 templates; switching updates preview immediately.
3. Section reorder / hide; style controls (palette, typography, motion) affect preview live.
4. Chapter **Section details**: rich-text + section image autosave to property templates.
5. Leave with unsaved config → Save & leave / Discard dialog.
6. Save requires Pro (`publicPagesAutosave`); Free/Starter can explore but cannot persist.

## Templates regression

For each of Aurora, Monolith, Editorial, Verso, Atlas, Haven:

1. Token page renders all visible sections (hero, pass, docs, gallery, chapters, host).
2. Mobile 375px / tablet 768px — no horizontal overflow; header nav or hamburger lists chapters.
3. Showcase guest page for the same property unchanged (no Stay Guide sections leaking).

## Static checks (agent / CI)

```bash
bun run type-check && bun run lint && bun run check:filenames && bun run build
```
