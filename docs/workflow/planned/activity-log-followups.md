---
stage: planned
title: 'Org Activity & Audit Log — follow-ups (RBAC leaves, cron rows, notice emitters, partitioning)'
status: planned
tags: [workflow, planned, activity-log, audit-log, rbac, governance]
updated: 2026-09-10
kind: plan
---

# Org Activity & Audit Log — follow-ups

**Split from** [`../in-progress/org-activity-audit-log.md`](../in-progress/org-activity-audit-log.md) on 2026-09-10 so the core plan (Phases 0–6) can close to `for-testing`. **None of these block the feature.** The always-on `audit-logging` rule + skill keep coverage from rotting — any _new_ change to the surfaces below must still emit or mark N/A.

## Items

### 1. Dedicated Activity RBAC leaves

`org.activity:view` / `org.activity:export` + `property.activity:view` / `property.activity:export`, seeded into the Full Access / Operations / Read Only templates via a data migration (precedent: `granular-team-permissions`).

- **Why deferred:** touches the ~1.5k-line team-permission catalogs on both server (`_shared/orgTeamPermissions.ts`, `propertyTeamPermissions.ts`) and client (`propertyTeamConstants.ts`, `propertyPermissionCatalog.ts`, org equivalents) + a seeded-template migration.
- **Current gate (correct + safe):** `list-activity-log` / `activity-log-export` key on `accessKind` — owner / org-admin / platform-admin see all; listing-scoped members see only their assigned property / parking rows and never `scope='org'`. Export is additionally owner/org-admin + `activityLogExport` plan feature.
- **Scope when started:** add the four leaves, wire the route/nav filters to them (replacing the current `org.dashboard:view` / `bookings:view` reuse), seed migration, update `plans-feature-matrix.md` RBAC section + the three route guides. Parking stays coarse until parking granular RBAC ships.

### 2. `system.cron_run` per-run summary rows

One row per run for `sd-refund-cron`, `contract-expiry-cron`, `calendar-sync-cron`, `smart-pricing-cron`, parking expiry / reminder crons, `platform-billing-cron`, `analytics-ai-review-cron`, etc. — e.g. "SD refund cron advanced 3 bookings to PENDING_SD_REFUND".

- **Why deferred:** every cron-driven _transition_ already lands a `booking.status_changed` / parking status row (per Open Question 7), so the feed is not missing events — this is a nicer operational roll-up, not a coverage gap.
- **Scope:** a thin `logCronRun({ cron, message, counts })` helper called at the end of each cron's `run()`; `system.cron_run` catalog entry already exists.

### 3. Low-value `notice`-tier emitters

`upload-app-settings-asset` / `upload-org-settings-asset` / `upload-parking-settings-asset` (`settings.asset_uploaded`), `telegram-*-settings` ×8 (`integrations.config_changed`), `ai-platform-*` super-admin quota overrides, `marketing-music`, `settings-verification` OTP `security.*` events.

- **Why deferred:** low signal-to-noise; the always-on rule already forces any future change to these handlers to emit.
- **Scope:** one `logAssetActivity` / `logActivity` call per handler after the write succeeds. Catalog entries mostly exist (`settings.asset_uploaded`, `integrations.config_changed`); add `security.otp_requested` / `_verified` / `_failed` if OTP events are wanted.

### 4. `guest.support_ticket_filed` / `guest.profile_updated` handlers — needs a scoping decision first

Catalog entries exist; handlers are intentionally unwired.

- **The problem:** neither maps cleanly to "one action against one org."
  - **Support tickets** (`submit-support-ticket` / `reply-support-ticket` / `reopen-support-ticket`): the `host` channel is a team member filing a _platform_ support ticket — not an org / property / parking state mutation. The `guest` channel has no org root at all (`resolveSupportTicketScope` returns `org: null`).
  - **Guest profile** (`guest-profile`): a guest-portal identity is global to the guest, not scoped to one org. A guest with bookings across N orgs — which org's feed gets the row?
- **Decision needed:** (a) record host-channel support tickets as `team_member` activity on `scope.org.id` and skip guest-channel + guest-profile entirely; or (b) fan a guest-profile edit out to every org the guest has an active/upcoming booking with; or (c) drop both catalog entries and leave support tickets / guest profiles out of the activity log.
- **Recommendation:** (a) — minimal, honest, no fan-out. Wire `submit-support-ticket` / `reply-support-ticket` / `reopen-support-ticket` with a `team_member` actor when `scope.org` is non-null; drop `guest.profile_updated`.

### 5. Monthly range partitioning of `activity_log`

- **Why deferred:** a table-swap migration that needs a maintenance window + a load test against prod-like volume. The composite `PRIMARY KEY (id, created_at)` was chosen so it is **not** a rewrite.
- **Migration path:** documented in `docs/archive/operations/migration-runbook.md` § 11c.1 — `CREATE TABLE activity_log_part (LIKE ... INCLUDING ALL) PARTITION BY RANGE (created_at)` → pre-create month partitions (or `ATTACH` the existing table as the historical partition) → `INSERT … SELECT` → swap names in one transaction → recreate the `_block_mutation` + `_broadcast` triggers on the partitioned parent.
- **Until then:** BRIN + btree indexes + the monthly `activity-log-retention-cron` (default 24-month window) keep the single table healthy for millions of rows.

## Out of scope

- Anything in Phases 0–6 of the parent plan — all shipped (see its ledger).
- Guest web-chat logging — decided out (Open Question 2).
- Per-plan `activityLogRetentionDays` window — decided out (Open Question 1).

## Verification (no automated suite in this repo)

- `bun run type-check` / `lint` / `build` clean; `bun run test:edge` for any new `_shared` helper.
- Each new emitter: trigger the handler locally, confirm exactly one `activity_log` row with the right `action` / `category` / `severity` / `actor_type` / scope.
- RBAC leaves: a member with only `*.activity:view` sees the feed; without it the route/nav entry is hidden and `list-activity-log` 403s.

## Related

- Parent: [`../in-progress/org-activity-audit-log.md`](../in-progress/org-activity-audit-log.md)
- Governance: `audit-logging` skill · `.cursor/rules/audit-logging.mdc`
- `docs/architecture/data-model.md` (`activity_log`) · `docs/architecture/plans-feature-matrix.md` (`activityLogExport`)
