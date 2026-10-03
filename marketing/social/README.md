# Social studio

Marketing creative for Facebook, Instagram and TikTok, rendered with Remotion. Not part of the app bundle.

```bash
bun install
bun run studio          # preview every composition in the browser
bun run render:stills   # PNGs → out/stills
bun run render:videos   # MP4s → out/videos
bun run render:all
```

| Path                 | What                                                        |
| -------------------- | ----------------------------------------------------------- |
| `src/theme.ts`       | Teal ramp, sizes, margins, 9:16 safe zone                   |
| `src/primitives.tsx` | Canvas (tones + grain), type, wordmark, buttons, chips      |
| `src/fragments.tsx`  | Drawn product fragments, animatable via `frame` / `startAt` |
| `src/stills/`        | Feed posters, story, 5-slide carousel                       |
| `src/videos/`        | 9:16 and 4:5 motion pieces                                  |
| `src/Root.tsx`       | Composition registry (`still-*`, `video-*`)                 |

Rules and the review checklist: skill `social-creative` (`.agent/skills/social-creative/SKILL.md`).
`out/` is gitignored; renders are reproducible from source.
