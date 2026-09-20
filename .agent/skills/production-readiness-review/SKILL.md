---
name: production-readiness-review
description: >-
  Code review for production-readiness checklist phases 5–10 (unused deps,
  re-renders, skeletons, debounce, images, pagination). Verifies shipped work
  against each doc's exit gate, finds bugs/regressions, and gives a ship verdict.
  Use when the user runs /production-readiness-review or asks to review phases
  5–10 before moving to tier 2.
disable-model-invocation: true
---

# Production readiness review (phases 5–10)

Act as a **skeptical senior reviewer** of the Tier 1 backend-of-frontend work
(documents **05–10** under `docs/workflow/planned/production-readiness-checklist/`).

**Default:** review only. Do **not** edit code unless the user asks to fix findings.

Announce: `Using production-readiness-review for phases 5–10`.

## 0. Load the plan docs (mandatory)

Read every implementation-status section before touching code:

| Phase | Doc                             |
| ----- | ------------------------------- |
| 05    | `05-unused-dependencies.md`     |
| 06    | `06-unnecessary-rerenders.md`   |
| 07    | `07-loading-skeletons.md`       |
| 08    | `08-debounce-input-handlers.md` |
| 09    | `09-compress-images.md`         |
| 10    | `10-paginate-large-lists.md`    |

Also read `README.md` status ledger. **Do not redo** work marked done in prior
passes (00–05 on branch `feature/production-readiness-00-05`). Focus on what
06–10 claim to have shipped vs what is explicitly deferred.

## 1. Resolve scope

1. **Git diff** — uncommitted changes + `origin/develop...HEAD` (or `develop...HEAD`).
2. Map every changed file to its phase (05–10).
3. If the user named a subset (e.g. "only phase 10"), narrow to that.

State scope in one line before reviewing.

### Expected touch surfaces (grep if diff is unclear)

| Phase | Typical paths                                                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 05    | `package.json`, `bun.lock`, `knip`, `scripts/README.md`                                                                                             |
| 06    | `GuestAuthContext.tsx`, `GuestForm.tsx`, `BookingEditForm.tsx`                                                                                      |
| 07    | `useDelayedLoading.ts`, `RouteFallback.tsx`, `BookingTable.tsx`                                                                                     |
| 08    | `useDebouncedCallback.ts`, `useThrottledCallback.ts`, `InboxPage.tsx`                                                                               |
| 09    | `ui/public/**`, `hero-banner.png` removal                                                                                                           |
| 10    | `databaseService.ts`, `financeService.ts`, migration `*stay_date_sort*`, `check-unbounded-select.sh`, `super-admin-overview/index.ts`, CI workflows |

## 2. Per-phase review checklist

For **each** phase, answer:

1. **Completeness** — Does shipped code match the doc's "Implementation status"? Are deferred items honestly deferred (not silently skipped)?
2. **Correctness** — Edge cases from the doc (Manila dates, `isFetching` vs `isLoading`, debounce feedback loops, SQL generated columns, pagination off-by-one, tenant scoping).
3. **Regressions** — Booking workflow, guest form step validation, finance totals, inbox search, super-admin limits.
4. **Production readiness** — No dev-only shortcuts, no unverified paid features (Storage transforms), no security/tenancy holes in pagination paths.
5. **Exit gate** — Tick what is met vs still open; do not mark a phase "done" if exit gate items remain unless the doc already says partial.

### Phase-specific must-checks

**05 — Unused dependencies**

- Removals (`posthog-node`, `vercel`) have zero remaining imports/scripts references.
- `bun run audit:deps` / lockfile consistent; no accidental breakage of lazy chunks (Marketing Studio, maps, PDF).
- Date-library consolidation: confirm still deferred, not half-migrated.

**06 — Re-renders**

- `GuestAuthContext` `useMemo` deps complete and stable.
- `GuestForm` scoped `useWatch` did not break `canProceed` / step validation.
- `BookingEditForm` whole-form watch still covers `bookingEditPayloadFromValues` fields (petType class of bug).
- No new inline context values on hot paths.

**07 — Skeletons**

- `useDelayedLoading` show-delay + min-visible semantics correct; no `setState` after unmount.
- Route fallbacks: only show-delay applies under Suspense (documented limitation).
- No skeleton gated on `isFetching`.
- a11y: `role="status"`, `aria-live`, skeletons `aria-hidden`.

**08 — Debounce**

- Shared hooks: cleanup on unmount, `flush`/`cancel` where documented.
- `InboxPage` migration preserves 300ms behavior; no stale search results.
- Bidirectional draft/sync patterns (`BookingFilters`, `FinanceLedgerToolbar`) left alone unless broken.

**09 — Images**

- Dead `hero-banner.png` truly unreferenced; no broken asset URLs.
- No premature Storage transform / `srcset` wiring without paid feature + cost guard.
- Upload pipeline (`prepareUpload`, `guest-documents` gate) untouched and still documented.

**10 — Pagination**

- Migration: generated columns IMMUTABLE-safe; NULL on bad dates; indexes present.
- `listBookings` fast path preconditions match doc (scope, sort, union exclusions).
- Fallback path still correct for org-wide / `status_priority` / date-range filters.
- `fetchAllBookingsForFinance` SQL filter matches in-memory safety net; totals unchanged.
- `check-unbounded-select.sh` runs in CI; allowlist not masking real unbounded queries in changed files.
- `super-admin-overview` limit consistent with sibling queries.

## 3. Cross-cutting review

Also run the **`self-review`** skill checklist sections **B, C, E, F** for the
diff scope (correctness, security/tenancy, regressions, performance). Skip Plans/RBAC
unless new host capabilities were added (these phases should be N/A).

Load when touched:

| Surface                   | Skill / rule                                             |
| ------------------------- | -------------------------------------------------------- |
| Booking dates / list sort | `booking-workflow`, `.cursor/rules/booking-workflow.mdc` |
| Mobile loading UX         | `mobile-responsive`                                      |
| Edge pagination           | `supabase-edge-functions.mdc`                            |
| Storage / images          | `docs/architecture/storage.md` §7.1                      |

## 4. Verification evidence

Run what applies (local only):

```bash
bun run ci:quality
# Phase 10 migration locally:
bun run db:migrate
# Phase 10 guard:
./scripts/dev/check-unbounded-select.sh
# Phase 05:
bun run audit:deps   # report-only, note false-positive patterns
```

For pagination: confirm migration applies cleanly; note if only static review was possible.

Do **not** claim **Ship** if `ci:quality` fails or a P0/P1 finding remains.

## 5. Output format

```markdown
## Production readiness review: phases 5–10

**Verdict:** Ship tier-2 prep | Ship with fixes | Not ready
**Scope:** <branch / commits / files>
**Evidence:** <ci:quality, migration, scripts, static review>

### Phase summary

| Phase | Shipped OK | Gaps / deferred (expected) | Findings |
| ----- | ---------- | -------------------------- | -------- |
| 05    | …          | …                          | …        |
| …     |            |                            |          |

### P0 — Must fix before tier 2

- [ ] …

### P1 — Should fix before merge

- [ ] …

### P2 — Should fix soon

- [ ] …

### P3 — Nice to have

- [ ] …

### Looks solid

- …

### Recommended before phase 11+

- …
```

Severity: same as `self-review` (P0 = data loss, security, broken core path).

## 6. Related

| Need                  | Use                                        |
| --------------------- | ------------------------------------------ |
| General module review | `/self-review`                             |
| CI only               | `/kh-check-before-pr`                      |
| Full checklist index  | `production-readiness-checklist/README.md` |
| Tier 2 work           | docs 11–17                                 |

## Don'ts

- Do not mark phases 06–10 exit gates complete when the plan doc says partial.
- Do not recommend prod Supabase deploy without **`kamewave`**.
- Do not implement fixes mid-review unless asked.
- Do not spawn review subagent swarms by default.
