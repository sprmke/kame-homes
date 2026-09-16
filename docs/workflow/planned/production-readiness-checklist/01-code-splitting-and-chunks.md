---
title: 'Split code into chunks'
status: active
tags: [workflow, planned, production-readiness, performance, bundle]
updated: 2026-09-16
stage: planned
kind: plan
---

# 01 — Split code into chunks

## Goal

Every persona downloads only the code its surface needs. A guest opening the booking form must never download dashboard, super-admin, Marketing Studio, or PDF code.

## Prior art — do not redo

The heavy lifting is **already shipped** by [`pre-production-launch-audit.md`](../../for-testing/pre-production-launch-audit.md) P0-3 and [`performance-optimization-production-readiness.md`](../../for-testing/performance-optimization-production-readiness.md) Phase 1:

| Shipped                      | Evidence                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Route-level lazy loading     | 123 `React.lazy` / `= lazy(` sites across `ui/src`                                                         |
| 12 vendor `manualChunks`     | `ui/vite.config.ts:265-305` — react, query, supabase, motion, icons, forms, date, observability, ui, radix |
| Entry + initial budget in CI | `scripts/performance/check-initial-bundle-budget.mjs` (entry ≤ 500 KiB gzip, initial ≤ 1200 KiB gzip)      |
| Component-level splits       | Polotno design studio, mediabunny encoders, html2canvas                                                    |

**This doc is not "add code splitting."** It is: prove the split is correct per persona, close the chunks that are still mis-assigned, and stop the four remaining monolith risks.

## Current state — remaining risk

The `manualChunks` map is a **static vendor list**. It says nothing about feature code, and several heavy `ui/package.json` dependencies have no chunk assignment at all:

| Dependency                                                            | Rough weight | Used by                                     | Risk                                                  |
| --------------------------------------------------------------------- | ------------ | ------------------------------------------- | ----------------------------------------------------- |
| `fabric` + `konva` + `openpolotno`                                    | very large   | Marketing Studio design editor only         | Already component-lazy — **verify** it stays that way |
| `@remotion/player`, `@remotion/transitions`, `@remotion/web-renderer` | very large   | Marketing video only                        | Must never reach a guest route                        |
| `@blueprintjs/core` + `@blueprintjs/icons`                            | large        | Polotno's peer dependency                   | Easy to leak into the main graph via a stray import   |
| `@tiptap/*` (9 packages)                                              | large        | Rich-text editors (templates, custom pages) | Host-only, must be its own chunk                      |
| `jspdf` + `jspdf-autotable` + `pdf-lib` + `pdfjs-dist`                | large        | Finance export, document preview            | Host-only                                             |
| `recharts`                                                            | large        | Analytics + finance charts                  | Host-only                                             |
| `@googlemaps/js-api-loader`                                           | medium       | Map listing views                           | Guest + host, load on demand                          |
| `fabric`/`konva` peer graph                                           | —            | —                                           | Two canvas libraries shipped together — see doc 05    |

**Named risk:** a single non-lazy `import` anywhere in a shared module (e.g. a `lib/` util that imports a type from `jspdf`) collapses the split silently. The budget check catches the total, but not _which_ persona regressed.

## Phases

### Phase 1.1 — Per-persona chunk attribution

Build `scripts/performance/analyze-chunk-graph.mjs` that reads `ui/dist/.vite/manifest.json` and reports, per entry route, the transitive set of chunks fetched on first paint. Output a table: route → chunk count → total gzip.

Assert four hard rules in CI:

1. No guest route's initial graph contains a chunk from `features/dashboard/**`.
2. No guest route's graph contains `recharts`, `jspdf`, `pdf-lib`, `@tiptap/*`, `fabric`, `konva`, `openpolotno`, `@remotion/*`, `@blueprintjs/*`.
3. No dashboard route's graph contains `features/guest/marketing/**` heavy editors.
4. `/admin/*` does not pull property-dashboard feature chunks.

These are **leak detectors**, not size budgets — they catch the failure mode the byte budget misses.

### Phase 1.2 — Promote heavy libs to explicit chunks

Extend `manualChunks` with a function form (not the static object) so feature libs get stable, named chunks:

```ts
manualChunks(id) {
  if (id.includes('node_modules')) {
    if (/\/(fabric|konva|openpolotno|@blueprintjs)\//.test(id)) return 'design-editor-vendor';
    if (/\/@remotion\//.test(id)) return 'video-vendor';
    if (/\/@tiptap\//.test(id)) return 'richtext-vendor';
    if (/\/(jspdf|jspdf-autotable|pdf-lib)\//.test(id)) return 'pdf-vendor';
    if (/\/recharts\//.test(id)) return 'charts-vendor';
    // ...keep the existing static groups
  }
}
```

**Edge case:** mixing the object form and function form is not allowed — converting means porting all 12 existing groups into the function. Do it in one commit, and diff the chunk list before/after to prove nothing silently merged.

**Edge case:** over-splitting hurts. Each chunk is an HTTP request plus a module-graph entry. Do not create a chunk under ~20 KiB gzip; merge those into their feature chunk instead.

### Phase 1.3 — Route-group chunking for the dashboard

The dashboard has 8+ modules (`bookings`, `org`, `property`, `finance`, `maintenance`, `pricing`, `inbox`, `team`, `marketing`, `analytics`). Confirm each is one lazy chunk, not one chunk per page. A host navigating `bookings → finance` should fetch exactly one new chunk.

Add a `<Suspense>` boundary **per shell**, not per route — per-route boundaries cause a visible flash on every navigation and waterfall nested lazy routes.

### Phase 1.4 — Preload the likely next chunk

After the split, navigation feels slower than a monolith unless chunks are prefetched. Add intent-based prefetch:

- `onMouseEnter` / `onFocus` / `onTouchStart` on primary nav links → call the route's lazy importer to warm the chunk.
- Prefetch the dashboard shell chunk **after** the guest route is interactive when a host session is detected (`requestIdleCallback`).

**Edge case:** never prefetch on a metered/slow connection. Gate on `navigator.connection.saveData` and `effectiveType`.

### Phase 1.5 — Guard the split

- Add the leak rules from 1.1 to `ci.yml` as a failing step.
- Add a per-route budget to `performance-budgets.json` (doc 00), seeded from the post-split numbers plus 10%.

## Edge cases

- **Lazy + error boundary** — a chunk fetch fails after a deploy (old hashed file gone). Every `<Suspense>` must be paired with an error boundary that offers reload, or users on a stale tab hit a blank screen. This is the single most common production symptom of code splitting; the PWA update flow in `ui/src/components/pwa/PwaProvider.tsx` is the place to coordinate it.
- **Service worker precache vs lazy chunks** — newly split chunks must stay _runtime_-cached, not precached, or the precache budget explodes. Re-run `scripts/pwa/check-precache-budget.mjs` after every split change and confirm `scripts/pwa/precache-globs.json` `globIgnores` still matches.
- **Shared module pulled both ways** — a util imported by both a guest and a dashboard chunk gets hoisted into the common ancestor, often the entry. Watch entry size after every split; a rising entry means a new shared import, not a failed split.
- **Circular lazy imports** — a lazy route importing a module that statically imports the route re-inlines it. The leak detector in 1.1 catches this.
- **SSR/prerender: N/A** — this is a pure SPA, so there is no hydration-mismatch class of bug here.

## Exit gate

- [ ] `analyze-chunk-graph.mjs` reports per-route initial graphs, committed to the baseline.
- [ ] All four leak rules pass and fail correctly when deliberately violated.
- [ ] No guest route's initial graph exceeds its budget; guest initial payload measurably below the pre-split baseline from doc 00.
- [ ] Intent prefetch live on dashboard nav, gated on `saveData`.
- [ ] Chunk-load error boundary + reload path verified by serving a build with a deleted chunk.

## Docs / Plans / activity-log

- **Docs:** `docs/PROJECT.md` (build/bundle architecture), `docs/architecture/pwa.md` if precache globs change, `scripts/README.md`.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A — no org state mutated.
