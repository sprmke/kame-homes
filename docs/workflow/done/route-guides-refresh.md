---
stage: done
title: 'Refine & Complete Route Guides (docs/guides/routes/)'
status: done
tags: [planning, planned-modules]
updated: 2026-08-01
---

# Refine & Complete Route Guides (`docs/guides/routes/`)

> **Status:** Done (2026-07-30) — Phases 0–3 complete and verification checklist passed.

## Context

`docs/guides/routes/` already has 45 operator guides following a solid template (fields, save-paths, API refs, implementation map). Two things have changed since most of them were written:

1. **Coverage has fallen behind the app.** The `/admin/*` super-admin layer has zero guides, several authenticated guest-portal pages (`account/stays`, `account/wishlist`, `account` index) are undocumented, and a batch of recent refactors (booking detail page rebuild, org routing changes, for-hosts marketing pages, guest auth/calendar/form flows) likely left their guides stale.
2. **The purpose of these docs has expanded.** They were written as engineer-facing technical references. The goal now is to reuse them as product-knowledge context for an AI receptionist / dashboard assistant that answers host questions ("why can't I edit this booking?", "what does PENDING_DOCUMENTS mean?"). The current template has no content shaped for that — it's all fields/API/save-path detail.

There's also known drift in the docs-about-docs: `docs/guides/routes/README.md` has at least one status out of sync with its guide, and `.claude/skills/route-guides/SKILL.md`'s hardcoded route→file mapping table is missing parking, inbox, team, and all public marketing routes.

This plan phases the work: fix the template and meta-drift first (everything downstream depends on the template shape), then close coverage gaps, then refresh stale guides, then do a full pass adding the new host-facing section to the remaining guides and finishing the last stub guides. This is multi-session work.

## Phase 0 — Template & meta fixes (foundation, do first)

1. **Update `docs/guides/_template.md`** — add a new section after "Overview" (before the per-page `## [Section name]` breakdown):

   ```
   ## Host-facing knowledge
   <One short paragraph: what this page/feature does, in plain language.>

   **Common host questions**
   - Q: <question a host might ask>
     A: <plain-English answer, no jargon, no internal file paths>
   - Q: ...
   ```

   This section is written for an AI assistant to quote directly to hosts — no code, no DB column names, no internal endpoint names.

2. **Update `.claude/skills/route-guides/SKILL.md`** (and mirrored `.cursor/skills/route-guides/SKILL.md`, `.cursor/rules/route-guides.mdc`):
   - Add "Host-facing knowledge" to the section checklist and writing rules (plain language, Q&A format, no technical leakage).
   - Replace the hardcoded "Route → file mapping" table with a pointer to `docs/guides/routes/README.md` as the single source of truth — the duplicate table is what went stale. Keep one authoritative index, not two.

3. **Fix `docs/guides/routes/README.md` drift**: `org/property/dashboard.md` is marked "Pending" in the index but the guide itself says "Documented" — correct the index. Do a quick pass across the whole index table for any other status mismatches while touching this file.

**Phase 0 result:** Done.

## Phase 1 — Close coverage gaps (new guides, concrete list)

Each new guide uses the full template including the new Host-facing knowledge section from the start.

**`/admin/*` super-admin layer** (new `docs/guides/routes/admin/` directory):

- [x] `admin/overview.md` — `/admin` (SuperAdminOverviewPage)
- [x] `admin/developments.md` — `/admin/developments` (SuperAdminDevelopmentsPage)
- [x] `admin/development-detail.md` — `/admin/developments/:developmentSlug` (SuperAdminDevelopmentDetailPage)
- [x] `admin/approvals.md` — `/admin/approvals` (SuperAdminApprovalsPage)
- [x] `admin/hosts.md` — `/admin/hosts` (SuperAdminHostsPage)
- [x] `admin/platform-properties.md` — `/admin/properties` (SuperAdminPlatformPropertiesPage)
- [x] `admin/host-detail/orgs.md` — `/admin/hosts/:hostId/orgs` (SuperAdminHostOrgsPage)
- [x] `admin/host-detail/properties.md` — `/admin/hosts/:hostId/orgs/properties` (SuperAdminHostPropertiesPage)
- [x] `admin/org-properties.md` — `/admin/orgs/:orgSlug/properties` (SuperAdminPropertiesPage)

**Guest portal gaps** (under existing `docs/guides/routes/account/`):

- [x] `account/index.md` — `/account` (GuestAccountIndexPage)
- [x] `account/stays.md` — `/account/stays` (GuestTripsPage)
- [x] `account/wishlist.md` — `/account/wishlist` (GuestWishlistPage)
- [x] `account/messages.md` — `/account/messages` (GuestMessagesPage) — distinct from `properties/chat.md`

**Verification-only tasks** (no new guide unless confirmed live):

- [x] Confirm `GuestAccountSettingsPage` is dead/unrouted — yes; `/account/settings` → profile
- [x] Confirm `PropertyCalendarPage` is dead/unrouted — yes (live calendar is `CalendarPage`)
- [x] Confirm `orgInboxRoute` helper unused — yes; org inbox wired inline

Update `docs/guides/routes/README.md` with all new rows — Done (Super-admin table + account rows).

## Phase 2 — Refresh stale guides (recent refactors)

- [x] `org/property/bookings-detail.md`
- [x] `org/dashboard.md` / `org/property/dashboard.md`
- [x] `for-hosts.md`
- [x] `calendar.md`, `form.md`, `auth.md`

## Phase 3 — Full pass

- [x] Host-facing knowledge on every remaining guide (61/61)
- [x] Finish Pending stubs: `form.md`, `success.md`, `sd-form.md`, `bookings/parking.md`, `org/property/finance.md`
- [x] Spot-check marketing: `/hosts/:orgSlug`, property/development form sub-routes, `/parkings/:slug/form`
- [x] Full route-tree audit vs README (2026-07-30 follow-up): added missing `/accept-invite` guide; parked form + guest-review legacy redirect indexed

## Verification

- [x] Guide paths mirror URL segments
- [x] `docs/guides/routes/README.md` synced — every live route has a matching guide row (or intentional parent fold)
- [x] Host-facing sections present with Q&A; template instruction lines removed; path/jargon softened for receptionist use
- [x] Implementation-map paths verified for Phase 1/2 priority guides (208 entries; abbreviated paths expanded)
- [x] Dead-route verification recorded in `account/index.md` as completed checkboxes
- [x] Confirmed dead/unrouted pages still skipped: `GuestAccountSettingsPage`, `PropertyCalendarPage`
- [x] Confirmed unused route helpers still skipped: orphaned `guestFormRoutes` / `guestCalendarRoutes` / `sdFormRoutes` / `payParkingRoutes` / unused `orgInboxRoute` export
