# Phase 7.6 cross-browser walk (checklist 36) — 2026-10-19

`node scripts/dev/qa-walk-hosted-dev.mjs --group public --browser webkit|firefox` against `dev.kamehomes.space`: 20 public routes × 375 / 768 / 1280 per engine (WebKit 26.5 for Safari / iPhone, Firefox 155).

| Engine  | Page loads | Crash / not-found / overflow                 | Notes                                                                      |
| ------- | ---------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| WebKit  | 60         | 0                                            | 16 `'text/html' is not a valid JavaScript MIME type` page errors on chunks |
| Firefox | 60         | 3 (`/search`, `/contact`, `/cookies` at 768) | Error screen on those three                                                |

Both chunk symptoms happened while `develop` merges were redeploying the site mid-walk.

## Findings and fixes

| Finding                                                 | Root cause                                                                                                                                                                                        | Fix                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chunk MIME errors (WebKit) and error screen (Firefox)   | SPA rewrite `"/(.*)" → index.html` also caught `/assets/*`: a tab on the previous release got `index.html` (200) for a removed chunk, under the `immutable` assets cache header; no recovery path | [#175](https://github.com/sprmke/kame-homes/pull/175) (merged): rewrite skips `/assets/`, boundaries reload once on chunk-load errors. Verified in Chromium: rebuild mid-session, click a lazy page, old chunk 404, one reload, page renders |
| CSP report-only violations on every page (both engines) | Theme script hash matched the source, not the Vite-built HTML; inline font `onload`; PostHog and Google Maps script hosts and `data:` connect/media missing                                       | [#176](https://github.com/sprmke/kame-homes/pull/176): external `theme-init.js` / `async-styles.js`, policy updated, guard rejects inline scripts/handlers. Enforced-policy run: 0 own-origin violations on 9 key pages                      |
| Cloudflare `data:` connect                              | Inside the Turnstile iframe, under Cloudflare's own policy                                                                                                                                        | Not ours                                                                                                                                                                                                                                     |

## Still to do

- Re-run both engines after the final CD deploy (no mid-walk redeploys) and add signed-in host pages.
- Real iOS Safari / Android Chrome spot check on a device (checklist 36 rows 3–4).
