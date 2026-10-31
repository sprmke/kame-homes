# Social studio

Marketing creative for Facebook, Instagram, TikTok, ads and email, rendered with Remotion. Not part of the app bundle.

```bash
bun install
bun run studio          # preview every composition in the browser
bun run render:stills   # every PNG
bun run render:videos   # every MP4
bun run render:all
SKIP=1 bun run render:all   # only what is missing
bun run gallery         # out/index.html: every piece with a caption to copy
bun run render:filipino     # Filipino (Taglish) set → out/filipino/
bun run gallery:filipino    # out/filipino/index.html with Taglish captions
```

| Path                 | What                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/theme.ts`       | Palette v3 flat tones, format matrix, 9:16 safe zone                                                                                                            |
| `src/primitives.tsx` | `Frame` (per-format design space), type, wordmark, CTA, `Fit`                                                                                                   |
| `src/path.tsx`       | The Path brand device (booking stages as line + diamonds)                                                                                                       |
| `src/device.tsx`     | CSS phone, status bar, lock-screen push                                                                                                                         |
| `src/screens.tsx`    | Phone screens: lock screen, inbox, finance                                                                                                                      |
| `src/bento.tsx`      | Bento feature grid (wide / square / tall)                                                                                                                       |
| `src/concepts.tsx`   | Campaign concepts, each laid out per orientation                                                                                                                |
| `src/videos.tsx`     | Concept → offer end card video factory                                                                                                                          |
| `src/angles/`        | Campaign 2: group chat, day timeline, versus table, two sides, checklist carousel, manifesto + kinetic reel, question post, journey video                       |
| `src/mascot/`        | Campaign 3: Kame v6 mascot as a posable three.js component (`Kame.tsx`, `poses.ts`, `spec.ts`), meet, carry, night shift, ask Kame, crew lineup, carousel, reel |
| `src/features/`      | Feature kits: 17 modules × (ad, hook post, carousel, reel)                                                                                                      |
| `src/filipino/`      | Filipino set: Taglish copy, Filipino-first concepts (Kame na bahala, Noon vs Ngayon), all 17 kits                                                               |
| `src/copy.tsx`       | Shared UI strings (CTA, carousel chrome, offer card) per language                                                                                               |
| `src/glyphWidths.ts` | Jakarta Bold advance widths used by `fit()` to size display lines                                                                                               |
| `scripts/`           | `render.mjs` (output tree), `gallery.ts` + `captions.ts` + `filipinoCaptions.ts`                                                                                |
| `src/Root.tsx`       | Campaign matrix, feature folders and composition ids                                                                                                            |

Output: `out/campaign/<nn-concept>/` and `out/features/<nn-module>/{ad,hook,carousel,reel}/`. Filipino set: same tree under `out/filipino/`. Open `out/index.html` (or `out/filipino/index.html`) to browse everything and copy captions. One feature's kit: `node scripts/render.mjs all 04-smart`.

Renders use `--gl=angle` (set in `render.mjs`) because Kame is drawn with WebGL. Pose reference: `out/mascot/poses.png`.

Formats: story 1080×1920 · portrait 1080×1350 · square 1080×1080 · landscape 1920×1080 · link ad 1200×628 · email hero 1200×600.

Rules and the review checklist: skill `social-creative` (`.agent/skills/social-creative/SKILL.md`).
`out/` is gitignored; renders are reproducible from source.
