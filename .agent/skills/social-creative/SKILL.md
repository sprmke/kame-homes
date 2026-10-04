---
name: social-creative
description: Produce Kame Homes marketing creative for Facebook, Instagram, TikTok, ads and email (feed posts, carousels, stories, reels, link ads, email heroes, landscape) with the Remotion studio in marketing/social. Use when asked for social posts, ads, promo images or videos, launch graphics, email banners, or any off-app marketing material. Enforces the flat brand system, campaign format matrix, and a strict "does not look AI-generated" review.
---

# Social creative (Kame Homes)

Off-app marketing material. Not in-app UI. Studio: `marketing/social/` (standalone Remotion project, own `package.json`).

```bash
cd marketing/social && bun install
bun run studio                               # preview every composition
bun run render:stills                        # PNG → out/stills/<concept>/<format>.png
bun run render:videos                        # MP4 (h264, CRF 15) → out/videos/
node scripts/render.mjs stills 02-path       # filter by id substring
node scripts/render.mjs all feature-04       # one module of the feature series → out/features/04-smart-pricing/
```

## The look: what professional brand creative does (and AI templates don't)

Researched against SaaS ad breakdowns and Apple/Stripe-style campaigns:

1. **Flat color planes.** Every background is one solid tone from `theme.ts`. No radial washes, blurred blobs, glows, mesh gradients or grain. Those are the strongest "AI template" tell.
2. **One hook, one visual idea, one CTA** per piece. Never a feature list on one poster (the bento is the one deliberate exception, and it is built as a grid of single ideas).
3. **A brand device, not decoration.** The Path (`path.tsx`): thick line + diamond nodes = the six booking stages. It bleeds off edges and continues across carousel slides. Use it instead of ornamental shapes.
4. **Product truth, drawn crisply.** CSS phone (`device.tsx`) with real mobile UI (`screens.tsx`), or abstract workflow nodes. Never screenshots, never stock 3D, never illustrations of people.
5. **Typographic hierarchy does the work.** Plus Jakarta Sans 700, tracking `-0.045em`, line-height ~1.0, hand-set line breaks, one accent phrase per headline in the tone's accent color.
6. **Crop with intent.** Phones bleed off the bottom, paths bleed off the sides. Left-aligned, asymmetric layouts.

## Palette v3 and tones (one per piece)

v3 replaced the old teal/forest set: mid-teal planes had weak white contrast (2.97:1), forest text on teal read as muddy green-on-green, and the teal-black darks looked sluggish.

- **Brand** `hsl(162 80% 30%)`: one clean emerald. White on it 4.3:1.
- **Darks** are graphite with a trace of green (`night` 8%, `graphite` 12%), never saturated teal-black. Matches the app's neutral dark mode.
- **Lights** are near-neutral (`paper`, `white`); green tint only on chips and the `tint` tone.
- **Never green on green of similar depth.** On the brand plane the accent is pale mint `onBrand` (3.5:1, display sizes only). On dark planes the accent is `mint`. On light planes it is `brandDeep` (5:1).
- `sun` and `coral` are single small highlights (a low bar, a hang-up button), never planes.

| Tone       | Use                                             | Accent      |
| ---------- | ----------------------------------------------- | ----------- |
| `brand`    | Brand-forward: Path, offer card, carousel cover | `onBrand`   |
| `tint`     | Soft, fresh: lock screen, receptionist, upkeep  | `brandDeep` |
| `night`    | Premium/dark: inbox, receipts, AI mode          | `mint`      |
| `graphite` | Dark panels inside splits, booking site         | `mint`      |
| `paper`    | Editorial/light: bento, bookings, studio        | `brandDeep` |
| `white`    | Clean product focus: finance, sync, insights    | `brandDeep` |

Use tokens from `c` / `tones`; no literal `hsl()` greens in concept files. Brand diamond color comes from `tone.mark`.

## Campaign format matrix

Every concept is laid out per orientation (not scaled). `Frame` gives a design space; landscape formats share a 1920-wide space and are scaled to output.

| Format id   | Output    | Use                                                   |
| ----------- | --------- | ----------------------------------------------------- |
| `story`     | 1080×1920 | Stories, Reels, TikTok. Copy between y=250 and y=1340 |
| `portrait`  | 1080×1350 | IG/FB feed (best feed real estate), carousel slides   |
| `square`    | 1080×1080 | FB/IG feed, grid-safe                                 |
| `landscape` | 1920×1080 | YouTube, X, LinkedIn, website hero, video             |
| `link`      | 1200×628  | FB/IG link ads, Open Graph                            |
| `email`     | 1200×600  | Email hero (display at 600px, 2× retina source)       |

## Concepts in the studio

| Id                | Idea                                      | Formats                               |
| ----------------- | ----------------------------------------- | ------------------------------------- |
| `01-lockscreen`   | Overnight notifications on a phone        | story portrait square landscape link  |
| `02-path`         | "Every booking. One path. Nothing slips." | story portrait square landscape email |
| `03-bento`        | Feature summary bento grid                | portrait square landscape link email  |
| `04-before-after` | "Five tabs open." vs "One workspace."     | story portrait square landscape link  |
| `05-inbox`        | AI suggested reply in a chat thread       | story portrait square landscape       |
| `06-finance`      | Net profit on mobile finance              | story portrait square landscape       |
| `07-offer`        | "Start free." end card / ad               | all six                               |
| `08-carousel`     | 5-slide panorama, Path runs across all    | portrait ×5                           |

### Feature series (`src/features/`)

One piece per dashboard module, same layout so the set reads as one campaign: kicker = module name, 3-line headline (2-line on square) with one accent phrase, sub line, the module's real mobile screen.

| Folder (`out/features/`) | Module           | Tone       | Headline                          |
| ------------------------ | ---------------- | ---------- | --------------------------------- |
| `01-bookings`            | Bookings         | `paper`    | Bookings that run themselves.     |
| `02-receipt-check`       | AI receipt check | `night`    | Receipts, checked for you.        |
| `03-channel-sync`        | Channel sync     | `white`    | Airbnb and direct. One calendar.  |
| `04-smart-pricing`       | Smart Pricing    | `brand`    | A rate for every night.           |
| `05-ai-receptionist`     | AI receptionist  | `tint`     | Guests call. Kame answers.        |
| `06-booking-site`        | Booking site     | `graphite` | Guests book direct.               |
| `07-content-studio`      | Content Studio   | `paper`    | Posts that look like your place.  |
| `08-insights`            | Insights         | `white`    | Numbers that tell you what to do. |
| `09-team`                | Team             | `brand`    | Your team. Your rules.            |
| `10-maintenance`         | Maintenance      | `tint`     | Upkeep, on schedule.              |
| `11-telegram-alerts`     | Telegram alerts  | `paper`    | Your team hears it first.         |
| `12-ai-mode`             | AI mode          | `night`    | Just ask. It knows your numbers.  |

Each folder holds `story`, `portrait`, `square`, `landscape` PNGs plus `story.mp4` and `landscape.mp4` (screen plays its job, then the offer end card). Inbox and Finance stay in the main campaign (`05-inbox`, `06-finance`).

Files: `kit.tsx` (screen kit: TitleBar, Card, Row, Pill, CheckDot, Toggle, Btn), `concept.tsx` (`makeFeatureConcept`, per-format layout), `*Screens.tsx` (module screens), `registry.tsx` (specs + order). To add a module: write a screen with `useAnim`, add a spec to `featureSpecs`, render with `node scripts/render.mjs all feature-<nn>`.

Videos (`videos.tsx`): concept animates, then cross-fades into the `07-offer` end card. 9 to 10 seconds.

## Review checklist (run on every render)

Read each PNG, or pull frames: `ffmpeg -ss <t> -i file.mp4 -frames:v 1 f.png`. Build a contact sheet per concept to compare formats side by side.

1. No gradients, glows, blur or grain anywhere. Shadows only on devices/cards, tinted from the background.
2. Nothing clipped: last Path label, numbers in small tiles, the right margin, the headline's final period.
3. No dead zones: every region either holds content or is deliberate negative space next to the hero element.
4. 9:16: copy and CTA inside the safe zone; only graphics may sit under the overlays.
5. One accent phrase. One CTA. Wordmark once per piece.
6. Copy follows `human-copy`: plain, specific, no em dashes, no hype words ("unlock", "seamless", "supercharge").
7. Claims are product-true. Sample ₱ figures, names and booking IDs live inside UI fragments, never in headlines. No invented user counts, ratings or testimonials.
8. Video: masked line reveals and ease-outs only, no bounce, elements land once and hold.

## Adding a concept

1. Pick one message, one tone, one visual (phone screen, Path, or a fragment).
2. Write a `<Name>Body` that branches on `kind` (`vertical`, `portrait`, `square`, `landscape`) using `useFrameCtx()` for `W`, `H`, `M`, `hs`. Accept `frame` so it animates; stills render with `SETTLED`.
3. Register it in `Root.tsx` (`campaign` matrix) and optionally in `videoConcepts`.
4. `node_modules/.bin/tsc -p .`, render, review with the checklist, fix, re-render.

## Sources

- Remotion stills and rendering: https://www.remotion.dev/docs/stills · https://www.remotion.dev/docs/cli/render
- SaaS ad patterns (one hook, abstract workflow nodes over screenshots): https://aimers.io/blog/facebook-ad-examples-for-tech-companies
- Bento grids: https://www.deck.gallery/blog/apple-bento-grid-breakdown/
- Safe zones and sizes: https://postplanify.com/blog/social-media-safe-zones-2026-complete-guide · https://buffer.com/resources/social-media-image-sizes/ · https://imagedimensions.com/guides/email-header-image-size
- Avoiding the AI look: https://www.saasui.design/blog/saas-ui-looks-ai-generated
