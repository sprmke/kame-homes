---
stage: done
title: 'Super Admin audit log'
status: in-progress
tags: [planning, planned-modules, super-admin, admin, audit]
updated: 2026-09-06
---

## Status (2026-09-05)

**P1 shipped.** Migration `20261305130000_super_admin_audit_events.sql`, `_shared/superAdminAudit.ts#logSuperAdminAction()`, `list-super-admin-audit` edge fn, `/admin/audit` page, org-hub **Activity** tab. Wired into 6 call sites: org plan assign, verification approve/reject/request-changes, parking payout disburse/clawback, AI kill-switch update, AI credit-wallet adjust, platform settings update. Verified end-to-end (write → read).

**Remaining (P2+):** wire the rest of the mutation sites listed below (development CRUD, FAQ CRUD, platform host-settings/announcements). Richer viewer (filter by action type) is a nice-to-have.

---

# Super Admin audit log

**Spun out of** [`super-admin-console-overhaul.md`](./super-admin-console-overhaul.md) Phase 6.

## Problem

Super-admin mutations (plan assigns, org verification approve/reject, parking-payout
disburse/clawback, AI kill-switch flips, credit-wallet adjustments, FAQ/announcement edits) leave
no record. No way to answer "who changed this org's plan last week" or to review platform-team
activity.

## Approach

1. **Migration** — `super_admin_audit_events` (`id`, `actor_email`, `actor_user_id`, `action`
   text, `target_type` / `target_id`, `summary` text, `metadata` jsonb, `created_at`). Index on
   `(target_type, target_id, created_at desc)` and `(created_at desc)`. Service-role only; no RLS
   read path (edge-function gated).
2. **Shared helper** — `_shared/superAdminAudit.ts#logSuperAdminAction(admin, { action, targetType, targetId, summary, metadata })`.
   Fire-and-forget (never block the mutation on an audit write failure — log + continue).
3. **Call sites** — `org-subscriptions-admin` (assign/override/cron), `approve-org-verification`
   / `reject-org-verification`, `parking-payouts` PATCH (disburse + clawback),
   `ai-platform-global-settings` PATCH, `ai-platform-credit-wallet` POST,
   `update-platform-host-settings`, `create/update/delete-help-center-faq`,
   `create-development` / `update-development` / `delete-development`.
4. **Read fn** — `list-super-admin-audit` (`serveSuperAdmin`): `?targetType=&targetId=`, `?actor=`,
   `?action=`, `?page=&limit=`.
5. **UI** — `/admin/audit` list page (shared console scaffold: `SuperAdminPage` + filter toolbar +
   table/card + pagination) **and** an **Activity** tab on the org hub
   (`list-super-admin-audit?targetType=organization&targetId=<org.id>`).

## Phasing

- P1: migration + `logSuperAdminAction` + wire the ~10 mutation sites + `list-super-admin-audit`.
- P2: `/admin/audit` page + nav entry (Platform group).
- P3: org-hub Activity tab + Overview "recent admin actions" panel.
- P4: docs (`edge-functions.md`, route guide, PROJECT.md).

## Notes

- Keep `summary` human-readable ("Assigned Business plan to Acme Rentals"); `metadata` carries the
  structured before/after for drill-down.
- No PII beyond actor email + target ids.
