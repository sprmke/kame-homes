---
title: 'Activity — operator guide'
status: active
tags: [guides, routes, org, activity, audit-log]
updated: 2026-09-27
---

# Activity — operator guide

Route: `/org/:orgSlug/settings` → **Activity** section → **Manage** (modal). Legacy `/org/:orgSlug/activity` redirects to `/org/:orgSlug/settings?open=activity` (modal auto-opens). No org-sidebar link.

> **Status:** Documented

## Progress overview

| Section    | E2E save | Validation | Docs       | Notes                                                                                                                                                      |
| ---------- | -------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed       | n/a      | n/a        | Documented | Read-only. Infinite scroll in the modal scrollport, keyset pagination, 90-day default, container-virtualized past ~30 rows, live-refreshes on new activity |
| Filters    | n/a      | n/a        | Documented | Search + Filters (category / severity / dates) + Export; mobile: search + refine sheet + export icon; shared `AdminListDesktopToolbar`                     |
| Detail     | n/a      | n/a        | Documented | Row → sheet with actor, changes diff, IP prefix, metadata. Summaries soft-replace plan UUIDs with names when metadata has `to_plan_name`                   |
| Export CSV | n/a      | n/a        | Documented | Owner / org-admin only; `activityLogExport` plan gate (Starter+)                                                                                           |

---

## Overview

Org-wide **activity / audit timeline** — every meaningful action across the organization: team members, the org owner, super-admins acting on the org, the AI dashboard assistant, guests on public pages, cron jobs, inbound webhooks. Answers "who did what, when, from where, and (for edits) exactly what changed". Destructive actions (deletes, cancellations, refunds, member removals) are flagged.

Data is written **fire-and-forget** by `_shared/activityLog.ts` (never blocks a mutation) into the append-only `public.activity_log` table and read through `list-activity-log`. See `docs/workflow/in-progress/org-activity-audit-log.md` and `docs/architecture/data-model.md`.

## Sections

### Feed

- Newest first, keyset-paginated (loads more on scroll inside the Manage modal). Default window is the **last 90 days** unless a date range is set.
- Each row: a category glyph, the past-tense summary (plan UUIDs softened to names when `to_plan_name` is present), the actor (name / email + type), a relative timestamp (hover for the Asia/Manila absolute time), the target label, and a short list of changed fields. A severity chip sits beside the summary for `notice` / `warning` / `destructive`.
- **Scope:** this page shows **all** org, property, and parking activity for the org. The property- and parking-scoped Activity pages show only that listing's rows.
- **Long feeds are virtualized** against the modal scrollport (Inbox pattern) — past ~30 loaded rows only the visible window is in the DOM. Page embeds (super-admin, entity history) still use window virtualization.
- **Live refresh** — a Postgres Broadcast trigger on `activity_log` pushes a minimal ids-only signal on the private `activity:org:<orgId>` topic; `useActivityRealtime` (mounted once in `NotificationsProvider`) debounce-invalidates the feed so new rows appear without a manual reload. No row content travels over the channel — the client refetches through `list-activity-log`, which still enforces scoped visibility.

### Export CSV

- **Owner / org-admin only** (`activity-log-export` returns 403 for listing-scoped members).
- **Plan gate:** `activityLogExport` — Starter (`starter` / `commission`) and above. On Free the button opens the upgrade modal; in-app viewing of the log stays free on every plan. Platform admins bypass the gate.
- Streams the current filtered view (default last 90 days, capped 20k rows).

### Filters

- **Search** — debounced; matches the summary and target label. Mobile: search + refine sheet + export icon. Desktop: Filters · search · Export CSV (`AdminListDesktopToolbar`).
- **Filters / refine** — organized sections (same on desktop popover and mobile sheet):
  - **Category** — multi-select dropdown; default **All categories** (Bookings, Parking, Team, Pricing, Finance, Maintenance, Marketing, Inbox, Settings, Property, Organization, Integrations, Verification, Plans & billing, Public pages, Guest, Security, System).
  - **Severity** — single-select; default **All**; options **Info**, **Notice**, **Warning**, **Destructive** (matches `activity_log.severity`).
  - **Date range** — one field that opens the shared range calendar (`mode="range"`, same pattern as bookings date filter). Default label **Any** (server still applies the 90-day window). Apply writes inclusive `dateFrom` / `dateTo`; Clear on the field or Clear in the Filters header resets it.
- Empty state offers **Clear filters** when the current view has no rows (toolbar has no separate Clear all row).

### Detail sheet

Clicking a row opens a sheet with: severity, actor (display name / email + one role label), absolute timestamp, source (friendly label), target, the truncated client IP (`/24` or `/48`), device (browser + OS, not the raw user-agent), host-safe metadata facts (e.g. Plan name), and a **Changes** table when present. Internal refs (`related_event_ref`, plan UUIDs) and raw JSON are not shown. Plan UUIDs in summaries are resolved to plan names by `list-activity-log` when possible.

## Permissions

Gated on **`org.activity:view`** (org Team catalog, module "Activity"). Owners and platform admins always see the full log. An org admin without the leaf falls back to the listing-scoped view (only listings where they hold `activity:view`, never org-scope rows), and the Settings → Activity section is hidden. Existing org admins were backfilled with the leaf; the built-in Full Access preset includes it. Property/parking-scoped members do not see org-scope rows and see only rows for listings where they hold `activity:view`.

## Entity activity panels

The reusable `<EntityActivityHistory targetType targetId>` panel (compact feed for one entity, "Show more" to expand) is embedded on:

- **Booking detail** — Overview tab (`targetType="booking"`).
- **Team member** — the org Manage Member dialog (`targetType="member"`).
- **Finance line item** — the edit transaction modal (`targetType="finance_entry"`).
- **Maintenance reminder** — the edit reminder modal (`targetType="maintenance_item"`).

All of these read through `list-activity-log?targetType=&targetId=` (no dedicated endpoint) and pick up the same realtime invalidation.

## Super-admin

`/admin/orgs/:orgSlug` → **Activity** section has a toggle: **Platform actions** (`super_admin_audit_events` for that org, unchanged) / **Org activity** (that org's `activity_log` via `list-activity-log` with an explicit `orgId`; a super-admin resolves as `platform_admin` and sees every row).

---

## Testing

| Layer | Path / spec                                                      | Manual     |
| ----- | ---------------------------------------------------------------- | ---------- |
| Unit  | `activityLog.ts` catalog helpers                                 | —          |
| E2E   | `ui/e2e/features/org/orgHubSmoke.spec.ts` activity shell (`@ci`) | CSV export |

## Related

- Property: [org/property/activity.md](./property/activity.md) · Parking: [org/parking/activity.md](./parking/activity.md)
- Plan matrix: [`docs/architecture/plans-feature-matrix.md`](../../../architecture/plans-feature-matrix.md) (`activityLogExport`).
- Retention: monthly `activity-log-retention-cron` purges rows past `platform_settings.activity_log_retention_months` (default 24). See `docs/archive/operations/scheduled-jobs-and-testing.md`.
- Governance: `audit-logging` skill / `.cursor/rules/audit-logging.mdc`.
