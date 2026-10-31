---
title: 'Roadmap / gaps'
status: active
tags: [architecture, roadmap]
updated: 2026-08-14
---

# Roadmap / gaps

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split. See also [`docs/archive/planning/NEW_FLOW_PLAN.md`](../archive/planning/NEW_FLOW_PLAN.md) and GitHub Issues for the live backlog.

---

## 13. Roadmap / gaps (from `docs/todos/` vs code)

Examples **not** fully reflected in code or only partially done:

- Multi-step stepper + preview; image optimization before upload; AI validation of IDs and other guest uploads; carousel hero; optional query-param persistence across routes for non-admin flows.
- **Notification Center fast-follows** (`notifications` table, shipped 2026-08-14): retention/cleanup cron for old rows (no TTL yet — table grows unbounded); realtime push for property/parking-only team members (`user_can_access_org_notifications` only checks `organization_members`, so a member with no org-level row gets list/mark-read access via the edge function but no live push — same known gap as the social-inbox realtime precedent); deferred event types not in the v1 catalog — guest portal submissions, team/org membership changes, maintenance/finance reminders.

Use **[`docs/README.md`](../README.md)** and [GitHub Issues](https://github.com/sprmke/kame-homes/issues) as the live product backlog; this doc describes **current** implementation unless a section explicitly calls out planned work.
