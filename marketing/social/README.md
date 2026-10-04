# Social studio

Marketing creative for Facebook, Instagram, TikTok, ads and email, rendered with Remotion. Not part of the app bundle.

```bash
bun install
bun run studio          # preview every composition in the browser
bun run render:stills   # PNGs → out/stills/<concept>/<format>.png
bun run render:videos   # MP4s → out/videos/
bun run render:all
```

| Path                 | What                                                          |
| -------------------- | ------------------------------------------------------------- |
| `src/theme.ts`       | Palette v3 flat tones, format matrix, 9:16 safe zone          |
| `src/primitives.tsx` | `Frame` (per-format design space), type, wordmark, CTA, `Fit` |
| `src/path.tsx`       | The Path brand device (booking stages as line + diamonds)     |
| `src/device.tsx`     | CSS phone, status bar, lock-screen push                       |
| `src/screens.tsx`    | Phone screens: lock screen, inbox, finance                    |
| `src/bento.tsx`      | Bento feature grid (wide / square / tall)                     |
| `src/concepts.tsx`   | Campaign concepts, each laid out per orientation              |
| `src/videos.tsx`     | Concept → offer end card video factory                        |
| `src/features/`      | Feature series: one piece per dashboard module (12 modules)   |
| `src/Root.tsx`       | Campaign matrix, feature folders and composition ids          |

Feature series renders to `out/features/<nn-module>/` (4 stills + story and landscape MP4 each): `node scripts/render.mjs all feature`.

Formats: story 1080×1920 · portrait 1080×1350 · square 1080×1080 · landscape 1920×1080 · link ad 1200×628 · email hero 1200×600.

Rules and the review checklist: skill `social-creative` (`.agent/skills/social-creative/SKILL.md`).
`out/` is gitignored; renders are reproducible from source.
