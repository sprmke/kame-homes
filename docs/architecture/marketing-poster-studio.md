---
title: 'Marketing Poster Studio (AI Post)'
status: active
tags: [architecture, marketing, ai, polotno]
updated: 2026-09-28
---

# Marketing Poster Studio (AI Post)

Finished, editable social posts made from a property's **real photos**. The Generate tab opens on **AI Post** (plan: [`docs/workflow/in-progress/marketing-ai-poster-studio.md`](../workflow/in-progress/marketing-ai-poster-studio.md)).

## Why this shape

Benchmark posts from real PH staycation pages are designed posters: a real photo of the unit plus layered type, badges, amenity icons, an info bar and brand marks. An image model asked to "make a poster" invents rooms that do not exist and misspells text. So the AI never draws the poster:

- **AI = art director.** It sees the photos, reads the facts, and returns short JSON specs (layout, type system, palette, copy, photo order, amenities).
- **Code = layout engine.** A deterministic compiler turns each spec into an ordinary editable Polotno document. Text, icons and shapes are vectors.
- **Facts are printed, never generated.** Times, deposit, location and amenities come from property settings.

## Flow

```
AiPostPanel (goal · format · optional message)
  → buildPosterFacts(publicProperty)              lib/poster/posterFacts.ts
  → useGeneratePosters                            hooks/useGeneratePosters.ts
      POST generate-marketing-template {contentType:'poster', goal, prompt, facts, photoUrls}
        → allow-list photos against settings.media / settings.images (no arbitrary fetch)
        → Gemini (feature marketing_template) sees photos + facts → N specs
        → groundPosterFeatures (no invented amenities) · stripBannedCopy
      fallback on non-quota errors: buildRuleBasedPosterSpecs (lib/poster/posterDefaults.ts)
  → normalizePosterSpec                           lib/poster/posterSpec.ts
  → compilePosterDocument(spec, facts, format)    lib/poster/posterCompiler.ts
  → auditPosterDocument (sort worst last)         lib/poster/posterAudit.ts
  → renderPosterDocument (offscreen Workspace)    lib/poster/posterRender.ts
       + fitPosterTextSlots (real Konva metrics)  lib/polotno/fitPosterTextSlots.ts
  → Edit: saveMarketingTemplate (category "AI posts") → Design tab opens it (openTemplateId)
```

## Design system (`ui/src/features/dashboard/marketing/lib/poster/`)

| File                  | Role                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `posterArchetypes.ts` | Six hand-designed layouts, one per benchmark post: `wave-duo`, `sky-headline`, `night-glass`, `minimal-title`, `magazine-cover`, `feature-sticker`. Each adapts to Portrait (4:5, the AI Post default), Square (1:1), Story (9:16) and Facebook (1.91:1). |
| `posterFonts.ts`      | Eight curated type systems (display · script · tracked eyebrow · body · chip). Weights 400/700 only.                                                                                                                                                      |
| `posterModules.ts`    | Building blocks: fitted text slots, pills, icon rows, info bar, glass panel, sticker badge, organic photo masks, burst ornament, logo.                                                                                                                    |
| `posterIcons.ts`      | One line-icon family (Lucide paths) + amenity keyword → icon + curated short labels ("Coffee Maker" → "Coffee").                                                                                                                                          |
| `posterColor.ts`      | Palette derived from 1–3 hexes with WCAG guarantees (field ink ≥ 7:1, accent ≥ 3:1 on field).                                                                                                                                                             |
| `posterText.ts`       | Fit-to-box with balanced line breaks. Uses a real canvas measurer once `posterFontLoader.ts` has loaded the fonts; width estimates otherwise (tests).                                                                                                     |
| `posterAudit.ts`      | Layout QA: out of bounds, text overlap, text below the legibility floor, overflow, empty text.                                                                                                                                                            |

**Layout rules the compiler enforces:**

- A legibility floor of about 21px on a 1080 canvas.
- Optional slots drop instead of overflowing.
- Copy slightly over budget is kept whole (the fitter sizes it down); far over budget is dropped, never cut mid-phrase.
- Scrims are sized to the real text stack, so they hold behind the text and then fade.
- Story keeps the bottom 10% clear for the reply bar.
- Fact modules (icons, info bar) outrank supporting sentences when space runs out.

## Server (`supabase/functions/_shared/marketingPosterDirector.ts`)

- Reuses feature `marketing_template` (quota, kill switch, credits, plan gate `aiMarketingGeneration`, permission `marketing.generate:add`, rate limit 15/h). Prompt id `marketing_template_poster`.
- `directPosterSpecs(input, billing)` is the model call; `generatePosterSpecs` adds the quota check.
- Photo fetch: https only, must be one of the property's stored media URLs, ≤ 4 MB, jpeg/png/webp, 6s timeout, ≤ 6 photos.

## Formats

`instagram-portrait` (1080×1350) is a real `DesignTemplateFormat`, so AI posts open and save in the Design editor. The hand-built preset library is only tuned for 1:1, 9:16 and 1.91:1 (`DESIGN_PRESET_FORMATS`). The editor's size picker therefore lists 4:5 only while a 4:5 design is open, until those presets have been reviewed for it.

## Plan default

The Generate tab opens on **AI Post** when `aiMarketingGeneration` is on (Business+), and on **Photo** otherwise. AI Post stays visible with its tier badge.

## Robustness

- **Run tokens:** Generate, a format switch and Shuffle each start a new run, and renders from an older run are dropped. A slow render never overwrites newer posters.
- **Format read at compile time:** results compile for the format selected when they arrive, not when the request left.
- **Remount per property:** the panel remounts when the property changes, so posters (and their Edit target) never cross properties.
- **Response shape:** the director response is shape-checked; malformed, empty, failed or network-error responses fall back to rule-based posters. Quota errors (`AiQuotaExceededClientError`) are rethrown to the upgrade/quota UI instead of being papered over with free layouts.
- **Photo budget:** photos sent to Gemini share a 12 MB raw budget (base64 inflates by 4/3 against the ~20 MB inline limit).
- **Fonts:** the canvas measurer uses real fonts once loaded and falls back to width estimates while they load (or if Google Fonts is unreachable). `fitPosterTextSlots` is the last-resort correction after render.
- **Throttled tabs:** frame waits race a short timeout, because background tabs pause `requestAnimationFrame`.

## Activity log

`activity-log: N/A for generation`. Specs are returned, nothing is persisted. **Edit** saves through `marketing-templates`, which records the write with `logAssetActivity`.

## Tests

| Suite                                                         | Covers                                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/poster/posterCompiler.test.ts`                           | Every archetype × 4 formats × rich/sparse facts passes the audit; fact strings print verbatim; fonts come from the pairing; copy/label/palette/fitting rules |
| `lib/poster/posterEdgeCases.test.ts`                          | The audit catches each issue kind; every goal with no photos, amenities or times; hostile model output; odd times/locations; unbreakable words               |
| `lib/poster/posterEdgeParity.test.ts`                         | Archetype, font pairing and goal enums match between UI and edge                                                                                             |
| `hooks/useGeneratePosters.test.ts`                            | Request payload, photo remapping, fallback on 503 / empty / malformed / network errors, quota rethrow                                                        |
| `_shared/marketingPosterDirector_test.ts` (Deno)              | Amenity grounding, photo allow-list (SSRF), byte budget, bad responses, banned copy, variant sanitizing                                                      |
| `e2e/features/marketing/marketingAiPost.spec.ts` (Playwright) | Default mode, 4 rendered posts, request body, fallback, quota path, Edit → Design with a 4:5 save, plan default                                              |

## Not in this slice

These are separate features from the plan, not gaps in AI Post:

- brand kit fields (mascot, handles, tone)
- cached photo analysis
- structure-locked photo enhancement
- a vision critic
- carousel sets
- "Save as my style"
- server-side render
- 4:5 versions of the Design preset library

The ship gate is still the blind eval against the benchmark posts.
