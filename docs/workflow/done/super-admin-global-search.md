---
stage: done
title: 'Super Admin global search (⌘K)'
status: in-progress
tags: [planning, planned-modules, super-admin, admin, search]
updated: 2026-09-06
---

## Status (2026-09-05)

**Shipped.** `super-admin-search` edge fn (orgs/properties/parkings/tickets, bounded `ilike` fan-out) + `SuperAdminCommandPalette` (`cmdk`, mounted in `SuperAdminShell`, ⌘K/Ctrl-K). Verified: opens, returns real hits, Enter navigates.

**Remaining:** recent-searches (localStorage), a visible mobile entry point (currently keyboard-shortcut only), hosts as a search source.

---

# Super Admin global search (⌘K)

**Spun out of** [`super-admin-console-overhaul.md`](./super-admin-console-overhaul.md) Phase 6.

## Problem

Support work means "find org X", "find the host with email Y", "open property Z" — today that's
manual navigation + per-page search boxes. No cross-entity jump.

## Approach

- **Edge fn** `super-admin-search` (`serveSuperAdmin`, `?q=`): a single query fanning out over
  `organizations` (name/slug), `properties` (name/slug), `parkings` (name/slug), `support_tickets`
  (subject/submitter), and org owners (email via `hostSerialize` search). Return up to ~8 per
  group with `{ type, label, sublabel, href }`.
- **UI** — a `cmdk` palette mounted in `AdminLayout`, opened with ⌘K / Ctrl-K only on
  `/admin/*` paths. Debounced query → `super-admin-search`. Enter navigates to `href`
  (org → `/admin/orgs/:slug`, property → tenant dashboard, ticket → `/admin/support`, etc.).

## Phasing

- P1: `super-admin-search` edge fn + `useSuperAdminSearch` hook.
- P2: `cmdk` palette component + ⌘K binding gated to super-admin paths.
- P3: recent-searches (localStorage) + docs.

## Notes

- `cmdk` is already a dependency (used elsewhere).
- Keep the fan-out bounded (`ilike` + `limit` per source); no full-text index needed for v1.
