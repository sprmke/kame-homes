---
name: social-creative
description: Produce Kame Homes marketing creative for Facebook, Instagram, TikTok, ads and email (feed posts, carousels, stories, reels, link ads, email heroes, landscape) with the Remotion studio in marketing/social. Use when asked for social posts, ads, promo images or videos, launch graphics, email banners, or any off-app marketing material. Enforces the flat brand system, campaign format matrix, and a strict "does not look AI-generated" review.
---

# Social creative (Kame Homes)

Off-app marketing material. Not in-app UI. Studio: `marketing/social/` (standalone Remotion project, own `package.json`).

```bash
cd marketing/social && bun install
bun run studio                               # preview every composition
bun run render:stills                        # every PNG
bun run render:videos                        # every MP4 (h264, CRF 15)
node scripts/render.mjs stills 02-path       # filter by id substring
node scripts/render.mjs all 04-smart         # one feature's whole kit (ad, hook, carousel, reel)
SKIP=1 bun run render:all                    # only what is missing
bun run gallery                              # out/index.html: everything + captions to copy
```

Output (gitignored, reproducible):

```
out/index.html                                  gallery: every piece with its caption
out/campaign/<nn-concept>/<format>.png|mp4       campaign concepts (carousels: <n>.png)
out/features/<nn-module>/ad/<format>.png|mp4     product ad (4 stills, story + landscape video)
out/features/<nn-module>/hook/<format>.png       question hook post (story, portrait, square)
out/features/<nn-module>/carousel/<1-5>.png      how-it-works carousel (portrait)
out/features/<nn-module>/reel/story.mp4          hook-first reel
```

Captions live in `scripts/captions.ts` (campaign) and are built from the feature copy for kits, so they never drift from the creative.

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

### Campaign 2: new angles (`src/angles/`)

Formats borrowed from what works for bigger SaaS brands. Each one is a different post type, not another headline-plus-phone.

| Id              | Angle (format it borrows)                                                    | Tone                  | Formats / video                                         |
| --------------- | ---------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| `09-group-chat` | Relatable pain: the team chat vs one booking card                            | paper                 | story portrait square landscape link · story square     |
| `10-day`        | Day in the life: "Saturday, handled." timeline with the module per event     | white                 | story portrait square landscape email · story landscape |
| `11-versus`     | Comparison table: group chat + spreadsheet vs Kame Homes                     | paper                 | story portrait square landscape link                    |
| `12-two-sides`  | Two phones, one moment: guest uploads, host sees it verified                 | tint                  | story portrait square landscape · story landscape       |
| `13-checklist`  | Save-worthy educational carousel: 5 things every guest needs before check-in | paper + brand         | portrait ×7                                             |
| `14-manifesto`  | Type-only manifesto: chores struck through, "Guests."                        | night                 | story portrait square                                   |
| `14-kinetic`    | Kinetic typography reel: one phrase at a time, hard cuts between planes      | night → paper → brand | story square video                                      |
| `15-question`   | Engagement post: "Where do guest receipts end up?" comment A to D            | tint                  | story portrait square                                   |
| `16-journey`    | Flagship walkthrough: one booking, six real screens, Path advancing          | paper                 | story landscape video                                   |

Files: `shared.tsx` (TopBar, PhoneAt, Scaled), one file per angle, `registry.tsx` (`angleStills`, `angleCarousels`, `angleVideos`, wired in `Root.tsx`).

### Feature series (`src/features/`)

One piece per dashboard module, same layout so the set reads as one campaign: kicker = module name, 3-line headline (2-line on square) with one accent phrase, sub line, the module's real mobile screen.

| Folder (`out/features/`) | Module           | Tone       | Headline                          |
| ------------------------ | ---------------- | ---------- | --------------------------------- |
| `01-bookings`            | Bookings         | `paper`    | Bookings that run themselves.     |
| `02-receipt-check`       | AI receipt check | `night`    | Receipts, checked for you.        |
| `03-channel-sync`        | Channel sync     | `white`    | Airbnb and direct. One calendar.  |
| `04-smart-pricing`       | Smart Pricing    | `brand`    | A rate for every night.           |
| `05-ai-receptionist`     | AI receptionist  | `tint`     | Guests ask. Kame answers.         |
| `06-booking-site`        | Booking site     | `graphite` | Guests book direct.               |
| `07-content-studio`      | Content Studio   | `paper`    | Posts that look like your place.  |
| `08-insights`            | Insights         | `white`    | Numbers that tell you what to do. |
| `09-team`                | Team             | `brand`    | Your team. Your rules.            |
| `10-maintenance`         | Maintenance      | `tint`     | Upkeep, on schedule.              |
| `11-telegram-alerts`     | Telegram alerts  | `paper`    | Your team hears it first.         |
| `12-ai-mode`             | AI mode          | `night`    | Just ask. It knows your numbers.  |
| `13-stay-guide`          | Stay guide       | `tint`     | One link. Everything they need.   |
| `14-deposit-refund`      | Deposit refund   | `night`    | Deposits back, with a thank-you.  |
| `15-parking`             | Parking          | `brand`    | Your empty slot can earn too.     |
| `16-guest-inbox`         | Guest inbox      | `night`    | Reply before they ask twice.      |
| `17-finance`             | Finance          | `white`    | Know your real profit.            |

Every module ships a **kit** of four post types, so each feature can be posted several ways:

| Kit piece   | What it is                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------- |
| `ad/`       | Product ad: headline, sub, real screen. 4 stills + story and landscape video                |
| `hook/`     | The pain as a big question (`kitCopy.hook`), the answer in one line, the screen peeking in  |
| `carousel/` | 5 slides: hook cover, three steps on the Path (`kitCopy.steps`), "Try it free today." close |
| `reel/`     | 9:16: hook question first (scroll-stopper), then the product ad, then the offer card        |

Files: `kit.tsx` (screen kit: TitleBar, Card, Row, Pill, CheckDot, Toggle, Btn), `concept.tsx` (`makeFeatureConcept`), `extras.tsx` (hook, carousel, reel factories), `kitCopy.ts` (hook question, answer, three steps per module), `*Screens.tsx` (module screens; `stayScreens.tsx` holds stay guide, deposit refund, parking claim and guest upload), `registry.tsx` (specs + order). To add a module: write a screen with `useAnim`, add a spec to `featureSpecs` and its copy to `kitCopy`, render with `node scripts/render.mjs all <nn>-<slug>`.

Hook headlines auto-fit the frame width (`fit` in `extras.tsx`); keep each hook line under ~16 characters anyway so the type stays big.

Videos (`videos.tsx`): concept animates, then cross-fades into the `07-offer` end card. 9 to 10 seconds.

### Filipino set (`src/filipino/`)

Taglish version of the studio for PH hosts. Output mirrors the English tree under `out/filipino/` (composition ids carry a `fil-` prefix; `render.mjs` routes them).

```bash
bun run render:filipino                      # every Filipino still and video
node scripts/render.mjs stills fil-f         # Filipino feature kits only
bun run gallery:filipino                     # out/filipino/index.html with Taglish captions
```

| File                          | What                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `copy.ts`                     | All Filipino copy: shared UI strings, 17 feature kits, manifesto, question, lock screen |
| `bahala.tsx`                  | `01-kame-na-bahala`: midnight "Hi po" guest thread, each message resolved, brand line   |
| `noonNgayon.tsx`              | `02-noon-ngayon`: then vs now split, old habits struck, new way on the brand plane      |
| `registry.tsx`                | Feature specs with Filipino copy, campaign stills and videos                            |
| `compositions.tsx`            | `FilipinoFolder`, wraps every composition in `CopyProvider` (`src/copy.tsx`)            |
| `scripts/filipinoCaptions.ts` | Taglish captions, built from the same copy                                              |

Campaign: `01-kame-na-bahala`, `02-noon-ngayon`, `03-tulog-ka` (lock screen), `04-manifesto` + `04-kinetic`, `05-tanong` (comment A to D), `06-offer`. Feature kits reuse the English layouts and screens; only copy changes. App UI inside phones and status chips stays English, like the product.

**Language rules (the reason this set exists, keep them):**

1. **Taglish, not translated Tagalog.** Tagalog grammar and particles (`na`, `pa`, `lang`, `mo`, `'di ba`) with the English nouns hosts actually say: booking, resibo, check-in, Wi-Fi, GCash, GC. Never formal or deep Tagalog ("pamahalaan", "makabagong", "iyong") that reads like a government notice or a machine.
2. **Hooks from real PH host life.** Midnight "Hi po!", "Ate, ano po ang Wi-Fi password?", the suki still paying platform fees, the matumal week, same rate on a long weekend. Guests speak with "po"; the host is "mo/ka", like a friend.
3. **Wordplay that only works in Filipino.** Brand line "Kame na bahala." (said aloud: "kami na bahala"). "Ang kita mo, kitang-kita mo na." (kita = income and see). "May pa-voucher". One per piece, never forced.
4. **Captions talk like a PH page.** Relatable first line, then a nudge: comment a letter, tag a co-host, "I-save mo 'to". At most one or two emoji.
5. **Length limits are tighter.** Tagalog runs long and wide (m, n, ng). Tall ad lines ≤ 13 characters, square lines ≤ 19. `fit()` measures real Jakarta Bold widths (`src/glyphWidths.ts`) and only ever shrinks a line that would overflow.
6. Same product truth and no-hype rules as English. No em dashes.

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
