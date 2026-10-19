# Phase 6 — dependency audit triage (checklist 38 #2) — 2026-10-19

`bun audit` on `fix/ci-green-guards` (`3e269a98`): **42** advisories (4 critical, 19 high, 14 moderate, 5 low).
After `chore/deps-security-patches`: **28** (3 critical, 12 high, 11 moderate, 2 low).

## Fixed (patch/minor within the same major)

| Package                                                               | From → to                | Ships to users                                 | How                    |
| --------------------------------------------------------------------- | ------------------------ | ---------------------------------------------- | ---------------------- |
| dompurify                                                             | 3.4.14 / 3.4.15 → 3.4.17 | yes (posthog-js, jspdf, marketing editor, app) | direct bump + override |
| nanoid                                                                | 3.3.4 → 3.3.20           | yes (marketing editor)                         | override               |
| sharp                                                                 | 0.35.4 → 0.35.5          | no (PWA icon script)                           | direct bump            |
| fast-uri, shell-quote, source-map-js, serialize-javascript, smol-toml | patched in-major         | no (lint, build, dev scripts)                  | override               |

Overrides only for packages with a single locked major, so no consumer gets an incompatible version.

## Accepted for launch (dev/build only, or no in-major fix)

| Package                       | Severity        | Why accepted                                                                                                                                                       | Revisit                   |
| ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| vitest 1.6 / tinypool 0.8     | critical        | Only exploitable while the Vitest **UI server** is listening; we never run `--ui`, CI runs headless                                                                | vitest 3 upgrade (PR-126) |
| vite 4.5 / esbuild 0.18       | high / moderate | Dev-server file access and CORS; production is a static build on Vercel                                                                                            | vite 5+ upgrade (PR-126)  |
| minimatch, brace-expansion    | high            | eslint / glob internals across 3–4 majors; overriding one major breaks the others                                                                                  | with eslint upgrade       |
| braces 3.0.3                  | high            | Latest 3.x; used by tailwind/lint-staged globbing at build time                                                                                                    | when a fix ships          |
| postcss-selector-parser 6.1.4 | moderate        | Fix is in 7.x; tailwind 3 requires 6.x; build time only                                                                                                            | tailwind 4                |
| quill 1.3.7                   | moderate        | Marketing editor (`openpolotno`); fix only in breaking 2.x; editor output is host-authored and not rendered as guest HTML                                          | upstream editor update    |
| react-router 6.30             | moderate        | Backslash open redirect: our own `safeRedirect` already blocks it ([#151](https://github.com/sprmke/kame-homes/pull/151)); SSR hydration item does not apply (SPA) | v7 upgrade (PR-124)       |
