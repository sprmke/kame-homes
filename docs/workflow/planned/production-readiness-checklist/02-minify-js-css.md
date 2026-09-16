---
title: 'Minify JS and CSS'
status: active
tags: [workflow, planned, production-readiness, performance, bundle]
updated: 2026-09-16
stage: planned
kind: plan
---

# 02 — Minify JS and CSS

## Goal

Ship the smallest correct bytes: minified + compressed JS/CSS, no dead code, no source maps leaked to the public, and proof that compression is actually negotiated at the edge.

## Prior art — do not redo

Vite's production build **already** minifies JS (esbuild) and CSS (esbuild/LightningCSS) by default, and tree-shakes ES modules. `ui/vite.config.ts:259` has a `build` block but sets **no explicit `minify` option**, so the default applies.

This item is therefore **mostly already true**. The work is closing the gaps the default does not cover.

## Current state

| Aspect                     | State                | Gap                                                                                                 |
| -------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| JS minify                  | esbuild default (on) | Not explicit in config — a future `minify: false` for debugging could ship silently                 |
| CSS minify                 | default (on)         | Same                                                                                                |
| Tree-shaking               | on for ESM           | CJS-only deps are not shaken — see doc 05                                                           |
| Source maps                | not configured       | Unknown whether `.map` files are deployed publicly. PostHog needs them **uploaded**, not **served** |
| Compression                | relies on Vercel     | brotli assumed, never asserted                                                                      |
| Console/debugger stripping | not configured       | `console.log` ships to production                                                                   |
| Tailwind purge             | JIT content-scan     | Needs verification that dynamic class names are safelisted, not over-purged                         |

## Phases

### Phase 2.1 — Make minification explicit

In `ui/vite.config.ts` `build`:

```ts
minify: 'esbuild',
cssMinify: 'lightningcss',   // or leave esbuild; measure both
sourcemap: 'hidden',          // generated for upload, not referenced by a //# comment
```

`sourcemap: 'hidden'` is the correct setting for this repo: [`posthog-analytics-production-readiness.md`](../../for-testing/posthog-analytics-production-readiness.md) already sets the release to the git SHA and needs maps for symbolication, but public `.map` files hand an attacker the readable source of the admin dashboard.

**Edge case:** `hidden` still _writes_ the `.map` files to `dist`. They must be uploaded to PostHog and then **deleted before deploy**, or Vercel serves them. Add that deletion to the build/deploy script and assert `dist/**/*.map` is empty at the end of `cd-*.yml`.

### Phase 2.2 — Strip development-only code

Add esbuild `drop` for production:

```ts
esbuild: { drop: ['debugger'], pure: ['console.debug'] }
```

Do **not** blanket-drop `console` — `console.error` / `console.warn` feed PostHog exception capture and the edge logs (doc 27). Drop `debugger` and `console.debug` only.

**Edge case:** a `console.log` inside a `catch` is sometimes the only record of a swallowed error. Before dropping anything, doc 27's audit must confirm the error path reports through PostHog instead.

### Phase 2.3 — Verify compression at the edge

Minification is a fraction of the win; transfer encoding is the rest. Assert against a deployed preview:

```bash
curl -sI -H 'Accept-Encoding: br,gzip' https://<preview>/assets/<hashed>.js | grep -i content-encoding
```

Expect `br`. Record gzip **and** brotli sizes in the doc-00 baseline. If Vercel is not negotiating brotli for a content type (common for `.json`, `.svg`), that is a config finding for doc 16.

**Edge case:** never hand-roll pre-compressed `.br`/`.gz` files alongside Vercel — it double-compresses or serves stale variants. Let the platform negotiate.

### Phase 2.4 — CSS specifics

- Verify Tailwind's content globs cover every place class names appear, including `ui/src/**/*.{ts,tsx}` **and** any class strings built in edge-function email templates that are also used client-side.
- Audit for dynamically constructed class names (`` `bg-${color}-500` ``) — Tailwind cannot see these and will purge them. Either safelist or refactor to full literal class names. Grep for template literals inside `className`.
- Confirm no unused CSS framework is shipped: `@blueprintjs/core` ships its own large stylesheet as a Polotno peer. If its CSS is imported globally rather than inside the lazy design-editor chunk, every guest downloads it.

Checked 2026-09-16: **no** `@blueprintjs` import appears anywhere in `ui/src` (it reaches the graph only as a Polotno transitive dependency, and Polotno itself is referenced only through `ui/src/types/openpolotno.d.ts` type declarations plus lazy call sites). Re-verify after any Marketing Studio change rather than assuming it stays that way.

### Phase 2.5 — Guard

Add to CI: fail if `dist/**/*.map` exists after the deploy step, and fail if any built CSS file exceeds its budget.

## Edge cases

- **Minifier-induced bugs** — esbuild minification renames and can break code relying on `Function.prototype.name` or class names (some DI/serialization patterns). If anything in the app keys off a constructor name, `keepNames: true` is required.
- **Over-aggressive purge** — a purged class only breaks the _one_ rare state that uses it (an error variant, a rarely-hit empty state). Visual regression via the Playwright suite is the only practical guard.
- **Source map leakage is a security finding**, not a performance one — it exposes the whole admin dashboard source and any inlined constants. Treat it as doc 22 severity.
- **`legalComments`** — license comments are preserved by default and can add real bytes across many deps; `legalComments: 'external'` moves them to a side file while staying license-compliant. Do not simply delete them.

## Exit gate

- [ ] `minify`, `cssMinify`, `sourcemap: 'hidden'` explicit in `ui/vite.config.ts`.
- [ ] Deploy asserts zero `.map` files reachable over HTTP on a deployed preview.
- [ ] Brotli confirmed via `curl -I` on a deployed preview for JS, CSS, JSON, SVG.
- [ ] No global `@blueprintjs` (or other editor-only) CSS import outside the lazy chunk.
- [ ] Dynamic-class-name audit complete; safelist documented.

## Docs / Plans / activity-log

- **Docs:** `docs/PROJECT.md` (build config), `docs/architecture/deployment.md`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
