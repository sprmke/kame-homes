---
name: documentation-maintenance
description: >-
  Update project docs in the same change as code. REQUIRED whenever implementing
  or materially changing features, routes, pages, UI behavior, edge functions,
  migrations, env vars, APIs, integrations, or user-visible flows. Use before
  claiming a task done, when finishing a PR/phase, or when Claude Code would
  otherwise ship code without docs. Mirrors always-on Cursor rule
  documentation-maintenance.mdc (Claude Code cannot auto-load .mdc files).
---

# Documentation maintenance (same-change docs)

**Non-negotiable:** behavior changes ship with matching docs in the **same** change — not a follow-up the user must request.

This skill is the Claude Code / skill-picker equivalent of Cursor’s always-on **`.cursor/rules/documentation-maintenance.mdc`**. Invoke it (or follow it without waiting to be asked) on every material change.

## When this applies (almost always)

- New or changed **features**, **routes**, **pages**, **sections**
- **Validation**, **save paths**, **permissions**, **UX**
- **Edge functions**, **API** request/response shapes, **env vars**
- **DB schema / migrations**, storage columns
- **Integrations**, emails, booking workflow, plans/pricing entitlements

**Skip only:** typos, formatting-only, internal renames with no API/UX impact.

## What to update

| Change                                                  | Update                                                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture, routes, env, API, data model, deployment  | **`docs/PROJECT.md`**                                                                                                                  |
| Page / section behavior, save flows, validation         | **`docs/guides/routes/*`** — invoke **`route-guides`** skill (no exceptions)                                                           |
| **UI layout, modals, menus, navigation** in `ui/src/**` | Invoke **`mobile-responsive`** skill; follow **`mobile-native-ui.mdc`** + **`mobile-responsive.mdc`**                                  |
| Pricing plans / tier catalog / entitlements             | **`/for-hosts/pricing`** (live) + **`docs/architecture/plans-feature-matrix.md`** + Plans route guides                                 |
| **New host feature (Plans and/or Team RBAC)**           | **`plans-and-permissions`** skill + always-on **`.cursor/rules/plans-and-permissions.mdc`** — decide both or mark N/A                  |
| **New / changed mutating capability**                   | **`audit-logging`** skill + always-on **`.cursor/rules/audit-logging.mdc`** — emit an `activity_log` event or mark `activity-log: N/A` |
| Booking status / transitions / side-effects             | **`.cursor/rules/booking-workflow.mdc`**                                                                                               |
| Admin auth / allow list / new admin endpoints           | **`.cursor/rules/admin-auth.mdc`**                                                                                                     |
| Edge JWT/CORS / serve conventions                       | **`.cursor/rules/supabase-edge-functions.mdc`**                                                                                        |
| Migration / backfill runbooks                           | **`docs/archive/operations/migration-runbook.md`**                                                                                     |
| Booking-flow redesign decisions                         | **`docs/archive/planning/NEW_FLOW_PLAN.md`**                                                                                           |
| Shipped / cancelled backlog                             | GitHub Issues + **`docs/README.md`** (+ archive under `docs/archive/todos/shipped/`)                                                   |

Canonical detail: **`.cursor/rules/documentation-maintenance.mdc`** · route mapping: **`.cursor/rules/route-guides.mdc`** · always-loaded Claude copy: **`CLAUDE.md`** § Docs are the source of truth.

## Workflow (every material change)

1. **Identify** which rows in the table above apply (usually at least `PROJECT.md` and/or a route guide).
2. **Implement** the code change.
3. **Update docs in the same session** — small accurate edits; do not defer.
4. **Route/page work** → run the **`route-guides`** checklist (Host-facing knowledge, progress table, README index).
5. **Before saying done** — confirm docs were touched (or explicitly note why the change is trivial and docs-exempt).

## Finish checklist

- [ ] Matching **`docs/guides/routes/*.md`** updated if any page/section/UX changed (`route-guides`)
- [ ] **`docs/PROJECT.md`** updated if API / env / architecture / data model changed
- [ ] Canonical **`.cursor/rules/*.mdc`** updated if booking workflow or admin auth invariants changed
- [ ] Plans/pricing surfaces updated if entitlements or tier presentation changed
- [ ] **`plans-and-permissions`** decided (implemented or explicit N/A) for any new host capability
- [ ] **`audit-logging`** decided — `activity_log` event emitted (or explicit `activity-log: N/A — <why>`) for any mutating change
- [ ] **`mobile-responsive`** invoked and §11 checklist passed for any UI change in `ui/src/**`
- [ ] No “docs later” left for the user

## Related

- Read-before-code: **`docs-first`** skill
- Per-route guides: **`route-guides`** skill
- Indexes: **`docs/README.md`**, **`.claude/README.md`**, **`.cursor/rules/README.md`**
