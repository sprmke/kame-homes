---
title: 'Debounce input handlers'
status: active
tags: [workflow, planned, production-readiness, performance, react]
updated: 2026-09-17
stage: planned
kind: plan
---

# 08 — Debounce input handlers

## Implementation status (2026-09-17)

**Phase 8.2 (shared implementations): shipped.** `ui/src/hooks/useDebouncedCallback.ts` (trailing debounce with `flush()`/`cancel()`, timer cleanup on unmount) and `ui/src/hooks/useThrottledCallback.ts` (leading + trailing `requestAnimationFrame` throttle with `cancel()`) — `useDebouncedValue.ts` already existed. No Vitest coverage added for these: this repo's Vitest config runs `environment: 'node'` with no React Testing Library in the dependency tree (`vitest.config.ts`) — hook/interaction behavior is covered by Playwright per this doc's own Phase 8.6 and the repo's `testing` skill, not Vitest. Confirmed via `bun run lint`/`type-check` instead.

**Phase 8.1/8.3 (audit named surfaces): re-verified against actual code, not assumed from the search box's presence.** The doc's own "Current state" caveat — "a low count is not proof of a defect... local-only filtering of an already-loaded array is fine" — turned out to cover every site initially flagged in this pass's scoping survey:

| Site                                                         | Initial read                             | Actual                                                                                                                                              |
| ------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TeamMembersTab.tsx:167`, `OrgTeamMembersTab.tsx`            | looked like an undebounced server search | **Local `useMemo` filter over already-loaded `members`** — correctly un-debounced, left alone                                                       |
| `InboxQuickRepliesTab.tsx:85`, `PermissionsTreeView.tsx:342` | same                                     | **Local `useMemo` filter over already-loaded `templates`/permission catalog** — left alone                                                          |
| `InboxThreadList.tsx:142` (`onSearch`)                       | looked raw/undebounced                   | **Already debounced one level up**, in `InboxPage.tsx` via an ad-hoc `useEffect` + `setTimeout(300)` — not undebounced, just not on the shared hook |

**Fixed:** `InboxPage.tsx` — migrated its ad-hoc `setTimeout`-based search debounce onto `useDebouncedValue`, removing one of the three ad-hoc debounce implementations found in the initial survey. Net: identical 300ms behavior, one fewer hand-rolled timer.

**Deliberately left as ad-hoc, not migrated:** `BookingFilters.tsx` (lines ~75-93) and `FinanceLedgerToolbar.tsx` (lines ~50-67) implement a **bidirectional** pattern — a local `draft`/`searchDraft` echoes an externally-controlled `query.q` (can change from outside via URL params or a filter reset) via one effect, while a second effect debounces `draft` back out through `onChange`. `useDebouncedValue`/`useDebouncedCallback` are one-directional (raw value in, debounced value/call out) and do not model the external-resync half of this without restructuring the component. Forcing this onto the shared hook risks a feedback-loop regression (external reset fighting the debounce, or the first-mount-skip guard breaking) for a purely cosmetic "one implementation" win with no functional defect to fix. Both already work correctly today — left alone.

**Not attempted this pass:** a full Phase 8.1 inventory across every `onChange`/`onScroll`/`onResize`/`onDrag` in ~2330 files, Phase 8.4's per-call-site `AbortController`/query-key audit, and Phase 8.6's Playwright request-count specs — each requires either exhaustive manual verification per surface (the same "don't trust the grep, verify the actual behavior" lesson this pass just proved necessary) or a live browser session. The two new hooks are shipped and ready for use as this work continues; no additional consumers were force-migrated without a confirmed defect.

## Measured before / after

| Metric                                  | Before                                                | After                                                                      | Difference                           |
| --------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| Shared debounce/throttle                | `useDebouncedValue` only                              | + `useDebouncedCallback` (`flush`/`cancel`) + `useThrottledCallback` (rAF) | New call sites have one primitive    |
| Inbox thread search                     | Ad-hoc `useEffect` + `setTimeout(300)` in `InboxPage` | `useDebouncedValue` 300 ms                                                 | Same UX, one fewer hand-rolled timer |
| Team / permissions / quick-reply search | Looked undebounced                                    | Local `useMemo` over already-loaded arrays                                 | Correctly left alone                 |
| Bookings / finance search               | Bidirectional draft ↔ URL                             | Left on existing two-effect pattern                                        | No feedback-loop rewrite             |
| Playwright request-count specs          | None                                                  | None                                                                       | Still open                           |

## Remaining work to finalize

Shared `useDebouncedCallback` / `useThrottledCallback` and the inbox search conversion are shipped. Inventory and proof are not.

| #   | Work                                                                                              | Blocker           |
| --- | ------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Finish the full high-frequency handler inventory (search, resize, scroll, drag, autosave, maps).  | Code audit        |
| 2   | Replace remaining ad-hoc `setTimeout` debounce with the shared hooks where the inventory says so. | Code              |
| 3   | Playwright specs that assert request count while typing (inbox, bookings search, public search).  | Playwright        |
| 4   | IME / composition handling on search fields (do not fire mid-composition).                        | Code + Playwright |
| 5   | Autosave flush-on-unmount / flush-on-submit tests (`useDebouncedCallback.flush`).                 | Tests             |
| 6   | Cross-check authenticated write bursts with doc 23 rate limits.                                   | Doc 23            |

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
