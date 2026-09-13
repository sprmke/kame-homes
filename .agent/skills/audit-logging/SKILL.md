---
name: audit-logging
description: >-
  Checklist so every new or changed mutating capability records an org activity /
  audit event (or explicitly marks N/A). REQUIRED when adding or changing an edge
  function that writes org / property / parking data, a workflow transition, a
  cron, a webhook handler, a direct-write surface, or a guest/public action worth
  recording. Mirrors always-on Cursor rule audit-logging.mdc. Use before claiming
  mutating work done.
---

# Activity / audit logging (new & changed mutations)

**Non-negotiable:** every change that mutates organization, property, or parking
state — or records a guest / public action worth accountability — must **emit an
`activity_log` event, or write "activity-log: N/A — <why>" in the PR / route
guide / workflow doc**, in the **same change**. Not a follow-up.

This is the full checklist. Cursor always-on: **`.cursor/rules/audit-logging.mdc`**.
Plan + data model: **`docs/workflow/planned/org-activity-audit-log.md`**.
Writer: **`supabase/functions/_shared/activityLog.ts`**. Read API: `list-activity-log`.

## When this applies

Emit an event when your change adds or alters any of:

- An **edge function** that inserts / updates / deletes a row scoped to an org,
  property, or parking (bookings, team, settings, pricing, finance, maintenance,
  marketing, inbox, integrations, verification, plans/billing, lifecycle).
- A **workflow transition** — property bookings go through
  `WorkflowOrchestrator.transition()` (pass an `actor`); parking status writes
  call `_shared/parkingActivity.ts#logParkingStatusChange`.
- A **cron** that changes org-scoped data → one summary row per run
  (`system.cron_run`), never one row per entity it advanced.
- A **webhook** handler (PayMongo, Resend inbound, Meta) → emit **inside** the
  provider dedupe guard, after the "already processed" early return.
- A **direct browser → PostgREST write** with no edge function (today: booking
  detail edits on `guest_submissions`) → a DB trigger covers it; extend the
  trigger's column allow-list if you add a user-editable field.
- A **guest / public** action (form submit, review, voucher claim, support
  ticket) when an `organization_id` is resolvable.

**Skip (mark N/A):** pure reads / GET endpoints, internal refactors with no new
capability, renames, pure UI-copy changes, platform-only super-admin surfaces
that have no `organization_id` (those use `super_admin_audit_events`).

## Step 1 — Pick or add the action

Actions live in `ACTIVITY_ACTION_CATALOG` in `_shared/activityLog.ts` — the single
source of truth for an action's `category`, `severity`, `targetType`, and summary
template. Reuse an existing action key when one fits.

Adding a new action (`<category>.<verb>` dot-namespaced, past-tense verb):

1. Add the entry to `ACTIVITY_ACTION_CATALOG` with `{ category, severity,
targetType, summary }`. `severity`: `info` (routine), `notice` (external
   side-effect / noteworthy), `warning` (risky / irreversible-ish), `destructive`
   (delete / cancel / refund / member removal / role deletion).
2. If you added a **new `category`**, extend `ActivityCategory` in
   `_shared/activityLog.ts` **and** the mirror in
   `ui/src/features/dashboard/activity/lib/activityCatalog.ts`
   (`ACTIVITY_CATEGORY_ICONS`, `ACTIVITY_CATEGORY_LABELS`,
   `ACTIVITY_FILTER_CATEGORIES`) — both are exhaustive `Record`s.
3. Add / update a Deno assertion in `_shared/activityLog_test.ts` if the shape
   check needs it (the catalog-shape test already covers every entry generically).

## Step 2 — Call the writer

From the edge handler, **after the write succeeds and before the HTTP response**
(never from a `catch` — the one exception is `security.denied_destructive_action`):

```ts
import { buildActorContext, diffRecord, logActivity } from '../_shared/activityLog.ts';

await logActivity({
  action: 'pricing.dates_updated',
  organizationId: access.org.id,
  propertyId: access.property.id, // scope inferred: parking > property > org
  actor: buildActorContext('dashboard', { propertyAccess: access }, req),
  targetType: 'property', // omit to take the catalog default
  targetId: access.property.id,
  targetLabel: access.property.name,
  changes: diffRecord(before, after, { include: ['nightly_rate', 'min_nights'] }),
  metadata: { count: updatedDates.length, related_event_ref: runId },
});
```

`buildActorContext(source, input, req)` normalizes the actor from any of
`{ orgAccess } | { propertyAccess } | { parkingAccess } | { admin } |
{ superAdmin } | { cron: name } | { webhook: provider } |
{ assistant: { conversationId } } | { guest } | { system: true }` and pulls
`ip_prefix` (`/24` truncated) + `user_agent` + `request_id` from `req`.

- **Bulk operations:** one summary row via `logActivity` with `metadata.count` +
  `batch_id` — never one row per entity. `logActivityBatch` exists only for the
  rare case where per-entity rows genuinely matter.
- **AI assistant:** do **not** add a separate mirror row. The assistant tools call
  the same shared services; thread `{ assistant: { conversationId } }` into
  `buildActorContext` so the single existing emit carries `actor_type:
ai_assistant`.
- **`EdgeRuntime.waitUntil`:** default is `await` inline. Pass
  `logActivity(input, { background: true })` **only** for non-critical,
  high-frequency `notice` events. Never for `warning` / `destructive`.

## Step 3 — Redaction (already centralized — do not defeat it)

`diffRecord` and the writer redact via `REDACTED_KEYS` + `redactValue`: secrets /
tokens / OTP / signatures / card + bank numbers are dropped; emails are masked
(`j***@e***.com`); phone-keyed values become last-4. Pass an allow-list
(`include: [...]`) so you log intent, not every column. Add one-off sensitive
keys via `diffRecord(before, after, { redactKeys: ['...'] })`. Never hand a raw
password / token / full account number into `metadata`.

## Step 4 — The contract (must stay true)

- `logActivity` / `logActivityBatch` **never throw** — a logging failure must
  never fail the mutation, email, webhook ack, or transition.
- Single `INSERT`, no sub-selects on the write path.
- The row must describe a mutation that **committed** — call it after the write,
  not speculatively.
- `activity_log` is **append-only** (DB trigger blocks UPDATE / DELETE, service
  role included). Do not try to "correct" a row — emit a new one.

## Step 5 — Docs

- New route / page / section → `route-guides` skill (permission + activity note).
- New edge function → `docs/architecture/edge-functions.md`.
- New action category or data-model change → `docs/architecture/data-model.md`
  - `docs/PROJECT.md`.
- New `activity_log` retention / partition behavior →
  `docs/archive/operations/migration-runbook.md`.

## Module → representative actions (extend as you add coverage)

| Module              | Example actions                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bookings / workflow | `booking.created` · `booking.status_changed` · `booking.cancelled` **D** · `booking.details_edited` · `booking.deleted` **D** · `booking.bulk_imported`                            |
| Parking ops         | `parking.status_changed` · `parking.claimed` · `parking.declined` · `parking.cancelled` **D** · `parking.request_submitted`                                                        |
| Team & RBAC         | `team.invite_sent` · `team.invite_revoked` **D** · `team.member_role_changed` · `team.member_permissions_changed` · `team.member_removed` **D** · `team.custom_role_deleted` **D** |
| Lifecycle           | `org.updated` · `org.deleted` **D** · `property.created` · `property.deleted` **D** · `parking.created` · `parking.deleted` **D**                                                  |
| Settings            | `settings.updated` (+ `metadata.area`) · `settings.template_saved` · `settings.template_deleted` **D** · `public_pages.config_saved` · `public_pages.published`                    |
| Pricing             | `pricing.rates_updated` · `pricing.dates_blocked` · `pricing.dates_unblocked` · `pricing.smart_config_changed` · `pricing.smart_applied`                                           |
| Finance / maint.    | `finance.entry_created` · `finance.entry_updated` · `finance.entry_deleted` **D** · `finance.report_exported` · `maintenance.task_created` · `maintenance.task_deleted` **D**      |
| Plans & billing     | `billing.checkout_started` · `billing.plan_downgraded` **D** · `billing.plan_overridden_by_platform` (super-admin mirror)                                                          |
| Verification        | `verification.submitted` · `verification.approved` · `verification.rejected` **D** (approve/reject are super-admin → org-scoped mirror rows)                                       |
| Integrations        | `integrations.connected` · `integrations.disconnected` **D** · `integrations.config_changed` (calendar sync, voice receptionist, Meta inbox)                                       |
| Marketing / inbox   | `marketing.template_saved` · `marketing.template_deleted` **D** · `marketing.published_to_meta` (warning) · `marketing.external_review_moderated` · `inbox.settings_changed`       |
| AI controls         | `ai.assistant_toggled` · `ai.config_changed`                                                                                                                                       |
| Guest / public      | `guest.sd_form_submitted` · `guest.review_submitted` · `guest.voucher_claimed` · `guest.pay_parking_submitted`                                                                     |
| Security            | `security.denied_destructive_action` (destructive denials only)                                                                                                                    |
| System / cron       | `system.cron_run` (one summary row per run)                                                                                                                                        |

`D` = `severity: destructive`.

### Thin helpers (prefer these when the access context fits)

| Helper                                                         | Use from                                                                                                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_shared/activityLog.ts#logActivity`                           | Any handler with a full `OrgAccessContext` / `PropertyAccessContext` / `ParkingTeamAccessContext`.                                                                     |
| `_shared/teamActivity.ts#logTeamActivity`                      | `*-team-{members,invitations,custom-roles}` handlers.                                                                                                                  |
| `_shared/assetActivity.ts#logAssetActivity`                    | Property/parking-scoped handlers whose resolver returns only `{ kind, id }` (finance, pricing, settings, templates). Resolves the org id from the property/parking id. |
| `_shared/parkingActivity.ts#logParkingStatusChange`            | Any parking status write (no orchestrator).                                                                                                                            |
| `_shared/guestActivity.ts#logGuestActivity`                    | Public / guest-facing handlers — resolves the org from the booking's `property_id` / `parking_id`, masks the guest actor.                                              |
| `superAdminAudit.ts#logSuperAdminAction` `mirrorToOrgActivity` | Curated super-admin actions that change one org's state — pass `{ organizationId, action, ... }` to also land an org-scoped row.                                       |

## Related

- Rule: **`.cursor/rules/audit-logging.mdc`** (always-on)
- Plan: **`docs/workflow/planned/org-activity-audit-log.md`**
- Also decide: **`plans-and-permissions`** · Scoping: **`multi-tenancy`** · Docs: **`documentation-maintenance`**
