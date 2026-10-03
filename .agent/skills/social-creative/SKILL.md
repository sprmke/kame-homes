---
name: social-creative
description: Produce Kame Homes marketing creative for Facebook, Instagram and TikTok (feed posts, carousels, stories, reels) with the Remotion studio in marketing/social. Use when asked for social posts, ads, promo images, promo videos, launch graphics, or any off-app marketing material. Enforces the brand teal system and a strict "does not look AI-generated" checklist.
---

# Social creative (Kame Homes)

Off-app marketing material: images and short videos for Facebook, Instagram and TikTok. Not in-app UI.

Studio: `marketing/social/` (standalone Remotion project, its own `package.json`, not a root workspace).

```bash
cd marketing/social && bun install
bun run studio                          # live preview of every composition
bun run render:stills                   # PNGs → out/stills
bun run render:videos                   # MP4s (h264, CRF 16) → out/videos
node scripts/render.mjs all carousel    # filter by id substring
```

## Why this stack

- **Remotion** already powers the host showcase film, so stills and videos share one React codebase, one type system, one motion grammar.
- Real fonts (Plus Jakarta Sans TTFs in `public/fonts`), exact pixel sizes, deterministic output, versioned in git.
- No generative image models for final art. They produce the exact look we are avoiding, and they misspell product text.

## Brand system

| Token    | Value                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------ |
| Hue      | Teal ramp around product primary `hsl(168 65% 40%)`, see `src/theme.ts`                          |
| Tones    | `light` (cool off-white), `mist` (teal 50), `dark` (teal 950), `teal` (brand fill), one per post |
| Type     | Plus Jakarta Sans only. Display 800, tracking `-0.042em`, line-height ~0.98. Body 400 at 32px    |
| Accent   | One phrase per headline in teal (`accent()`), usually the last line                              |
| Wordmark | Typographic "Kame Homes" + rotated teal square. Do not use the turtle logo in social creative    |
| Icons    | Lucide only, stroke 2, inside soft teal tiles                                                    |
| Margin   | 88px on every edge (`MARGIN`)                                                                    |

Never add `fontFeatureSettings` stylistic sets (`ss01`, `cv11`). They square off m/n/u in Jakarta.

## Formats and safe zones

| Format                | Size         | Rules                                                                                  |
| --------------------- | ------------ | -------------------------------------------------------------------------------------- |
| Feed portrait (4:5)   | 1080×1350    | Default for IG/FB feed. Whole frame visible                                            |
| Square                | 1080×1080    | FB feed, IG grid crops                                                                 |
| Story / Reel / TikTok | 1080×1920    | Copy and CTA between y=270 and y=1360 (`STORY_SAFE`), stay left of x=930 (action rail) |
| Carousel              | 1080×1350 ×N | Shared header (wordmark + `n / N`), one idea per slide, CTA on the last                |

## The "not AI-made" checklist

Run this on every render before calling it done. Read the PNG or pull frames from the MP4 with `ffmpeg -ss <t> -i file.mp4 -frames:v 1 out.png`.

1. **One idea per frame.** A headline of 2 to 6 words carries the post. No feature lists on a single poster.
2. **Hand-set line breaks.** Break display lines on purpose (`<br />` or one `Line` per row) and set `whiteSpace: 'nowrap'` in video so nothing reflows. No orphans, no widow words, no text touching the margin.
3. **Left-aligned, asymmetric.** Off-axis light source (`Canvas light={[x, y]}`), never a centered glow. Centered layouts only for a deliberate end card.
4. **Specific, local, true.** Use real product behaviour (GAF approvals, receipt checks, two-way Airbnb sync, SD refund, ₱ amounts, Manila-style names). Never invent customer counts, ratings, testimonials or revenue claims. Sample figures belong inside a product fragment, not in the headline.
5. **Product fragments, not screenshots.** Draw focused pieces in `src/fragments.tsx` (rail, notice, calendar, panel). One fragment per post, cropped or bled off an edge when it helps the composition.
6. **Restraint.** No emoji, no sparkle spam (one `Sparkles` icon max, and only for AI features), no purple, no neon glow, no glassmorphism stacks, no stock 3D blobs, no gradient text.
7. **Grain on.** `Canvas` adds fine film grain to break gradient banding. Keep it.
8. **Copy.** Follow `human-copy`: plain, short, no em dashes, no "unlock / supercharge / seamless / elevate / game-changer". Sentence case. Periods on display headlines are part of the voice.
9. **Motion.** Use `motion.ts`: masked line reveals, ease-out, no overshoot springs, elements land once and hold. 10 to 15 seconds, end on the shared `EndCard`.
10. **Check the edges.** Nothing clipped at the right margin, nothing important under story overlays, numbers use tabular figures.

## Adding a piece

1. Pick a single message and a tone. Reuse or add a fragment in `src/fragments.tsx` (accept `frame` + `startAt` so it animates in video and renders settled as a still).
2. Add the poster to `src/stills/` or the video to `src/videos/`, then register it in `src/Root.tsx` (`still-*` / `video-*` ids drive `render.mjs`).
3. Type-check (`node_modules/.bin/tsc -p .`), render, then review against the checklist above. Fix and re-render until it passes.

## References

- Instagram / TikTok safe zones (2026): top ~14% and bottom ~35% of 9:16 are covered by UI.
- Remotion stills: https://www.remotion.dev/docs/stills · CLI render: https://www.remotion.dev/docs/cli/render
- Design language source: `ui/src/features/guest/marketing/for-hosts/components/film/` (host showcase film).
