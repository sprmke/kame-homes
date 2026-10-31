---
stage: done
title: 'Marketing Video — Quiet Coast Motion (from scratch)'
status: done
tags: [planning, planned-modules, marketing]
updated: 2026-08-01
---

# Marketing Video — Quiet Coast Motion (from scratch)

**Status:** Done  
**Spec:** `docs/archive/superpowers/specs/marketing-video-quiet-coast-motion-design.md`  
**Supersedes sidebar library from:** `marketing-video-templates.md` (Marketing 3 incremental pass)

## Summary

Recipe-driven storyboard library (16 templates, 6 Video-only categories), Quiet Coast Motion craft, per-clip overlay + duration/transition/motion, clean break from old preset ids.

## Implementation map

| Area             | Path                                                                                |
| ---------------- | ----------------------------------------------------------------------------------- |
| Categories       | `ui/.../lib/video/videoCategories.ts`                                               |
| Recipes          | `ui/.../lib/video/videoStoryboardRecipes.ts`                                        |
| Catalog + copy   | `ui/.../lib/videoCampaignTemplates.ts`                                              |
| Project seed     | `ui/.../lib/video/videoProjectDefaults.ts`                                          |
| Layouts          | `ui/.../lib/video/videoTemplateLayouts.ts`                                          |
| Motion           | `ui/.../lib/video/videoMotionProfiles.ts`                                           |
| Type / look      | `videoLayerTypography.ts`, `videoTemplateTypography.ts`                             |
| Catalog builtins | `ui/.../hooks/useMarketingCatalog.ts`                                               |
| Render overlays  | `ui/.../components/video-editor/VideoCompositions.tsx`                              |
| Scene overlay UI | `VideoSceneSettings.tsx`                                                            |
| Sanity check     | `bun scripts/dev/check-video-motion-profiles.mjs` (motion + recipe layout coverage) |

## Verify

1. Video sidebar shows Soft stay / Flash deal / Last openings / Social proof / Fully booked / Seasonal (not Design’s Promos).
2. Quiet morning vs Weekday cut vs One left — different clip counts & text rhythm when paused.
3. Amenity tour — amenity words centered on mid clips (not stuck at 50/50).
4. Titles use Fraunces/Jost without heavy stroke; outline CTAs by default.
5. Hard-refresh or **Reset** if an old autosave loads.
6. Download after music caches includes audio when possible.
7. `set -a && source ui/.env.development && set +a && bun scripts/dev/check-video-motion-profiles.mjs` — motion + layout + storyboard→layer seed.
