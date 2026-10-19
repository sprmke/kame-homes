# Supply chain (checklist 38) and upload attacks (6.7) — 2026-10-19

## `bun audit` (lockfile at `3e269a98`)

42 advisories: 4 critical, 19 high, 14 moderate, 5 low.

| Ships to users?         | Packages                                                                                                                                                                                                                                                 | Verdict                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Browser bundle**      | `react-router(-dom)` 6.30.6 (open redirect via backslash; SSR-only constructor injection)                                                                                                                                                                | Backslash vector reproduced in our own `safeRedirect` → **fixed in [#151](https://github.com/sprmke/kame-homes/pull/151)**. Upgrade to 7.18 = PR-124 (major) |
| Browser bundle          | `dompurify` (2 low, `IN_PLACE` mode only)                                                                                                                                                                                                                | We never call `IN_PLACE` (0 matches). Bump on next dependency pass                                                                                           |
| Browser bundle          | `quill` ≤1.3.7 XSS via `openpolotno`                                                                                                                                                                                                                     | Marketing editor only (signed-in hosts). Track with Polotno upgrade (PR-125)                                                                                 |
| Browser bundle          | `nanoid` <3.3.8 (transitive)                                                                                                                                                                                                                             | Not called with user-sized input. Bump transitively                                                                                                          |
| Dev / build / test only | `vitest`, `tinypool`, `vite`, `esbuild`, `braces`, `minimatch`, `brace-expansion`, `shell-quote`, `source-map-js`, `serialize-javascript` (PWA build), `fast-uri`, `smol-toml`, `postcss-selector-parser`, `launch-editor`, root `sharp` (image scripts) | No production runtime exposure. Upgrade vitest 1.6 → ≥3.2.6 and vite on a dedicated tooling PR (PR-126)                                                      |

## CI hygiene

| Check                                 | Result                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile` in CI | ✅ every workflow (`ci.yml`, `cd-dev.yml`, `cd-prod.yml`, `cd-preprod.yml`, `migration-replay.yml`)                                                                                                                                                                                                             |
| Dependabot                            | ✅ `.github/dependabot.yml` present                                                                                                                                                                                                                                                                             |
| Actions pinned to SHA                 | ✅ all 43 pinned with version comments in [#153](https://github.com/sprmke/kame-homes/pull/153) (user decision: pin). Before: `actions/checkout@v4` ×13, `oven-sh/setup-bun@v2` ×11, `actions/cache@v4` ×9, `actions/upload-artifact@v4` ×6, `denoland/setup-deno@v2` ×4 (PR-127, decision: pin or accept tags) |
| Deno remote imports                   | Pinned with versions in source; `^` ranges appear only inside esm.sh transitive resolution                                                                                                                                                                                                                      |

## Upload attacks

Only booking documents (`uploadService`, `bookingAssetUpload`), assistant attachments and Marketing Studio sniffed bytes. Guest chat, host inbox chat and guest avatar trusted the browser-declared type; guest chat lands in the **public** `guest-chat-attachments` bucket.

Fixed in [#150](https://github.com/sprmke/kame-homes/pull/150): shared `uploadInboxChatAssetFromBytes` sniffs (covers inbox + assistant-sent files), guest chat routed through it, avatars sniffed. Tests: HTML as PNG, PNG as PDF, SVG all rejected before upload.

Rest fixed in [#155](https://github.com/sprmke/kame-homes/pull/155): `assertUploadMatchesBytes` (adds GIF, BMP, TIFF, AVIF, MP4/QuickTime, WebM/Matroska, AVI, Ogg, MPEG) on every other upload path: app settings + GCash QR, parking settings + cover, listing authorization, org verification + consideration proofs, org/team logos, property media + templates, development media, support tickets, marketing exports. **New finding fixed there:** marketing exports stored any `data:` URL type in public `property-media` (a `data:text/html` export would be served as HTML). Not sniffed, with reason: marketing music (own audio sniff), approval webhook (always stored as PDF), import files (parsed, never served).

Live on hosted dev 2026-10-19 (edge code from #149 + #150 + #155), `scripts/dev/probe-readiness-uploads-dev.mjs` as the QA owner:

| Probe                                              | Result                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| Support ticket: HTML labelled `image/png`          | 400 `File type not recognized.`                                   |
| Support ticket: PDF labelled `image/png`           | 400 `File content is application/pdf, which is not allowed here.` |
| Support ticket: real PNG                           | 200, then deleted                                                 |
| App settings `gcash_qr`: HTML labelled `image/png` | 400 `File type not recognized.`                                   |

### `guest-chat-attachments` (PR-120), live probe on hosted dev 2026-10-19

Throwaway object uploaded with the service role, then removed:

| Probe                                         | Result                                                |
| --------------------------------------------- | ----------------------------------------------------- |
| Anon list, prefix `""` and `readiness-probe/` | `[]` (no list policy) while service role saw 1 object |
| Anon GET exact public URL                     | 200                                                   |
| Anon GET same folder, wrong UUID              | 400                                                   |
| Cleanup delete                                | 200                                                   |

Paths are `{org}/{conversation}/{uuidv4}.ext` (122 random bits). The bucket is not browsable; a file is readable only with its exact link, and a leaked link stays valid (1-year cache, no revocation). Decision for product: keep unguessable links for launch, or move to a private bucket with signed URLs (touches thread reads, realtime rows and Meta sends).
