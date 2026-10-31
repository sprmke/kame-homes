---
title: 'Marketing Video — Quiet Coast Motion (from-scratch redesign)'
status: archived
tags: [superpowers, archive, marketing]
updated: 2026-08-02
---

# Marketing Video — Quiet Coast Motion (from-scratch redesign)

**Status:** Implemented (core) — verify in UI; hard-refresh / Reset if old autosave loads  
**Date:** 2026-08-01  
**Mode:** Operate (editor) + Persuade (exported social video)

## Problem

Marketing 3 left a single gallery skeleton (~5×3s clips, text mostly on first/last, one music default, heavy outlined type). Exports look dated; mid-clips are bare photos; templates feel identical. Exported sample `video-kame-home-promo-500-off.mp4` was ~13s, no audio track, Quiet Coast craft missing.

## Goals

1. **Video-only category system** (Design keeps its 4).
2. **~16 storyboard recipes** — distinct clip counts, durations, text rhythm, overlays, motion, music cues.
3. **Quiet Coast Motion** visual language — photo-led, refined type (no chunky strokes), soft scrims, outline CTAs, sparse accent.
4. **Storyboard + scene kit** — richer clip settings without a keyframe timeline.
5. **Clean break** — old preset ids leave the sidebar; legacy autosaves still openable.

## Non-goals (this pass)

- Full After Effects / per-layer keyframe timeline
- Remapping Design categories
- AI generation (Marketing 4)
- 24–30+ template quantity over quality

## Architecture (Approach 1)

Declarative **storyboard recipes** seed `VideoProject`s. One Remotion composition + Quiet Coast render kit draws all templates. Editor mutates the seeded project (duration, transition, motion, overlay, layers, music).

```
videoCategories.ts          → VideoCategory + labels
videoStoryboardRecipes.ts   → recipe per templateId
videoCampaignTemplates.ts   → catalog list + copy + palette flags
videoProjectDefaults.ts     → buildProjectFromRecipe(binding, format)
VideoCompositions.tsx       → render overlays / motion / transitions
videoLayerTypography.ts     → Quiet Coast type (Fraunces / Jost / Jakarta)
```

## Categories (Video-only)

| id              | Label         |
| --------------- | ------------- |
| `soft-stay`     | Soft stay     |
| `flash-deal`    | Flash deal    |
| `last-openings` | Last openings |
| `social-proof`  | Social proof  |
| `fully-booked`  | Fully booked  |
| `seasonal`      | Seasonal      |

`useMarketingCatalog('video')` uses these builtins; Design tab unchanged.

## Template set (~16)

| id               | Category      | Storyboard sketch                           |
| ---------------- | ------------- | ------------------------------------------- |
| `quiet-morning`  | soft-stay     | 4 clips · text on 1+3+4 · soft scrim · ~11s |
| `golden-hour`    | soft-stay     | 6×~2s · alternating text beats · ~12s       |
| `poolside-calm`  | soft-stay     | 3 long clips · cinematic · ~12s             |
| `weekday-cut`    | flash-deal    | 5 punchy · offer on clip 3 · ~12s           |
| `percent-off`    | flash-deal    | 4 clips · lower-band offer · ~11s           |
| `rainy-day-rate` | flash-deal    | 5 clips · hook+offer+cta · ~13s             |
| `one-left`       | last-openings | 4 clips · bare date hero · ~10s             |
| `three-dates`    | last-openings | 5 clips · compact date chips mid · ~13s     |
| `this-weekend`   | last-openings | 3 urgent clips · ~9s                        |
| `guest-love`     | social-proof  | 4 clips · quote mid · ~12s                  |
| `stay-again`     | social-proof  | 3 clips · soft CTA · ~10s                   |
| `sold-out-stamp` | fully-booked  | 2 minimal clips · fixed slate palette · ~7s |
| `join-waitlist`  | fully-booked  | 3 clips · waitlist CTA · ~10s               |
| `ber-months`     | seasonal      | 5 clips · seasonal copy · ~13s              |
| `holiday-glow`   | seasonal      | 4 clips · festive outline chrome · ~12s     |
| `amenity-tour`   | soft-stay     | 5 clips · amenity words on b-roll · ~12s    |

## Recipe model

Each recipe: `clips[]` with `{ role, label, durationSec, transition, overlay, textBeats, kind, motion? }`, plus palette flags, font pairing id, default music match (title/artist for Jamendo resolve).

**Overlay modes:** `none` | `soft-scrim` | `bottom-band` | `top-band`  
Stored on `VideoScene.overlay` (host-overridable in scene settings).

## Clip settings (v1)

Per clip: label, kind, duration (1–12s), transition, motion override, **overlay**, layers (text/CTA/slots/image/logo), reorder/add/remove.  
Project: format, music (server-cached Jamendo), template typography context.

## Visual rules (Quiet Coast Motion)

- Title: Fraunces / editorial serif — **no WebkitTextStroke**
- Labels: Jost tracked small-caps
- Body/CTA: Plus Jakarta Sans; CTA **outline** by default (filled only when recipe asks)
- Scrim: bottom-anchored accent wash (existing `sceneScrimStyle`), strength from overlay mode
- No ticket dashed borders, sunbursts, or fat filled badges on titles

## Migration

- New ids only in sidebar.
- Old autosaves with retired `templateId` still parse/render via fallback recipe (gallery soft-scrim) if opened from Custom/saved rows.
- Thumbnail cache key bump (`v8`).

## Export

Before `renderMediaOnWeb`, `ensureVideoMusicForExport` must leave a Storage URL (never Jamendo CDN). Stills mute audio.

## Success criteria

- Switching Soft stay → Flash deal → Last openings reads as **different films** when paused (clip count, text placement, overlay).
- Type matches Design Quiet Coast (no outlined brown serif titles).
- Download includes audio when music is configured.
- Design tab categories/templates untouched.
