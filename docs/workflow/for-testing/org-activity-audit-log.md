---
stage: for-testing
title: 'Org Activity & Audit Log — every team action across org, property, and parking'
status: in-progress
tags: [in-progress, audit-log, activity-log, org, property, parking, rbac, governance]
updated: 2026-09-10
---

# Org Activity & Audit Log

## Implementation status (2026-09-06)

**Phase 0 — Foundation + governance: DONE.**

- [x] `supabase/migrations/20261306150000_activity_log.sql` — append-only table, composite PK `(id, created_at)`, 8 indexes + BRIN, CHECK constraints, RLS-on/no-policies, `activity_log_block_mutation()` guard trigger. Applied + functionally tested on local (append-only rejection, retention-bypass GUC, scope/target check). **Filename note:** landed at `20261306150000` (after the latest existing migration), not the `20261305130200` slot this doc originally named — that would have sorted before already-applied migrations.
- [x] `supabase/functions/_shared/activityLog.ts` — `logActivity` / `logActivityBatch` / `buildActorContext` / `diffRecord` / redaction / `ACTIVITY_ACTION_CATALOG` / `truncateIp` / `extractRequestContext`. `deno check` clean (repo baseline); 9 Deno tests in `_shared/activityLog_test.ts` pass.
- [x] `supabase/functions/list-activity-log/index.ts` + `config.toml` entries (`list-activity-log`, `activity-log-export` placeholder) — keyset pagination, listing-scoped visibility via `resolveAssignedListingIdsForOrgUser`.
- [x] `ui/src/features/dashboard/activity/lib/activityCatalog.ts` — client mirror (exhaustive category → icon / label, severity meta, `ActivityEvent` DTO). `tsc` + lint clean.
- [x] Governance: `.agent/skills/audit-logging/SKILL.md` (+ `.cursor`/`.claude` symlinks), `.cursor/rules/audit-logging.mdc` (`alwaysApply: true`), `opencode.json` instruction, `CLAUDE.md` section + table row + "before done" checklist line, `.cursor/rules/README.md` / `.claude/README.md` rows, `documentation-maintenance` (`.mdc` + skill) checklist line, `supabase-edge-functions.mdc` contract line. `check:ai-tooling-sync` → OK.
- [ ] **Deferred → backlog** ([`../planned/activity-log-followups.md`](../planned/activity-log-followups.md)): dedicated `org.activity:view` / `:export` + `property.activity:view` / `:export` RBAC leaves + seeded-template data migration. v1 `list-activity-log` gates on `accessKind` (owner / org-admin / platform-admin see all; listing-scoped members see their listings) — no new leaf. Adding the leaves touches the 1.5k-line team-permission catalogs.

**Phase 1 — High-value emitters: DONE.**

- [x] `WorkflowOrchestrator.transition()` optional `actor?: ActorContext` param + **one** emit near the end (`booking.status_changed` / `booking.cancelled` / `booking.document_substep_completed`) + all **11** call sites pass an actor (`transition-booking`, `cancel-booking`, `submit-sd-form` guest, `approval-email-webhook` email-inbound, `import-revert` bulk, `sd-refund-cron`, `calendarSyncRun`, `dashboardAssistantTools` ×3, `dashboardAssistantBookingAssetTools`, `parkingPaymentOrchestrator`) + the internal auto-advance recursion forwards `actor`.
- [x] `supabase/functions/_shared/parkingActivity.ts#logParkingStatusChange` + wired at 7 parking status-write sites (`transition-parking-booking`, `parkingCancellation` ×2, `parkingBroadcastActions` claim + decline, `parkingBroadcastExpireCron` → `NO_HOST_AVAILABLE`, `parkingPaymentOrchestrator` → `PENDING_REVIEW`). `claim-parking-booking` / `decline-parking-booking` handlers thread their `verifyParkingTeamAccess` actor.
- [x] `supabase/migrations/20261306150100_activity_log_guest_submissions_trigger.sql` — `trg_activity_log_guest_submissions`, `WHEN` end-user JWT only, `status`/workflow columns excluded, allow-listed changed-column-name diff, `EXCEPTION WHEN others` non-fatal. Applied + functionally tested (service-role skipped, authed edit logged, workflow-only edit not logged, delete logged).
- [x] `org.deleted` / `property.deleted` / `parking.deleted` in `delete-organization` / `delete-property` / `delete-parking`.
- [x] **Team & RBAC — all 3 scopes** via `_shared/teamActivity.ts#logTeamActivity` (one-liner helper): `org` / `property` / `parking` `-team-members` (`team.member_removed` on DELETE, `team.member_permissions_changed` on PATCH), `-team-invitations` (`team.invite_sent` / `team.invite_resent` / `team.invite_revoked`), `-team-custom-roles` (`team.custom_role_created` / `_updated` / `_deleted`).
- [x] `booking.created` on `submit-form` (guest, `channel: guest_form`); `booking.bulk_imported` on `import-commit` (one batch summary row, `metadata.count`). Also fixed a **pre-existing** `batchError` redeclaration SyntaxError in `import-commit/index.ts` (present on `develop` HEAD) so the function loads.
- [x] `team.invite_accepted` on `accept-org/property/parking-invite`.
- [x] Lifecycle create/update: `org.created` / `org.updated`, `property.created` / `property.updated` (field-level `diffRecord`), `parking.created` / `parking.updated` (diff). `create-organization` also emits `property.created` / `parking.created` for a bundled first listing (`via: org_onboarding`).

**Phase 2 — Settings / operational emitters: MOSTLY DONE (2026-09-07).**

- [x] New thin helper `supabase/functions/_shared/assetActivity.ts#logAssetActivity` — resolves `organization_id` from a property / parking id, builds the actor from the authenticated user, one row, never throws. Used by every property/parking-scoped handler whose access resolver does not hand back a full context.
- [x] Catalog additions (`_shared/activityLog.ts`): `settings.updated` (+ `metadata.area`), `settings.asset_uploaded`, `settings.template_saved` / `_deleted`, `public_pages.config_saved` / `.published`, `pricing.rates_updated` / `.dates_blocked` / `.dates_unblocked` / `.smart_config_changed` / `.smart_applied`, `finance.entry_created` / `_updated` / `_deleted` / `.report_exported`, `maintenance.task_created` / `_updated` / `_deleted`, `billing.checkout_started` / `.plan_downgraded` / `.plan_overridden_by_platform` / `.subscription_activated` / `.payment_succeeded` / `.payment_failed`, `verification.submitted` / `.approved` / `.rejected` / `.superhost_reassessed`, `integrations.connected` / `.disconnected` / `.config_changed`, `marketing.template_saved` / `_deleted` / `.published_to_meta` / `.external_review_moderated`, `inbox.settings_changed`, `ai.assistant_toggled` / `.config_changed`. All 9 `_shared/activityLog_test.ts` catalog-shape assertions still pass.
- [x] Settings: `app-settings` (area-classified), `parking-settings` (area + `payment_otp_verified`), `org-settings` (`area: socials`).
- [x] Pricing: `property-pricing` + `parking-pricing` (rates / overrides / block / unblock, one row per distinct change kind), `smart-pricing-settings` (`pricing.smart_config_changed`), `smart-pricing-apply` (`pricing.smart_applied` + `related_event_ref` → `property_smart_pricing_runs`; clear → config-changed).
- [x] Finance: `finance-line-items` (create / update / delete — `resolveFinanceAssetAccess` widened to return `orgId` + `accessKind` + `memberId`), `finance-export` (`finance.report_exported`).
- [x] Maintenance: `maintenance-items` (create / update / delete).
- [x] Plans & billing: `create-org-subscription-checkout` (`billing.checkout_started`), `apply-org-plan-downgrade` (`billing.plan_downgraded` **D**).
- [x] Verification: `submit-org-verification` (`verification.submitted`); `approve-org-verification` / `reject-org-verification` emit an org-scoped `verification.approved` / `.rejected` **mirror** row alongside the existing `logSuperAdminAction`.
- [x] Integrations: `calendar-sync-settings` (addFeed → connected, updateFeed → config_changed, removeFeed → disconnected **D**, setExportEnabled ×2 → config_changed), `voice-receptionist-settings` (`integrations.config_changed`), `meta-inbox-oauth-complete` (`integrations.connected`), `meta-inbox-disconnect` (`integrations.disconnected` **D**).
- [x] Templates / public pages: `property-templates-settings` (create / reset / edit-custom / edit-builtin → `settings.template_saved`; delete → `settings.template_deleted` **D**), `custom-pages-settings` (`settings.template_saved`), `public-page-configs` (`public_pages.config_saved` / `.published`).
- [x] Marketing / inbox / AI: `marketing-templates` (save / delete **D**), `publish-to-meta` (`marketing.published_to_meta` warning), `moderate-external-review` (`marketing.external_review_moderated`, super-admin actor), `social-inbox-settings` (`inbox.settings_changed`), `dashboard-assistant-settings` (`ai.assistant_toggled` / `ai.config_changed`).
- [ ] **Deferred → backlog** ([`../planned/activity-log-followups.md`](../planned/activity-log-followups.md)) **(low-value `notice` tier):** `upload-app-settings-asset` / `upload-org-settings-asset` / `upload-parking-settings-asset` (`settings.asset_uploaded`), `telegram-*-settings` ×8 (`integrations.config_changed`), `ai-platform-*` super-admin quota overrides, `marketing-music`, `smart-pricing-cron` autopilot summary, `settings-verification` OTP `security.*` events. The always-on `audit-logging` rule forces any _new_ change to these to emit.

**Phase 3 — Public & system emitters: MOSTLY DONE (2026-09-07).**

- [x] New thin helper `supabase/functions/_shared/guestActivity.ts#logGuestActivity` — resolves the org root from a booking's `property_id` / `parking_id`, builds a masked `public_form` + `guest` actor, one row, never throws.
- [x] Guest/public: `submit-sd-form` (`guest.sd_form_submitted`, alongside the orchestrator's `booking.status_changed`), `submit-guest-review` (`guest.review_submitted`), `claim-sd-voucher` (`guest.voucher_claimed` — only on a fresh award, not idempotent re-reads), `submit-pay-parking` (`guest.pay_parking_submitted`). Catalog also carries `guest.support_ticket_filed` / `guest.profile_updated` — handlers deferred to backlog pending a scoping decision (host-channel support tickets aren't org-state mutations; guest-portal profiles are global to the guest identity, not one org). See [`../planned/activity-log-followups.md`](../planned/activity-log-followups.md).
- [x] Curated super-admin → org mirror: `superAdminAudit.ts#logSuperAdminAction` gained an **opt-in** `mirrorToOrgActivity` param (org id + activity action + target + metadata). Wired in `org-subscriptions-admin` POST → `billing.plan_overridden_by_platform`. `approve-org-verification` / `reject-org-verification` use a direct `logActivity` call for the same effect (`verification.approved` / `.rejected`). Generic auto-mirroring of every super-admin action was **deliberately not done** — most target platform entities with no org root.
- [x] `AFTER DELETE` belt-and-braces net: migration `20261306150200_activity_log_delete_net_trigger.sql` — `trg_activity_log_delete_net_{org,property,parking}` on the three top-level tenant tables, same `WHEN` end-user-JWT guard as the `guest_submissions` trigger (service-role cascade deletes skipped; they self-log). Child tables intentionally excluded to avoid cascade fan-out. Applied + verified on local.
- [ ] **Deferred → backlog** ([`../planned/activity-log-followups.md`](../planned/activity-log-followups.md)): per-run `system.cron_run` summary rows (every cron-driven transition already lands a `booking.status_changed` row per Q7 — nothing missing, just nicer roll-ups); raw "webhook received" rows inside the `paymongo-webhook` / `meta-inbox-webhook` dedupe guards (billing state changes already covered app-side by checkout / downgrade / plan-override); support-ticket + guest-portal-profile handlers (scoping decision needed — see above).

**Phase 4 — UI: DONE (core).**

- [x] `ui/src/features/dashboard/activity/` — `lib/activityApi.ts`, `lib/activityFormat.ts`, `hooks/useActivityLog.ts` (infinite query, keyset cursor), `components/ActivityRow.tsx`, `components/ActivityFilters.tsx` (search / category chips / destructive-only / date range / clear), `components/ActivityDetailSheet.tsx` (actor + changes diff table + ip_prefix + metadata), `components/EntityActivityHistory.tsx` (reusable `targetType`+`targetId` panel), `pages/ActivityLogPage.tsx` (IntersectionObserver infinite scroll, loading / empty / error states), `routes/index.tsx`.
- [x] New `activity` section in `OrgSection` / `PropertySection` / `ParkingSection` unions + `*_SECTION_VIEW_PERMISSION` + `*_NAV_VIEW_PERMISSION` maps + `orgSectionPath` case + `contextPickerRegistry.ts` entry. Gate: `org.dashboard:view` (org) / `bookings:view` (property + parking) — **no new RBAC leaf**.
- [x] Routes wired: `<Route path="activity">` in `orgAdminRoutes`; `activityPropertyRoute` / `activityParkingRoute` in `dashboardRoutes` (property-shell / parking-shell). Sidebar "Activity" entry (`ScrollText` icon) in all three `adminSidebarNav` builders.
- [x] `<EntityActivityHistory targetType="booking" targetId={booking.id} />` embedded on the booking detail Overview tab.
- [x] Route guides: `docs/guides/routes/org/activity.md` + `.../org/property/activity.md` + `.../org/parking/activity.md` + 3 README rows. `docs/architecture/routing.md` + `edge-functions.md` + `data-model.md` + `PROJECT.md` updated.
- [x] `activity-log-export` CSV edge fn (owner / admin only, bounded 20k rows / 90-day default) + `config.toml` entry + `downloadActivityLogCsv` client + **Export CSV** button on `ActivityLogPage`.
- [x] **Phase 4 tail (2026-09-10):** `<EntityActivityHistory>` embedded on org / property / parking **Settings → Activity** sections (`targetType="settings"`, scoped id), the org **Manage Member** dialog (`targetType="member"`), and the finance / maintenance edit modals (`finance_entry` / `maintenance_item`) — plus a `heading` prop so it sits headless inside an `AdminSection`. `/admin/orgs/:orgSlug` → Activity now has a **Platform actions / Org activity** toggle (`SuperAdminOrgActivitySection` + `useSuperAdminOrgActivity` → `list-activity-log?orgId=`; super-admin resolves as `platform_admin`). `ActivityLogPage` feed **virtualized** past ~30 rows with `@tanstack/react-virtual` (`useWindowVirtualizer`, dynamic measure); shorter feeds render plainly.

**Phase 5 — realtime: DONE (2026-09-10).**

- [x] Migration `20261315120000_activity_log_realtime_broadcast.sql` — `AFTER INSERT` trigger `activity_log_broadcast()` → `realtime.send({ids + scope + category + severity + created_at}, 'activity', 'activity:org:<org>', private := true)`. Fully guarded (`to_regprocedure` presence check + `EXCEPTION WHEN OTHERS` → `RETURN NEW`) so it can never fail or slow the append-only write. **No row content** (summary / changes / metadata / actor) is broadcast. RLS policy `activity_log_broadcast_read` on `realtime.messages` + SECURITY DEFINER helper `user_can_read_activity_broadcast(topic)` (parses the topic uuid, reuses `user_can_access_org_notifications` — org owner / active `organization_members`). Validated locally: INSERT still commits with the trigger live; policy created; `realtime.send` present.
- [x] Client `useActivityRealtime(orgId)` — one private Broadcast channel per org, mounted once in `NotificationsProvider` (next to `useNotificationsRealtime`), debounce-invalidates `[ACTIVITY_LOG_KEY]` so every mounted `ActivityLogPage` / `EntityActivityHistory` refetches through the scoped edge read path.
- [x] **PostToolUse hook — deliberately not shipped.** The plan says "ship the hook only if the rule proves insufficient." The always-on `audit-logging` rule + skill + `CLAUDE.md` section (Phase 0) have governed every change since and are sufficient; a per-edit shell reminder would be noise. Revisit only if coverage regressions appear.

**Phase 6 — retention + plan gate: DONE (2026-09-10). Partitioning: roadmap (by design).**

- [x] Migration `20261315120200_activity_log_retention_cron.sql` — `platform_settings.activity_log_retention_months` (default 24, `CHECK >= 6`); `purge_activity_log(p_retention_months, p_max_rows)` (SECURITY DEFINER — `set_config('activity_log.allow_purge','on',true)` then bounded 5k-batch `DELETE`s past the window, returns the count); `sync_activity_log_retention_cron_job()` monthly pg_cron (`0 18 1 * *` UTC = 02:00 Manila on the 2nd) → new `activity-log-retention-cron` edge fn (`serveCronPost`, optional `ACTIVITY_LOG_RETENTION_CRON_SECRET`). Validated locally: `purge_activity_log(6,1000)` deleted a 40-month-old row, kept a fresh one; a plain `DELETE` still raises `activity_log is append-only`.
- [x] `activityLogExport` plan feature — `_shared/planFeatures.ts` + client mirror + `featureGateCopy.ts` + `EditPricingPlanDialog` toggle list; seed migration `20261315120100_activity_log_plan_feature.sql` (`false` on `free`, `true` on `starter` / `commission` / `growth` / `pro` / `managed` / `business_plus` — same shape as `financeReporting`). Server: `requireOrgFeature(org.id, 'activityLogExport')` + `catchPlanFeatureError` in `activity-log-export` (platform admins bypass). Client: `ActivityLogPage` Export CSV → `useFeatureGate('activityLogExport')`; Free opens `openUpgradeModal('activityLogExport')`. In-app viewing stays ungated on every plan.
- [x] **`activityLogRetentionDays` (per-plan queryable window) — dropped (2026-09-10).** Q1 resolved: platform-wide `activity_log_retention_months` + the retention cron already bound data; a Free-tier window cap wasn't worth the plan-catalog churn.
- [ ] **Monthly range partitioning — deferred to backlog** ([`../planned/activity-log-followups.md`](../planned/activity-log-followups.md)). The composite `PRIMARY KEY (id, created_at)` was chosen so this is not a table rewrite. Migration path in `docs/archive/operations/migration-runbook.md` § 11c.1. Maintenance-window job + load test when volume warrants; BRIN + btree + the retention cron carry it until then.

**Open product questions — all RESOLVED 2026-09-10** (see [Open questions](#open-questions--resolved-2026-09-10)): Q1 plan gating (`activityLogExport` = Starter+, no per-plan window), Q2 guest chat omitted, Q3 diff = column names only, Q4 curated mirror + read-time toggle, Q5 `ip_prefix` + `user_agent` kept, Q6 trigger-only (no `update-booking`), Q7 log every transition.

A single, append-only **activity log** that records every meaningful action taken across an organization — by team members, the org owner, super-admins acting on the org, the AI dashboard assistant, guests on public pages, cron jobs, and inbound webhooks — surfaced as an **Activity** timeline at org, property, and parking scope. The org owner and permitted team members can see who did what, when, from where, and (for edits) exactly what changed, with destructive actions (deletes, cancellations, refunds, member removals) called out.

Plus a **cross-tool governance rule + skill** (`audit-logging` — Cursor `.mdc`, `.agent` skill, OpenCode instruction, `CLAUDE.md` section) so every future feature or change must emit an activity event or explicitly mark it N/A, the same way `plans-and-permissions` forces a Plans/RBAC decision today.

> **Pre-implementation review applied (2026-09-06).** This plan was audited against the live codebase before scheduling. Findings folded in: (1) booking-detail edits are **direct browser → PostgREST writes under RLS** with no edge function, so a DB trigger on `guest_submissions` is **required in Phase 1**, not an optional Phase-3 net; (2) parking has **no orchestrator** — ~7 scattered status-write sites need a shared emitter; (3) FK/`ON DELETE CASCADE` on `organization_id` would destroy an org's history on delete — audit tables must use loose references like `super_admin_audit_events` does; (4) `PRIMARY KEY (id, created_at)` from day 1 so Phase-6 partitioning is not a table rewrite; (5) `EdgeRuntime.waitUntil` is **not** the default — destructive events await inline; (6) AI-assistant writes are attributed via the single app-layer emitter (actor context), **not** a second "mirror" row; (7) `developments` are platform-scoped → `super_admin_audit_events` only, dropped from `activity_log`. Each is reflected below.

## Goal

Today there is no org-wide record of team activity. `super_admin_audit_events` (+ `_shared/superAdminAudit.ts` + `/admin/audit`) covers **platform-team** mutations only; `org_subscription_events` covers billing; `ai_dashboard_assistant_action_audit` covers AI-executed writes; the Notification Center covers a handful of booking events for alerting, not accountability. A host org cannot answer "who cancelled that booking / removed that member / changed the payout / edited the pricing" without reading Postgres directly.

This plan adds one durable, queryable, tamper-evident timeline covering **every mutating surface** in the app — dashboard, public guest pages, AI assistant, crons, webhooks — scoped by org / property / parking, with field-level diffs, actor identity + role snapshot, and severity. It is built to be **cheap on the write path** (fire-and-forget, single-insert, never blocks or fails a mutation) and **cheap on the read path** (keyset pagination, purpose-built composite indexes, retention + partition roadmap). It ships with a governance rule so coverage does not rot as the app grows.

## Scope

### In

- One table `public.activity_log` (append-only, no update/delete path) + indexes + retention roadmap.
- Shared writer `supabase/functions/_shared/activityLog.ts` — `logActivity`, `logActivityBatch`, `buildActorContext`, `diffRecord`, redaction, and a typed `ACTIVITY_ACTION_CATALOG` (single source of truth for action → category / severity / target type / summary template).
- Emitters wired into **every mutating edge function / shared service** across all modules (full inventory in [Action coverage](#action-coverage-the-full-surface)).
- Actor threading through `workflowOrchestrator.transition()` (10 call sites) + a new `_shared/parkingActivity.ts` emitter at the ~7 scattered parking status-write sites (parking has no orchestrator).
- A `guest_submissions` DB trigger for booking-detail edits (direct browser → PostgREST writes, no edge function).
- Read endpoint `list-activity-log` (org-scoped, filtered, keyset-paginated) + `activity-log-export` (CSV).
- New Team RBAC leaves: `org.activity:view` / `:export` + `property.activity:view` / `:export`, seeded into templates. Parking scope reuses the coarse `bookings:view` gate.
- UI: `/org/:orgSlug/activity`, `/org/:orgSlug/property/:propertySlug/activity`, `/org/:orgSlug/parking/:parkingSlug/activity` + a reusable `<EntityActivityHistory>` panel embedded in booking detail, settings pages, team member detail, finance/maintenance item detail.
- Super-admin: extend the existing `/admin/orgs/:orgSlug` **Activity** tab to also show that org's `activity_log` (not just `super_admin_audit_events`).
- Curated mirror of super-admin actions that change an org into `activity_log` (so owners see platform actions in one place).
- Governance: `audit-logging` skill + `.cursor/rules/audit-logging.mdc` (always-on) + `opencode.json` instruction + `CLAUDE.md` section + index updates + doc-maintenance checklist line + optional PostToolUse reminder hook, all kept parity-clean for `check:ai-tooling-sync`.
- Docs: `docs/PROJECT.md`, `data-model.md`, `edge-functions.md`, `routing.md`, three new route guides, `plans-feature-matrix.md`, `booking-workflow.mdc`, `admin-auth.mdc`, migration runbook.

### Out

- Replacing `super_admin_audit_events` (stays the fuller platform-internal record; `activity_log` mirrors a curated subset only).
- Replacing `org_subscription_events` / `ai_dashboard_assistant_action_audit` / `property_smart_pricing_runs` (activity rows **reference** these, they are not moved).
- Undo / rollback from the log (read-only; a diff is not a revert).
- Real-time streaming of the feed in v1 (pull + refetch; realtime append is Phase 5, optional).
- Guest-portal-facing activity view (guests do not see org activity).
- SIEM / external log shipping, anomaly detection, alerting rules (future).
- Legacy admin (`verifyAdminJwt`) surfaces that are not org-scoped — logged only where an org id is resolvable.

## Approach

### Data model — `activity_log`

One wide, append-only table. Every row belongs to exactly one `organization_id` (the query root); `property_id` / `parking_id` narrow the scope.

| Column               | Type                                   | Notes                                                                                                                                                                                                                                                                                                |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `uuid`                                 | `gen_random_uuid()`; `PRIMARY KEY (id, created_at)` — composite so Phase-6 declarative partitioning on `created_at` needs no table rewrite. `id` alone is still effectively unique.                                                                                                                  |
| `organization_id`    | `uuid` **not null**                    | **No FK** — matches `super_admin_audit_events` (plain `target_id TEXT`, no target FK). An audit trail must survive parent deletes; org deletion is recorded here **and** in `super_admin_audit_events`, and the org's rows are retained (orphaned but intact) until the retention job ages them out. |
| `property_id`        | `uuid` null                            | No FK (id kept even if the property is later deleted — the history is the point)                                                                                                                                                                                                                     |
| `parking_id`         | `uuid` null                            | No FK (same reasoning)                                                                                                                                                                                                                                                                               |
| `scope`              | `text` not null                        | `org` \| `property` \| `parking` — denormalized for filter/index                                                                                                                                                                                                                                     |
| `actor_type`         | `text` not null                        | `org_owner` \| `team_member` \| `super_admin` \| `ai_assistant` \| `guest` \| `public` \| `system` \| `cron` \| `webhook` \| `integration`                                                                                                                                                           |
| `actor_user_id`      | `uuid` null                            | `REFERENCES auth.users(id) ON DELETE SET NULL` — the one FK, exactly as `super_admin_audit_events` does it                                                                                                                                                                                           |
| `actor_email`        | `text` null                            | snapshot (redacted for `guest`/`public` → first name / masked)                                                                                                                                                                                                                                       |
| `actor_display_name` | `text` null                            | snapshot                                                                                                                                                                                                                                                                                             |
| `actor_role`         | `text` null                            | snapshot of `accessKind` / custom role name at the time (`owner`, `org_admin`, `member`, `ADMIN`, `MANAGER`, …)                                                                                                                                                                                      |
| `actor_member_id`    | `uuid` null                            | `organization_members` / `property_members` / `parking_members` id                                                                                                                                                                                                                                   |
| `action`             | `text` not null                        | machine key, dot-namespaced — `booking.status_changed`, `team.member_removed`, `pricing.dates_updated`                                                                                                                                                                                               |
| `category`           | `text` not null                        | coarse chip group — see catalog below                                                                                                                                                                                                                                                                |
| `severity`           | `text` not null default `'info'`       | `info` \| `notice` \| `warning` \| `destructive`                                                                                                                                                                                                                                                     |
| `target_type`        | `text` null                            | `booking`, `property`, `parking`, `organization`, `member`, `invitation`, `custom_role`, `expense`, `maintenance_item`, `template`, `pricing_range`, `page_config`, `integration`, `subscription`, `verification`, …                                                                                 |
| `target_id`          | `text` null                            | uuid or natural key                                                                                                                                                                                                                                                                                  |
| `target_label`       | `text` null                            | human snapshot — "Booking #1042 · Juan D." , "Azure North 2BR"                                                                                                                                                                                                                                       |
| `summary`            | `text` not null                        | past-tense sentence, rendered from the catalog template + metadata                                                                                                                                                                                                                                   |
| `changes`            | `jsonb` null                           | `[{ field, from, to }]` — redacted, size-capped (~8 KB, `truncated: true` flag)                                                                                                                                                                                                                      |
| `metadata`           | `jsonb` not null default `'{}'`        | structured extras (amounts, counts, ids, `related_event_ref`)                                                                                                                                                                                                                                        |
| `request_id`         | `text` null                            | correlation id (idempotency key / generated per request)                                                                                                                                                                                                                                             |
| `ip_prefix`          | `text` null                            | client IP truncated to `/24` (v4) or `/48` (v6) — never the full address                                                                                                                                                                                                                             |
| `user_agent`         | `text` null                            | trimmed                                                                                                                                                                                                                                                                                              |
| `source`             | `text` not null default `'dashboard'`  | `dashboard` \| `public_form` \| `ai_assistant` \| `cron` \| `webhook` \| `telegram` \| `email_inbound` \| `db_trigger`                                                                                                                                                                               |
| `created_at`         | `timestamptz` not null default `now()` |                                                                                                                                                                                                                                                                                                      |

**Append-only enforcement (match `super_admin_audit_events` exactly):**

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` with **no policies** (deny-all to `authenticated` / `anon`); `GRANT ALL ON activity_log TO service_role`. Reads go exclusively through `list-activity-log` (service-role client behind the edge auth gate) — no RLS read path, same as `super_admin_audit_events`.
- `BEFORE UPDATE OR DELETE ON activity_log` trigger → `RAISE EXCEPTION 'activity_log is append-only'` unless `current_setting('activity_log.allow_purge', true) = 'on'` (set only by the retention job's own session). This blocks `service_role` too, so a stray edge-function bug can't rewrite history.
- No `updated_at`.

**Indexes (sized to actual filter combinations — no speculative indexes; `id` in the sort key for a clean keyset):**

```
(organization_id, created_at DESC, id DESC)                                          -- org feed + keyset cursor
(organization_id, property_id, created_at DESC, id DESC) WHERE property_id IS NOT NULL -- property feed
(organization_id, parking_id,  created_at DESC, id DESC) WHERE parking_id  IS NOT NULL -- parking feed
(organization_id, category, created_at DESC)                                          -- chip filter
(organization_id, actor_user_id, created_at DESC)                                     -- "what did member X do"
(organization_id, target_type, target_id, created_at DESC)                            -- entity history panel
(organization_id, created_at DESC) WHERE severity = 'destructive'                     -- destructive-only view
BRIN (created_at)                                                                    -- cheap range scans as it grows
```

Keyset predicate: `WHERE organization_id = $1 AND (created_at, id) < ($cursor_ts, $cursor_id) ORDER BY created_at DESC, id DESC LIMIT $n`. `id` is `gen_random_uuid()` (v4, not monotonic) — intra-microsecond ordering is arbitrary but stable, acceptable for a feed.

**Scale / retention (Phase 6, roadmap not v1 build):**

- Declarative **monthly range partitioning** on `created_at` — migration path documented; v1 ships a single table (BRIN + btree handle millions of rows comfortably).
- `pg_cron` monthly retention job: default keep **24 months** hot, purge older in bounded chunks (or `DETACH PARTITION` — O(1)) with `activity_log.allow_purge = on`. Window configurable in `platform_settings`. Optionally exempt `severity = 'destructive'`.
- `changes` / `metadata` serialized size capped at write time.

### Write path — `_shared/activityLog.ts`

Mirrors the proven `superAdminAudit.ts` + `notificationService.ts` pattern **exactly**:

- `logActivity(input): Promise<void>` — creates a `service_role` client, single `INSERT`, **never throws** (try/catch → `console.error`), swallows `23505`. A logging failure must never fail the mutation, email, webhook ack, or transition that triggered it (same contract as `createNotification`).
- `logActivityBatch(inputs[]): Promise<void>` — one multi-row insert for bulk operations. **Bulk = one summary row, never one row per entity** — `import-commit` (N bookings) → a single `booking.bulk_imported` with `metadata.count` + `batch_id`; `smart-pricing-apply` (up to 365 dates) → a single `pricing.smart_applied` with `metadata.count` + date range. Per-entity rows only where the entity truly changed state individually and that matters (rare).
- **`await` inline by default.** One indexed insert is ~5–15 ms and audit completeness matters — a destructive event that never lands defeats the feature. Use `EdgeRuntime.waitUntil(...)` (Supabase-supported; type it as a loose global) **only** for explicitly non-critical, high-frequency `notice` events (`booking.ai_review_run`, `settings.asset_uploaded`) where losing one on teardown is acceptable. Never `waitUntil` a `destructive` or `warning` event.
- `buildActorContext(source, ctx)` — normalizes actor fields from any of `OrgAccessContext` / `PropertyAccessContext` / `ParkingTeamAccessContext` / `AdminUser` / `{ superAdmin }` / `{ cron: name }` / `{ webhook: provider }` / `{ assistant: conversationId }` / `{ guest }`. Also extracts `ip_prefix` + `user_agent` + `request_id` from the `Request` — client IP from `x-forwarded-for` (first hop) / `x-real-ip` / `cf-connecting-ip`, truncated to `/24` (v4) or `/48` (v6) and stored as `text`.
- `diffRecord(before, after, { include?, exclude?, redactKeys? })` → `changes[]`. **Independent implementation** — do **not** reuse `_shared/utils.ts#compareFormData` (it silently omits `petType`, per `CLAUDE.md` "Known sharp edges"). Field allow-lists per surface so we log intent, not every column.
- **Redaction (central `REDACTED_KEYS` + `redactValue`):** never log secrets, tokens, passwords, OTP codes, full card / full bank account numbers, API keys, webhook signatures. Mask PII inside `changes` / `metadata` — email → `j***@d***.com`, phone → last 4, bank acct → last 4. Guest/public actor email is stored masked.
- **Call it after the write succeeds, before the HTTP response — never in a `catch` block** (the one exception: an explicit `security.denied_destructive_action` event). A row must never describe a mutation that then rolled back.
- **Webhooks / redelivery:** emit **inside** the existing dedupe guard (`processed_paymongo_events`, `processed_emails`), after the "already processed → early return" check, so a provider retry does not double-log.
- `ACTIVITY_ACTION_CATALOG: Record<ActivityAction, { category; severity; targetType; summary(ctx): string }>` — the **only** place an action's category / severity / summary shape is defined. Call sites pass structured data, never a hand-written `summary`/`category`. Client mirror `ui/src/features/dashboard/activity/lib/activityCatalog.ts` for label + icon rendering (kept in sync the way `notificationsDisplay.ts` / `planFeatures.ts` mirrors are).

### Direct-write surfaces (no edge function) — DB trigger required

**Booking-detail field edits do not go through an edge function.** The admin SPA writes `guest_submissions` **directly** via the authenticated Supabase client under scoped RLS (`useUpdateBooking`; route guide `bookings-detail.md` line ~399: "Save edit-form fields → Supabase `guest_submissions` update (admin session)"). Autosave on the live workflow stage is also a direct write. `logActivity` from an edge handler cannot see these.

Resolution — a trigger on `guest_submissions`, landing in **Phase 1** (not the optional Phase-3 net):

- `AFTER INSERT OR UPDATE OR DELETE ON guest_submissions FOR EACH ROW`, `WHEN` the write is made under an end-user JWT — `nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role' IN ('authenticated','anon')`. Service-role writes (edge functions, orchestrator, crons) are **skipped** — those paths call `logActivity` themselves with full context, so the trigger only fills the gap it must.
- Actor from the JWT claims: `->> 'sub'` → `actor_user_id`, `->> 'email'` → `actor_email`; `actor_role` resolved from a cheap `organization_members` / `property_members` lookup or left null. `source = 'db_trigger'`.
- Emits `booking.created` / `booking.details_edited` / `booking.deleted` (**D**) with an allow-listed `to_jsonb(NEW) vs to_jsonb(OLD)` diff (guest name/contact, dates/times, unit, fees, pets, decor flag, doc URLs — never internal workflow columns), redacted, size-capped.
- Trigger function is a single `INSERT` with no secondary queries beyond the optional role lookup; the `WHEN` clause makes it a near-zero no-op on the common service-role path, so it adds nothing to orchestrator / cron / guest-form throughput.
- **Alternative (cleaner, larger):** introduce an `update-booking` edge function and route `useUpdateBooking` through it — brings booking edits in line with every other module (CLAUDE.md: "RLS is not the access-control layer") and gives full app-layer context, but touches autosave + the PWA offline outbox. Tracked as Open question 6; the trigger ships regardless as the safety net.

### Actor threading fix (orchestrator + parking)

**Property bookings — one orchestrator, 10 call sites.** `WorkflowOrchestrator.transition(bookingId, toStatus, payload, devControls, manual)` takes **no actor**. Add an optional final `actor?: ActorContext` param (default `{ actor_type: 'system', source: 'cron' }` — a missed caller degrades to `system`, never crashes). Emit `booking.status_changed` / `booking.cancelled` (**D**) / `booking.document_substep_completed` from **one place inside the orchestrator**. Call sites to update (verified by grep):

| Caller                                           | Actor                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `transition-booking/index.ts`                    | `buildActorContext('dashboard', { propertyAccess })`                                 |
| `cancel-booking/index.ts`                        | dashboard property access                                                            |
| `submit-sd-form/index.ts`                        | `{ guest }` — **public** guest transition (`READY_FOR_CHECKOUT → PENDING_SD_REFUND`) |
| `approval-email-webhook/index.ts`                | `{ webhook: 'resend_inbound' }` → `actor_type: email_inbound`                        |
| `import-revert/index.ts`                         | dashboard property access (bulk)                                                     |
| `sd-refund-cron/index.ts`                        | `{ cron: 'sd-refund-cron' }`                                                         |
| `_shared/calendarSyncRun.ts` (`→ CANCELLED`)     | `{ cron: 'calendar-sync-cron' }`                                                     |
| `_shared/dashboardAssistantTools.ts` (×3)        | `{ assistant: conversationId }` → `actor_type: ai_assistant`                         |
| `_shared/dashboardAssistantBookingAssetTools.ts` | `{ assistant: conversationId }`                                                      |

**Parking bookings — no orchestrator, ~7 scattered status writes.** `parkingStatusMachine.ts` is graph-only; each site calls `DatabaseService.updateBookingStatus` / a direct `.update({ status })`. Add a thin `_shared/parkingActivity.ts#logParkingStatusChange(booking, from, to, actor)` and call it at each site — **do not** refactor the status writes themselves (higher risk, no payoff):

- `transition-parking-booking/index.ts` (`updateBookingStatus`)
- `_shared/parkingCancellation.ts` (two `→ CANCELLED` paths — host cancel + guest cancel)
- `_shared/parkingPaymentOrchestrator.ts` (`→ PENDING_REVIEW` on payment fulfilment; `actor_type: webhook`)
- `_shared/parkingBroadcastExpireCron.ts` (`→ NO_HOST_AVAILABLE`; `actor_type: cron`)
- `_shared/parkingBroadcastActions.ts` (claim `→ PENDING_PAYMENT`, decline)
- `_shared/dashboardAssistantTools.ts` (parking transition; `actor_type: ai_assistant`)

`claim-parking-booking` / `decline-parking-booking` / `cancel-parking-booking` handlers pass their `verifyParkingTeamAccess` context.

### Category catalog (filter chips)

`booking` · `team` · `settings` · `pricing` · `finance` · `maintenance` · `marketing` · `inbox` · `property` · `parking` · `org` · `plans_billing` · `verification` · `integrations` · `public_pages` · `guest` · `security` · `system`

Each maps to one exhaustive `Record<ActivityCategory, LucideIcon>` (mirror the `NOTIFICATION_ICONS` exhaustiveness pattern).

### Actor threading fix (orchestrator + parking)

`WorkflowOrchestrator.transition(bookingId, toStatus, payload, devControls, manual)` takes **no actor** today, and `transition-booking` / `transition-parking-booking` / crons / `dashboard-assistant-confirm` all call it. Add an optional final `actor?: ActorContext` param (default `{ actor_type: 'system', source: 'cron' }`). Callers pass:

- `transition-booking` → `buildActorContext('dashboard', { propertyAccess })`
- `transition-parking-booking` / `claim-` / `decline-` / `cancel-parking-booking` → parking access context
- `sd-refund-cron`, `contract-expiry-cron`, calendar-sync, parking expiry → `{ cron: '<job>' }`
- `dashboard-assistant-confirm` → `{ assistant: conversationId }` → `actor_type = 'ai_assistant'`

The orchestrator emits `booking.status_changed` (+ `booking.cancelled` destructive) from **one place** — never per-caller — consistent with "all transitions go through `workflowOrchestrator`" (`CLAUDE.md`).

### Read path

- `list-activity-log` — `serveAuthenticated` → `verifyOrgAccess`, requires `org.activity:view` (property/parking scopes require the mirror leaf). Filters: `scope`, `propertyId`, `parkingId`, `category[]`, `actorUserId`, `action`, `severity`, `targetType`, `targetId`, `dateFrom`, `dateTo`, `q` (optional, `summary`/`target_label` `ilike`). **Keyset pagination** on `(created_at, id)` — never `OFFSET`. `limit` capped at 100; default window last 90 days unless an explicit range is passed. Response shape mirrors `list-super-admin-audit`.
- **Scoped visibility:** org owner / org admin / platform admin → all rows. Property/parking-only members → only rows where `property_id` / `parking_id` ∈ their assigned listings (reuse `resolveAssignedListingIdsForOrgUser`); org-scope rows (`scope = 'org'`) are admin-only.
- `activity-log-export` — same gate + `org.activity:export`, streams CSV, capped row count, optional plan gate (see Open questions).
- **Entity history:** `list-activity-log?targetType=booking&targetId=<id>` powers `<EntityActivityHistory>` — no new endpoint.

### UI

`ui/src/features/dashboard/activity/` (new dashboard module — not a `bookings/` sub-folder):

- `ActivityLogPage` — TanStack Query infinite list, virtualized feed.
- `ActivityFilters` — category chips, actor picker (team member list), scope toggle (all / org / this property / this parking), date range, severity toggle, "destructive only" quick filter. Filters collapse into a sheet on mobile.
- `ActivityRow` — category icon, actor avatar + name + role, past-tense summary, relative time (`Asia/Manila`), severity accent. Expand → `changes` diff table + `metadata` + `ip_prefix` / `user_agent` + link to the target entity.
- `ActivityDetailSheet` — full row detail + "view <entity>" deep link.
- `EntityActivityHistory` — compact reusable panel (`targetType` + `targetId` props) embedded in: booking detail, property/parking settings pages, team member detail, finance line item, maintenance item.
- States: loading skeleton, empty ("No activity in this range"), error, permission-denied.
- Routes + sidebar entries at org / property / parking (`adminSidebarNav.ts`, `OrgSection` / `PropertySection` / `ParkingSection`; nav-filter permission = `org.activity:view` / `property.activity:view`; parking entry gated on coarse `bookings:view`).
- Mobile: full-width feed, 44px targets, filters in a sheet (`mobile-responsive`).
- Copy: minimal, plain, past tense, no em dashes (`human-copy` / `minimal-ui-copy`).
- **Realtime (Phase 5, optional):** one channel per org `activity-${orgId}`, mounted once, mirroring the Notification Center rule.

### Super-admin

Extend the existing `/admin/orgs/:orgSlug` **Activity** section (`SuperAdminOrgShell`) with a toggle: **Platform actions** (current `super_admin_audit_events`) / **Org activity** (`activity_log` for that org). Reuse `list-activity-log` with a super-admin bypass of the org gate.

### Governance — the `audit-logging` rule + skill

So coverage never rots, mirror the `plans-and-permissions` enforcement shape:

1. **`.agent/skills/audit-logging/SKILL.md`** (shared source; `setup:ai-tooling` symlinks it to `.cursor/skills/audit-logging` + `.claude/skills/audit-logging`; OpenCode loads via `skills.paths`). Contents: the decision checklist ("does this change mutate org/property/parking state, or a guest/public action worth recording? → emit an event, or write N/A + why"), how to add a new `ActivityAction` (catalog entry: category + severity + targetType + summary template, **plus** the client mirror), how to call `logActivity` / `logActivityBatch` with `buildActorContext` from an edge handler, the redaction rules, the "never block or fail the mutation" contract, `EdgeRuntime.waitUntil` guidance, testing (Deno test asserts a row is written with the right action/severity/actor), and a **module → actions** table.
2. **`.cursor/rules/audit-logging.mdc`** — `alwaysApply: true`, short mandate (like `plans-and-permissions.mdc`): every new mutating capability MUST emit an `activity_log` event (or document N/A). Points to the skill.
3. **`opencode.json`** — add `.cursor/rules/audit-logging.mdc` to `instructions[]`.
4. **`CLAUDE.md`** — new always-loaded "Activity / audit logging" subsection under "Docs are the source of truth" + a table row (`New mutating capability / edge function → audit-logging skill + .cursor/rules/audit-logging.mdc — emit an event or mark N/A`) + a line in the "Before claiming any material task done" checklist. (Claude Code can't auto-load `.mdc`, so this is the equivalent always-on copy — keep in sync with the `.mdc`.)
5. **Index updates:** `.cursor/rules/README.md`, `.claude/README.md`, `.opencode/README.md`.
6. **`.cursor/rules/documentation-maintenance.mdc`** + `.agent/skills/documentation-maintenance/SKILL.md` — add "activity-log event considered?" to the pre-done checklist (kept in sync per the `CLAUDE.md` note).
7. **`.cursor/rules/supabase-edge-functions.mdc`** — add "mutating handlers call `logActivity` with actor context" to the shared contract.
8. **`.cursor/rules/booking-workflow.mdc`** — document that every transition emits `booking.status_changed` from the orchestrator + the new `actor` param.
9. **Optional hook (Phase 5):** `.claude/hooks/remind-activity-log-on-mutation.sh` + `.cursor/hooks.json` + `.opencode/plugins/gfm-ai-tooling.ts` mirror — PostToolUse on `supabase/functions/**` edits, echoes a reminder. Must stay parity-clean for `check:ai-tooling-sync` (or be listed in `ai-tooling-sync-exceptions.txt`). Hooks are noisy — the always-on rule + skill may be enough; ship the hook only if the rule proves insufficient.
10. **`self-review` / `verify` skills** — add an activity-log coverage line to their checklists.

### Plans & Permissions decision (required by `plans-and-permissions.mdc`)

- **Team RBAC — YES.** New granular leaves `org.activity:view` / `org.activity:export` (`_shared/orgTeamPermissions.ts`, dot-namespaced to match `org.team.members:edit` etc.) and `property.activity:view` / `:export` (`propertyTeamPermissions.ts`); client mirrors in `propertyTeamConstants.ts` / `propertyPermissionCatalog.ts` + org equivalents; **seeded-template data migration** to add the leaves to existing Full Access / Operations / Read Only rows (precedent: `granular-team-permissions`) — **Full Access**: view + export; **Operations** / **Read Only**: view. Existing custom roles stay opt-in (no leaf added). Owner / org-admin / platform-admin implicit.
- **Parking RBAC stays coarse.** Parking still uses `MANAGER` / `STAFF` / `VIEWER` + `verifyParkingTeamAccess(req, id, 'bookings:view')` until parking granular RBAC ships (Phase 9, `parking-property-parity`). The parking Activity route gates on the existing coarse `bookings:view` — **no new parking leaf** now; add `parking.activity:*` when parking granular lands.
- Server allow-list on `list-activity-log` / `activity-log-export` (`org.activity:view` for org/property scope; coarse parking access for parking scope).
- **Plans — mostly N/A.** In-app viewing is a transparency/security surface and follows the "GET/list stays ungated" convention (`plans-feature-matrix.md`). Candidate gates (recommended defaults, see Open questions): `activityLogExport` plan key (Starter+) for CSV export only; `activityLogRetentionDays` entitlement — Free 90 days visible, Starter+ 12 months, Pro+ 24 months (data is retained regardless; the gate limits the queryable window, matching how `financeReporting` gates only the export). Update `plans-feature-matrix.md` + `planFeatures.ts` mirrors if adopted.

## Action coverage — the full surface

Every mutating surface, grouped by module. `logActivity` is called from the edge handler or shared service after the write succeeds. **D** = `severity: destructive`.

### Bookings & workflow (`category: booking`)

| Surface                                                       | Actions                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `workflowOrchestrator.transition()` (single emit point)       | `booking.status_changed` (per edge, with from/to + payload summary), `booking.cancelled` **D**, `booking.document_substep_completed` |
| `transition-booking` / `transition-parking-booking`           | actor context only (orchestrator emits)                                                                                              |
| `cancel-booking`                                              | `booking.cancelled` **D**                                                                                                            |
| `submit-form` (public)                                        | `booking.created` (`actor_type: guest`)                                                                                              |
| `submit-form-completion`                                      | `booking.guest_completed_form`                                                                                                       |
| `import-commit` / `import-revert`                             | `booking.bulk_imported` (batch, count), `booking.import_reverted` **D**                                                              |
| `calendar-sync-cron`                                          | `booking.imported_from_ota` (`actor_type: cron`), `calendar.sync_failed` (warning)                                                   |
| `upload-booking-asset` / `issue-booking-document-share-token` | `booking.document_uploaded`, `booking.share_link_issued`                                                                             |
| `validate-booking-receipts` / `booking-ai-review`             | `booking.receipt_validated`, `booking.ai_review_run` (`notice`)                                                                      |
| `send-booking-workflow-email` / `send-sd-refund-form-email`   | `booking.workflow_email_sent` (`notice`)                                                                                             |
| `dashboard-assistant-confirm` (booking tools)                 | orchestrator emits with `actor_type: ai_assistant` + `metadata.assistant_conversation_id`                                            |

### Team & RBAC (`category: team`)

`org/property/parking-team-invitations` → `team.invite_sent` / `team.invite_resent` / `team.invite_revoked` **D**.
`accept-org/property/parking-invite` → `team.invite_accepted`.
`org/property/parking-team-members` → `team.member_role_changed`, `team.member_permissions_changed`, `team.member_listing_assignment_changed`, `team.member_suspended`, `team.member_removed` **D**.
`org/property/parking-team-custom-roles` → `team.custom_role_created` / `team.custom_role_updated` / `team.custom_role_deleted` **D**.

### Org / Property / Parking lifecycle (`category: org` / `property` / `parking`)

`create-organization` / `update-organization` / `delete-organization` **D** (`org.updated` for profile columns; `settings.updated` + `metadata.area` when `org-settings` patches the `settings` JSONB — do not double-log).
`create-property` / `update-property` / `delete-property` **D**.
`create-parking` / `update-parking` / `delete-parking` **D**.
`create-development` / `update-development` / `delete-development` — **excluded.** Developments are platform-scoped (`/admin/developments`, no `organization_id`) → `super_admin_audit_events` only, not `activity_log`.

### Settings (`category: settings`)

`app-settings` (property) — `settings.updated` with `metadata.area` ∈ `payment` (OTP-gated — also log `settings.payment_otp_verified` from `settings-verification`), `guest_form`, `house_rules`, `amenities`, `cancellation_policy`, `automation_toggles`, `branding`, `email_branding`.
`parking-settings`, `org-settings` — `settings.updated` (+ area).
`property-templates-settings` / `custom-pages-settings` — `settings.template_created` / `settings.template_updated` / `settings.template_reset` / `settings.template_deleted` **D**.
`public-page-configs` — `public_pages.config_saved`, `public_pages.published` (`category: public_pages`).
`upload-*-media` / `upload-*-settings-asset` — `settings.asset_uploaded` (`notice`).

### Pricing (`category: pricing`)

`property-pricing` / `parking-pricing` — `pricing.nightly_rate_changed`, `pricing.dates_updated` (range + count), `pricing.dates_blocked` / `pricing.dates_unblocked`.
`smart-pricing-settings` — `pricing.smart_enabled` / `pricing.smart_disabled` / `pricing.smart_config_changed`.
`smart-pricing-apply` — `pricing.smart_applied` (count; `metadata.related_event_ref` → `property_smart_pricing_runs`).
`smart-pricing-cron` — `pricing.smart_autopilot_applied` (`actor_type: cron`).

### Finance & Maintenance (`category: finance` / `maintenance`)

`finance-line-items` — `finance.entry_created` / `finance.entry_updated` / `finance.entry_deleted` **D**; recurring series create/update/delete.
`finance-export` — `finance.report_exported` (`notice`).
`maintenance-items` — `maintenance.task_created` / `maintenance.task_updated` / `maintenance.task_status_changed` / `maintenance.task_deleted` **D**; recurring series.

### Marketing & Inbox (`category: marketing` / `inbox`)

`marketing-templates` — `marketing.template_saved` / `marketing.template_deleted` **D**.
`generate-marketing-caption` / `generate-marketing-template` — `marketing.ai_generated` (`notice`).
`publish-to-meta` — `marketing.published_to_meta` (`warning` — external, no undo).
`moderate-external-review` — `marketing.external_review_moderated` (host approves/hides guest-submitted review content).
`marketing-music` — `marketing.music_track_changed` (`notice`).
`social-inbox-send` — `inbox.reply_sent` (`notice` — external).
`social-inbox-settings` — `inbox.quick_replies_changed`, `inbox.ai_autoreply_toggled`.
`social-inbox-templates` — `inbox.template_saved` / `_deleted` **D**.
`meta-inbox-oauth-complete` / `meta-inbox-disconnect` — `integrations.channel_connected` / `integrations.channel_disconnected` **D** (`category: integrations`).

### Parking operations (`category: parking`)

`submit-parking-booking-request` (public) — `parking.request_submitted` (`actor_type: guest`).
`claim-parking-booking` / `decline-parking-booking` / `cancel-parking-booking` — `parking.claimed` / `parking.declined` / `parking.cancelled` **D**.
`parking-broadcast-email` — `parking.broadcast_resent`.
`expire-parking-broadcasts` / `send-parking-reminders` — `actor_type: cron` summary rows.
`parking-payouts` — `parking.payout_disbursed` **D** (financial), `parking.payout_clawback` **D**.
`platform-parking-settings` — super-admin → mirror.

### Plans & billing (`category: plans_billing`)

`create-org-subscription-checkout` — `billing.checkout_started`.
`apply-org-plan-downgrade` — `billing.plan_downgraded` **D**.
`paymongo-webhook` — `billing.subscription_activated` / `billing.payment_succeeded` / `billing.payment_failed` (warning) (`actor_type: webhook`; `metadata.related_event_ref` → `org_subscription_events`).
`org-subscriptions-admin` (super-admin) — mirror `billing.plan_overridden_by_platform`.

### Verification & trust (`category: verification`)

`submit-org-verification` / `submit-listing-authorization` / `submit-listing-recommended` / `submit-contract-consideration` — `verification.submitted`.
`approve-org-verification` / `reject-org-verification` / `approve-listing-authorization` / `reject-listing-authorization` / `approve-listing-recommended` / `decide-contract-consideration` — super-admin → mirror `verification.approved` / `verification.rejected` **D**.
`reassess-org-superhost` / `superhost-assessment-cron` — `verification.superhost_reassessed`.

### Integrations (`category: integrations`)

`telegram-*-settings` (8) — `integrations.telegram_connected` / `_disconnected` **D** / `_config_changed`.
`calendar-sync-settings` — `integrations.calendar_feed_added` / `_removed` **D** / `integrations.calendar_export_toggled`.
`voice-receptionist-settings` — `integrations.voice_connected` / `_config_changed`.
`meta-inbox-*` — see Inbox above.

### AI controls (`category: settings`, `actor` = real user or `super_admin`)

`dashboard-assistant-settings` — `ai.assistant_toggled` (per org/property), quota changes.
`dashboard-assistant-global-settings` / `ai-platform-global-settings` / `ai-platform-credit-wallet` — super-admin → mirror (`ai.kill_switch_flipped`, `ai.credits_adjusted` **D**).
`ai-platform-settings` / `ai-platform-property-settings` — `ai.quota_overridden`.
AI-assistant executed writes — **not a separate mirror row.** The assistant tools already call the same shared services / orchestrator; they pass `{ assistant: conversationId }` into `buildActorContext` so the **single** app-layer emit for that action carries `actor_type: ai_assistant` + `metadata.assistant_conversation_id`. "Which member — or the AI on whose behalf — did this destructive thing" is answered by that one row. `ai_dashboard_assistant_action_audit` stays as the fuller AI-internal record (prompt, tool args, tiering); `activity_log` is the business event. Only a tool with **no** shared-service equivalent emits `logActivity` directly.

### Guest / public (`category: guest`, `actor_type: guest` / `public`)

`submit-sd-form` — `guest.sd_form_submitted`.
`submit-guest-review` — `guest.review_submitted`.
`claim-sd-voucher` — `guest.voucher_claimed`.
`submit-pay-parking` — `guest.pay_parking_submitted`.
`submit-support-ticket` / `reply-support-ticket` / `reopen-support-ticket` — `guest.support_ticket_filed` / `_replied` / `_reopened` (org-resolvable).
`guest-profile` (portal edits), `submit-contract-consideration` — `guest.profile_updated`.
`submit-form` / `submit-form-completion` — org id resolved from the already-loaded property row (`resolvePublicPropertyId`), no extra query on the write path.
High-volume guest chat (`guest-web-chat-*`, `guest-messages`) — **not** per-message; a thread-level `guest.chat_started` only, or omit (Open questions).

### Security (`category: security`, `severity: warning`)

`settings-verification` — `security.otp_requested` / `security.otp_verified` / `security.otp_failed`.
Denied **destructive** attempts (permission/plan gate rejects a delete/cancel/refund) — `security.denied_destructive_action` (opt-in; log only destructive denials to bound volume).
`issue-booking-document-share-token` / `issue-guest-stay-guide-token` / `issue-guest-form-completion-token` — `security.share_token_issued`.

### System / cron (`category: system`, `actor_type: cron` / `webhook`)

`sd-refund-cron`, `contract-expiry-cron`, `platform-billing-cron`, `telegram-*-cron`, `dashboard-assistant-expire-pending-actions`, parking expiry, calendar sync, smart-pricing cron — **one summary row per run** ("SD refund cron advanced 3 bookings to PENDING_SD_REFUND"); per-entity state changes are emitted by the orchestrator/service they call, not duplicated.
`approval-email-webhook` (Resend inbound GAF/pet) — `booking.approval_email_processed` (`actor_type: email_inbound`).
`resndWebhook` / `paymongo-webhook` / `meta-inbox-webhook` — provider event rows.

### DB triggers — two, both narrow

1. **`guest_submissions` (Phase 1, required)** — the direct-write gap described under [Direct-write surfaces](#direct-write-surfaces-no-edge-function--db-trigger-required). `INSERT/UPDATE/DELETE`, `WHEN` the write is under an `authenticated` / `anon` JWT (service-role writes skipped — those app-layer-log). Single insert + optional cheap role lookup.
2. **`AFTER DELETE` net (Phase 3)** — on a short curated list (`properties`, `parkings`, `organizations`, `organization_members`, `property_members`, `parking_members`, `finance_*`, `maintenance_*`) as belt-and-braces for a stray service-role delete that skipped its app-layer emitter. Low-fidelity `db_trigger` row, `actor_user_id` from the JWT claims if present else null. `DELETE`s are rare → negligible cost. No `INSERT`/`UPDATE` triggers on these tables.

## Performance guardrails (explicit)

- Write = single `INSERT`, no sub-selects; wrapped so failure is swallowed. **`await` inline by default** (~5–15 ms, one indexed insert); `EdgeRuntime.waitUntil` only for non-critical `notice` events, never for `destructive` / `warning`.
- `guest_submissions` trigger has a `WHEN` clause on JWT role → near-zero no-op on the common service-role path (orchestrator, crons, guest form). The Phase-3 `AFTER DELETE` net fires only on deletes. No trigger on any hot-table `INSERT` / `UPDATE`.
- Reads: keyset pagination only (`(created_at, id)` cursor + matching `(org, created_at DESC, id DESC)` index), `limit ≤ 100`, default 90-day window, composite indexes matched to the real filter set, BRIN for range scans.
- `changes` / `metadata` size-capped at write; bulk ops use `logActivityBatch` — **one summary row**, never one per entity.
- Retention job runs off-peak, bounded-chunk deletes or `DETACH PARTITION`.
- Webhook emitters sit inside the provider-event dedupe guard (no double-log on retry).
- Realtime (if built) = one channel per org, mounted once (Notification Center rule).
- Load-test target: 10k events/day/org, feed p95 < 200 ms at 5M rows.

## Implementation tasks

### Phase 0 — Foundation + governance (must land before emitters)

- [ ] Migration `supabase/migrations/20261305130200_activity_log.sql` (follow the repo's synthetic timestamp sequence — next after `..130100_platform_settings.sql`; **not** a real date) — table with `PRIMARY KEY (id, created_at)`, indexes, `ENABLE ROW LEVEL SECURITY` (no policies), `GRANT ALL TO service_role`, `BEFORE UPDATE OR DELETE` append-only trigger, `COMMENT`s. Mirror `super_admin_audit_events` structure. Verify with `bun run db:migrate` (local) — never a prod deploy.
- [ ] `supabase/functions/_shared/activityLog.ts` — `logActivity`, `logActivityBatch`, `buildActorContext`, `diffRecord` (independent of `compareFormData`), redaction, `ACTIVITY_ACTION_CATALOG`, `ActivityAction` / `ActivityCategory` unions.
- [ ] `ui/src/features/dashboard/activity/lib/activityCatalog.ts` + `activityIcons.ts` — client mirrors (exhaustive `Record<ActivityCategory, LucideIcon>`).
- [ ] `supabase/functions/list-activity-log/index.ts` — `serveAuthenticated` + `verifyOrgAccess` + `org.activity:view` (coarse parking access for parking scope), keyset pagination, scoped visibility via `resolveAssignedListingIdsForOrgUser`.
- [ ] RBAC leaves: `org.activity:view` / `:export` + `property.activity:view` / `:export` — `_shared/orgTeamPermissions.ts`, `propertyTeamPermissions.ts` + client mirrors (`propertyTeamConstants.ts`, `propertyPermissionCatalog.ts`, org equivalents) + **seeded-template data migration** (add leaves to existing Full Access / Operations / Read Only rows). **No parking leaf** — parking scope uses coarse `bookings:view` until parking granular RBAC.
- [ ] Deno test `_shared/activityLog_test.ts` — writes the right row; failure is swallowed; redaction masks PII/secrets; `diffRecord` catches `petType`; bulk = one row.
- [ ] **Governance (land now so Phases 1–6 follow it):** `.agent/skills/audit-logging/SKILL.md`; `.cursor/rules/audit-logging.mdc`; `opencode.json` instruction; `CLAUDE.md` section + table row + checklist line; `.cursor/rules/README.md` / `.claude/README.md` / `.opencode/README.md` rows; `documentation-maintenance` (`.mdc` + skill) checklist line; `supabase-edge-functions.mdc` contract line. Run `bun run check:ai-tooling-sync` + `bun run check:filenames` + `bun run lint`.

### Phase 1 — High-value emitters (destructive + accountability core)

- [ ] Add optional `actor?: ActorContext` (last param, default `{ actor_type: 'system' }`) to `WorkflowOrchestrator.transition()`; update all **10** call sites (table under [Actor threading fix](#actor-threading-fix-orchestrator--parking)); emit `booking.status_changed` / `booking.cancelled` / `booking.document_substep_completed` **once, inside the orchestrator**.
- [ ] `guest_submissions` DB trigger (INSERT/UPDATE/DELETE, `WHEN` end-user JWT) — `booking.created` / `booking.details_edited` / `booking.deleted`, allow-listed `to_jsonb` diff. Covers direct browser edits + live-stage autosave.
- [ ] `_shared/parkingActivity.ts#logParkingStatusChange` + call at the **7** parking status-write sites (list under Actor threading fix).
- [ ] Team & RBAC: every invite / member / custom-role edge function (org + property + parking — parking still coarse).
- [ ] Org / property / parking create + update + delete (**developments excluded** — platform-scoped).
- [ ] `cancel-booking`, `import-commit` (one `booking.bulk_imported` row), `import-revert`.

### Phase 2 — Settings & operational emitters

- [ ] `app-settings` / `parking-settings` / `org-settings` (with `metadata.area`) + `settings-verification` OTP events.
- [ ] Pricing (manual + smart + cron), finance line items + export, maintenance items.
- [ ] Templates, public page configs, media uploads.
- [ ] Plans & billing (checkout, downgrade, paymongo webhook).
- [ ] Verification / trust (submit + super-admin mirror).
- [ ] Integrations (telegram ×8, calendar sync, voice, meta).
- [ ] AI controls (`dashboard-assistant-settings`, `ai-platform-*`) + wire `{ assistant: conversationId }` through assistant tools so the existing single emit is attributed to `ai_assistant` (no separate row).
- [ ] Marketing: `moderate-external-review`, `marketing-music`.

### Phase 3 — Public & system emitters

- [ ] Guest/public: `submit-form`, `submit-form-completion`, `submit-sd-form`, `submit-guest-review`, `claim-sd-voucher`, `submit-pay-parking`, support tickets, guest profile (org id from the loaded property row).
- [ ] All crons → one summary row per run.
- [ ] Webhooks: `approval-email-webhook`, `paymongo-webhook`, `resend` / `meta-inbox` webhooks — emit **inside** each provider's dedupe guard.
- [ ] Curated super-admin → org mirror: `superAdminAudit.ts#logSuperAdminAction` also calls `logActivity` **only when an `organization_id` is resolvable** from the target (org-scoped actions); platform-only actions stay in `super_admin_audit_events`.
- [ ] `AFTER DELETE` trigger net on the short curated table list (deletes only).

### Phase 4 — UI

- [ ] `ui/src/features/dashboard/activity/` — `ActivityLogPage`, `ActivityFilters`, `ActivityRow`, `ActivityDetailSheet`, `EntityActivityHistory`, hooks (`useActivityLog` infinite query).
- [ ] Routes `/org/:orgSlug/activity`, `/org/:orgSlug/property/:propertySlug/activity`, `/org/:orgSlug/parking/:parkingSlug/activity` + `routes/index.tsx` merge + `adminSidebarNav.ts` + `OrgSection` / `PropertySection` / `ParkingSection` + nav-filter permission.
- [ ] Embed `<EntityActivityHistory>` in booking detail, settings pages, team member detail, finance/maintenance item detail.
- [ ] Extend `/admin/orgs/:orgSlug` Activity tab with the Org-activity toggle.
- [ ] `activity-log-export` edge fn + CSV download button.
- [ ] Mobile pass (`mobile-responsive`), a11y pass (`accessibility`), copy pass (`human-copy` / `minimal-ui-copy`).

### Phase 5 — Realtime + hook (optional)

- [ ] Realtime channel `activity-${orgId}` + `ActivityProvider` mounted once in `AdminLayout`.
- [ ] `remind-activity-log-on-mutation.sh` hook + `.cursor/hooks.json` + `.opencode/plugins/gfm-ai-tooling.ts` mirror + parity.

### Phase 6 — Scale & retention

- [ ] Monthly partitioning migration + `pg_cron` retention job + `platform_settings` retention config.
- [ ] `activityLogRetentionDays` / `activityLogExport` plan entitlements (if adopted) + `plans-feature-matrix.md`.
- [ ] Load test + index tuning; migration-runbook entry.

## Docs to update

- `docs/PROJECT.md` — new "Org Activity & Audit Log" section; data-model / edge-function / routes rows.
- `docs/architecture/data-model.md` — `activity_log` schema + indexes + retention + the `guest_submissions` audit trigger.
- `docs/architecture/edge-functions.md` — `list-activity-log`, `activity-log-export`.
- `docs/architecture/routing.md` — three new routes.
- `docs/guides/routes/org/activity.md`, `docs/guides/routes/org/property/activity.md`, `docs/guides/routes/org/parking/activity.md` — new route guides (`route-guides` skill) + `docs/guides/routes/README.md` row.
- `docs/architecture/plans-feature-matrix.md` — `activityLogExport` / retention entitlement (if adopted).
- `.cursor/rules/booking-workflow.mdc` — orchestrator emits `booking.status_changed`; new `actor` param.
- `.cursor/rules/admin-auth.mdc` — super-admin actions mirrored into org `activity_log`.
- `.cursor/rules/supabase-edge-functions.mdc` — mutating handlers call `logActivity`.
- `.cursor/rules/audit-logging.mdc` (new) + `.agent/skills/audit-logging/SKILL.md` (new) + `opencode.json` + `CLAUDE.md` + `.cursor/rules/README.md` + `.claude/README.md` + `.opencode/README.md` + `documentation-maintenance` (`.mdc` + skill).
- `docs/archive/operations/migration-runbook.md` — retention / partition ops.
- `docs/workflow/planned/README.md` — index row (added in this write).

## Open questions — RESOLVED 2026-09-10

All seven ratified with the recommended default; no code change beyond what already shipped. Later reversals are cheap (flip a plan feature / adjust an allow-list).

1. **Plans gating — DECIDED:** in-app viewing fully free; `activityLogExport` = Starter+ (**shipped**). Per-plan queryable window (`activityLogRetentionDays`) **dropped** — platform-wide `activity_log_retention_months` (24) + the retention cron already bound data lifecycle; a Free-tier window cap wasn't worth the catalog churn.
2. **Guest chat volume — DECIDED:** omit guest web-chat from the log entirely (no `guest.chat_started`). High volume, low accountability value; the thread itself is the record.
3. **`guest_submissions` diff fidelity — DECIDED:** keep the allow-listed **changed-column-names-only** diff (no from/to values). Privacy-preserving; the allow-list stands (guest identity, dates/times, unit, fees, pets, decor flag, doc URLs; `status` + workflow columns excluded).
4. **Super-admin mirroring — DECIDED:** curated opt-in mirror (plan overrides, verification decisions) stays; the `/admin/orgs/:slug` **Org activity** toggle (Phase 4 tail) covers the rest as a read-time view. No generic auto-mirror.
5. **IP capture — DECIDED:** keep `ip_prefix` (`/24` v4 / `/48` v6) + trimmed `user_agent`. Never the full address.
6. **`update-booking` edge function — DECIDED:** keep booking-detail edits as direct RLS writes with the `guest_submissions` trigger as the audit path. Not opening an `update-booking` follow-up for this plan — the trigger covers the audit need; app-layer parity is a separate concern if ever pursued.
7. **`booking.status_changed` volume — DECIDED:** log **every** transition, including cron auto-advances. The retention cron + the documented partitioning path handle volume; completeness matters more than row count for an audit trail.

## Deferred to backlog — [`../planned/activity-log-followups.md`](../planned/activity-log-followups.md)

Split out 2026-09-10 so the core plan can close. None block the feature; the always-on `audit-logging` rule keeps coverage from rotting.

- Dedicated `org.activity:view` / `:export` + `property.activity:*` RBAC leaves + seeded-template data migration.
- `system.cron_run` per-run summary rows (~8 crons) — every cron-driven transition already lands a `booking.status_changed` row, so nothing is missing from the feed.
- Low-value `notice`-tier emitters: `upload-*-settings-asset` ×3, `telegram-*-settings` ×8, `ai-platform-*` quota overrides, `marketing-music`, `settings-verification` OTP `security.*`.
- `guest.support_ticket_filed` / `guest.profile_updated` handlers — **needs a scoping decision first** (host-channel support tickets aren't an org-state mutation; guest-portal profiles are global to the guest identity, not one org). Catalog entries exist; handlers intentionally unwired until that's answered.
- Monthly range partitioning — maintenance-window job + load test; migration path in `docs/archive/operations/migration-runbook.md` § 11c.1.
