---
title: 'Unnecessary re-renders'
status: active
tags: [workflow, planned, production-readiness, performance, react]
updated: 2026-09-16
stage: planned
kind: plan
---

# 06 — Unnecessary re-renders ❌

Marked ❌ on the source checklist — treat as **not done**.

## Goal

No interaction in the app re-renders more of the tree than it must. Typing, hovering, polling, and realtime events stay local. Measured by React Profiler commits, not by counting `useMemo` calls.

## Current state

384 of 2330 UI files reference `React.memo` / `useMemo` / `useCallback`. That number tells us **nothing** about whether re-renders are a problem — memoization can be both missing where it matters and applied uselessly where it does not.

This app has specific structural re-render risks worth checking first:

| Risk                   | Where                                                                                          | Why                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Context value identity | Auth/org/property/theme providers wrapping the whole dashboard                                 | A new object literal per render re-renders every consumer                                      |
| Realtime subscriptions | `useNotificationsRealtime`, `useInbox`, `useActivityRealtime`, `useGuestChat`, `useChatTyping` | Each event can cascade into a full list re-render                                              |
| Polling                | Dashboard stat tiles, AI job polling, PayMongo checkout polling, booking status                | Each tick re-renders subscribers even when data is unchanged                                   |
| Large tables           | Bookings, finance, maintenance, team via TanStack Table                                        | Row-level re-renders on any table-state change                                                 |
| Forms                  | React Hook Form across guest form, booking edit, property settings                             | RHF is uncontrolled by design — a stray `watch()` re-renders the whole form on every keystroke |
| AI streaming           | Dashboard assistant SSE / turn progress                                                        | Token-level state updates can re-render the entire chat surface                                |

**`watch()` misuse and non-memoized context values are the two most likely real findings.** Both are invisible in code review and obvious in the Profiler.

## Phases

### Phase 6.1 — Measure before touching anything

Memoization added without measurement makes code slower and harder to read. Establish evidence first:

1. Install the React DevTools Profiler workflow; record a commit trace for each scenario below.
2. Enable "Highlight updates when components render" and capture video/screenshots.
3. Optionally add `scripts/performance/why-did-you-render.md` guidance for local-only `@welldone-software/why-did-you-render` usage — **dev-only**, never a production dependency.

Scenarios to profile (these become the regression suite):

| #   | Scenario                                 | Pass condition                                    |
| --- | ---------------------------------------- | ------------------------------------------------- |
| 1   | Type one character into the guest form   | Only the touched field commits                    |
| 2   | Type into the bookings search/filter box | Only the filter control + (debounced) list commit |
| 3   | Receive one realtime inbox message       | Only the thread row + unread badge commit         |
| 4   | A polling tick returns identical data    | **Zero** commits                                  |
| 5   | Open/close a modal or bottom sheet       | Underlying page does not commit                   |
| 6   | Hover a table row                        | No commit outside the row                         |
| 7   | AI assistant streams 100 tokens          | Only the streaming message bubble commits         |
| 8   | Switch property in the scope switcher    | Dashboard shell commits once, not per module      |

Record the before-numbers in the doc-00 baseline.

### Phase 6.2 — Fix context providers

For every provider in `ui/src`:

- Wrap the value in `useMemo` with exact dependencies.
- Split providers by change frequency: a context holding both a stable `orgId` and a fast-changing `isSaving` flag re-renders everything on every save. Separate them.
- Prefer passing stable setters (`useCallback` or a `useRef`-held dispatch) so consumers that only write never subscribe to reads.

### Phase 6.3 — Fix data-layer churn

- **Structural sharing**: TanStack Query already preserves reference identity for unchanged data — scenario 4 failing means something downstream (a `select` returning a new object, a `.map()` in render, a new array literal default) breaks it. Fix by memoizing `select` functions and hoisting default `[]`/`{}` literals to module constants.
- **`select` narrowing**: components that need one field should subscribe via `select` so unrelated field changes do not re-render them.
- **Realtime**: update the specific query key's cached row via `setQueryData` instead of invalidating a broad prefix (this pairs with the invalidation-scoping work already specified in the performance sibling plan).

### Phase 6.4 — Fix forms

- Replace whole-form `watch()` with `useWatch({ name })` scoped to the field, or `formState` subscriptions.
- Never pass an inline object to `defaultValues` computed in render.
- For the long guest form and property settings, isolate expensive sections behind `React.memo` with a props contract that is actually stable.

### Phase 6.5 — Fix lists and tables

- `React.memo` table rows with a custom comparator only where the Profiler shows row-level waste.
- Memoize TanStack Table `columns` definitions at module scope or with `useMemo` — a new columns array per render resets the entire table.
- Ensure keys are stable IDs, never array indices (an index key makes React re-render and remount rows on any reorder).

### Phase 6.6 — Guard against regression

- Add the eight scenarios as Playwright specs that assert **behavior** (no dropped keystrokes, input stays responsive) rather than commit counts, which are not accessible from Playwright.
- Turn on `eslint-plugin-react-hooks` exhaustive-deps as an **error** if it is currently a warning — most memoization bugs are stale/missing dependency bugs.
- Add a lightweight dev-only render counter to the shells so a regression is visible during local development.

## Edge cases

- **Memoization is not free.** `useMemo`/`useCallback` cost allocation and comparison on every render. For a cheap component, memo is a net loss. Only memoize where the Profiler shows a real cost.
- **`React.memo` defeated by inline props** — `<Row onClick={() => ...} />` passes a new function every render and makes memo useless. The comparator or the callback must be stabilized, or the memo is decoration.
- **Over-memoizing hides staleness bugs** — a `useCallback` with missing deps captures old state and produces "why is it using the previous value" bugs, which are far worse than a re-render.
- **StrictMode double-render** in development doubles commits. Profile production builds or account for it; do not chase phantom doubles.
- **React 18 automatic batching** already collapses multiple `setState` calls in the same tick, including in promises. Do not hand-roll batching.
- **Concurrent rendering** — `useTransition`/`useDeferredValue` is the right tool for the bookings filter (keep the input responsive while the list lags) and is often better than debouncing (doc 08). Consider both together.
- **Do not refactor to a new state library** to fix re-renders. That is a rewrite masquerading as an optimization; this repo's stack is TanStack Query + RHF + context.

## Exit gate

- [ ] Profiler traces captured for all 8 scenarios, before and after, committed to the baseline.
- [ ] Scenario 4 (identical polling data) produces zero commits.
- [ ] Scenarios 1, 2, 7 commit only the local subtree.
- [ ] Every context provider value memoized; fast/slow contexts split.
- [ ] No whole-form `watch()` remaining in the guest form or property settings.
- [ ] `exhaustive-deps` at error level, CI green.
- [ ] No production dependency on a render-debugging library.

## Docs / Plans / activity-log

- **Docs:** `.claude/skills/performance` guidance updated with the measured patterns; `docs/PROJECT.md` if provider structure changes.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
