---
title: 'Debounce input handlers'
status: active
tags: [workflow, planned, production-readiness, performance, react]
updated: 2026-09-16
stage: planned
kind: plan
---

# 08 — Debounce input handlers

## Goal

No keystroke, scroll frame, resize, or drag triggers a network request or an expensive computation. Every high-frequency handler in the app uses the right rate-limiting primitive, chosen deliberately.

## Current state

Only **15 of 2330** UI files reference `debounce` or `useDebounce`. Given the number of search boxes, filters, autosave surfaces, and map/scroll interactions in this app, that is the clearest signal in this checklist that the item is genuinely under-applied.

**Caveat before acting:** a low count is not proof of a defect. Some inputs are correctly un-debounced (local-only filtering of an already-loaded array is fine), and React Hook Form's uncontrolled inputs avoid the classic per-keystroke re-render. The audit must find the sites that actually issue a request or run an expensive computation per event.

## Phases

### Phase 8.1 — Inventory high-frequency handlers

Grep and classify every `onChange`, `onInput`, `onScroll`, `onResize`, `onDrag`, `onMouseMove`, plus every `useEffect` that depends on an input value and performs a fetch.

Classify each by what it triggers:

| Trigger                                                   | Correct primitive                                                         | Typical delay |
| --------------------------------------------------------- | ------------------------------------------------------------------------- | ------------- |
| Server search / filter query                              | **Debounce** trailing                                                     | 300–400 ms    |
| Typeahead / autocomplete                                  | **Debounce** + `AbortController`                                          | 200–300 ms    |
| Autosave (settings, drafts, editor content)               | **Debounce** trailing + flush on blur/unmount                             | 800–1500 ms   |
| Local array filter, already loaded                        | Nothing, or `useDeferredValue`                                            | —             |
| Scroll position, sticky headers, infinite-scroll sentinel | **Throttle** via `requestAnimationFrame`, or IntersectionObserver instead | 1 frame       |
| Window resize / breakpoint                                | **Throttle** + `ResizeObserver`                                           | 100–150 ms    |
| Drag (calendar range select, dnd-kit, canvas)             | `requestAnimationFrame`, never a timer                                    | 1 frame       |
| Validation (Zod)                                          | On blur + on submit; debounce only if async                               | —             |
| Analytics events                                          | **Throttle** leading, and never per keystroke (cost item)                 | —             |

**Debounce vs throttle is the decision that matters:** debounce waits for the pause (right for search), throttle fires at a fixed rate (right for scroll). Using debounce for scroll makes the UI feel stuck; using throttle for search fires many wasted queries.

### Phase 8.2 — One shared implementation

Create `ui/src/hooks/useDebouncedValue.ts` and `useDebouncedCallback.ts` (plus `useThrottledCallback`) with:

- Correct cleanup on unmount (a pending timer firing after unmount is a `setState` on a dead component).
- A `flush()` and `cancel()` handle — autosave must flush on blur, on route change, and on tab close.
- A stable identity so it does not itself cause re-renders (ties to doc 06).

Prefer `useDeferredValue`/`useTransition` over debouncing where the work is rendering rather than network — it keeps the input responsive without adding latency.

### Phase 8.3 — Apply to the specific surfaces

Known high-frequency surfaces in this app to audit explicitly:

- Bookings list search + filters
- Finance line-item filters and period selector
- Public property/parking search (`publicSearch.ts` backed — server cost per keystroke)
- Global/super-admin search
- Team member search, guest search
- Inbox thread search and message composer (typing indicator is already a separate throttled path — verify)
- Pricing calendar range drag
- Marketing Studio canvas interactions
- Property settings autosave surfaces
- AI assistant input (do **not** debounce send; debounce any live suggestion)
- Map viewport changes (also a billing event)

### Phase 8.4 — Cancel in-flight work

Debouncing reduces request count but does not prevent out-of-order responses. For every debounced fetch:

- Pass `AbortController.signal` and abort the prior request.
- With TanStack Query, put the debounced value in the query key so the cache handles dedupe and cancellation, rather than calling fetch manually inside an effect. This is the preferred pattern here.

**Edge case:** without abort or key-based cancellation, a slow first query can resolve after a fast second and overwrite the newer results with stale ones. This bug looks like "search shows the wrong results sometimes" and is common.

### Phase 8.5 — Server-side backstop

Client debouncing is a UX optimization, never a security control. Anyone can call the endpoint in a loop. Every search/autocomplete endpoint must also be rate-limited server-side (doc 23) — especially public, unauthenticated ones like property search.

### Phase 8.6 — Guard

- Playwright: type 10 characters quickly into each major search box and assert at most 1–2 network requests are issued (via `page.route` counting).
- Add these as `@smoke`-adjacent specs so a regression is caught in CI.

## Edge cases

- **Debounced autosave + navigation** — user edits, then immediately navigates. Without a flush on unmount/`beforeunload`, the edit is lost silently. This is a data-loss bug, the most severe failure in this doc.
- **Debounce + form validation** — showing an error mid-typing is hostile. Validate on blur; debounce only async uniqueness checks (slug, org name, property name — this repo has `orgNameConflict.ts`/`propertyNameConflict.ts` checks that are exactly this shape).
- **Empty query after clearing** — debouncing the clear action leaves stale results for the delay. Handle clear immediately, bypassing the debounce.
- **Minimum query length** — do not query on 1 character; require 2–3 for server search.
- **Composition events (IME)** — debouncing raw `onChange` during Japanese/Chinese/Korean input fires on intermediate composition state. Listen for `compositionend`.
- **Tests and timers** — debounced code needs fake timers in Vitest; forgetting this makes tests flaky rather than failing.
- **Accessibility** — a debounced live-updating result list must announce updates via a polite live region, and not steal focus mid-typing.

## Exit gate

- [ ] Every high-frequency handler inventoried and classified with its chosen primitive.
- [ ] Shared debounce/throttle hooks shipped with cleanup, `flush`, and `cancel`; ad-hoc `setTimeout` debouncing removed.
- [ ] All server-backed search/filter inputs debounced and keyed through TanStack Query (no manual fetch-in-effect).
- [ ] Autosave surfaces flush on blur, unmount, and route change — proven by a test that edits then navigates.
- [ ] Playwright request-count specs pass for every major search box.
- [ ] Public search endpoints rate-limited server-side (cross-check doc 23).
- [ ] IME composition handled on text inputs.

## Docs / Plans / activity-log

- **Docs:** route guides for pages whose search/filter behavior changes, `docs/PROJECT.md` for the shared hooks.
- **Plans / Team RBAC:** N/A.
- **activity-log:** N/A.
