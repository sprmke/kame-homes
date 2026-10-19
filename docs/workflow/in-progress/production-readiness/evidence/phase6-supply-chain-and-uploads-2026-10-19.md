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

| Check                                 | Result                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun install --frozen-lockfile` in CI | ✅ every workflow (`ci.yml`, `cd-dev.yml`, `cd-prod.yml`, `cd-preprod.yml`, `migration-replay.yml`)                                                                                        |
| Dependabot                            | ✅ `.github/dependabot.yml` present                                                                                                                                                        |
| Actions pinned to SHA                 | 🔴 none: `actions/checkout@v4` ×13, `oven-sh/setup-bun@v2` ×11, `actions/cache@v4` ×9, `actions/upload-artifact@v4` ×6, `denoland/setup-deno@v2` ×4 (PR-127, decision: pin or accept tags) |
| Deno remote imports                   | Pinned with versions in source; `^` ranges appear only inside esm.sh transitive resolution                                                                                                 |

## Upload attacks

Only booking documents (`uploadService`, `bookingAssetUpload`), assistant attachments and Marketing Studio sniffed bytes. Guest chat, host inbox chat and guest avatar trusted the browser-declared type; guest chat lands in the **public** `guest-chat-attachments` bucket.

Fixed in [#150](https://github.com/sprmke/kame-homes/pull/150): shared `uploadInboxChatAssetFromBytes` sniffs (covers inbox + assistant-sent files), guest chat routed through it, avatars sniffed. Tests: HTML as PNG, PNG as PDF, SVG all rejected before upload.

Still open: support-ticket attachments (accepts MP4/MOV, sniffer has no video), org/team logos, verification assets (PR-016). `guest-chat-attachments` stays public with UUID paths (PR-120).
