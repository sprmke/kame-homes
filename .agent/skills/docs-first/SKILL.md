---
name: docs-first
description: >-
  Read project docs before implementing, then update matching docs in the same
  change. Use when adding or changing routes, pages, edge functions, booking
  workflow, org/property UI, env vars, APIs, or any user-visible behavior in
  guest-form-management. Pairs with documentation-maintenance (write) and
  route-guides (per-page guides).
---

# Docs-first (Guest Form Management)

Do not implement from memory. Align with repo docs first — then **write docs back** in the same change.

## When to use

- New or changed user-visible behavior, API, DB columns, or env vars
- Booking status, emails, calendar, sheets, Gmail listener, inbox
- Unsure where code or validation lives

## Steps

1. **`docs/README.md`** — index; then **`docs/architecture/overview.md`** (full-app picture) and **`docs/PROJECT.md`** for API, env vars, routes
2. **`docs/guides/routes/README.md`** — per-route behavior (update matching guide in the same change)
3. **`docs/README.md`** — backlog on GitHub Issues (Product backlog section); shipped history in `docs/archive/todos/shipped/`
4. **Booking / admin work** — read `docs/archive/planning/NEW_FLOW_PLAN.md`, `.cursor/rules/booking-workflow.mdc`, and `.cursor/rules/admin-auth.mdc` (these are glob-scoped, not always-on — open them when the task touches status/auth)
5. **Edge functions** — `.cursor/rules/supabase-edge-functions.mdc`
6. **Session hygiene** — `.cursor/rules/ai-usage.mdc` (short sessions, no default subagent swarms)

## After implementing (mandatory)

Follow the **`documentation-maintenance`** skill before claiming done:

- Page/section/UX → **`route-guides`** skill → `docs/guides/routes/*`
- API / env / architecture → `docs/PROJECT.md`
- Plans/tiers → `docs/architecture/plans-feature-matrix.md` + Plans route guides
- Booking/auth invariants → matching `.cursor/rules/*.mdc`

Claude Code cannot auto-load Cursor’s always-on `.mdc` rules — treat **`CLAUDE.md` § Docs are the source of truth** and the **`documentation-maintenance`** skill as the equivalent.

## Topic map

| Topic                  | Primary doc / rule                                                               |
| ---------------------- | -------------------------------------------------------------------------------- |
| Routes & page behavior | `docs/guides/routes/*.md`                                                        |
| Architecture (picture) | `docs/architecture/overview.md` → topic files via `docs/PROJECT.md`              |
| Same-change doc writes | `.agent/skills/documentation-maintenance/SKILL.md`                               |
| Booking workflow       | `.cursor/rules/booking-workflow.mdc`                                             |
| Admin auth             | `.cursor/rules/admin-auth.mdc`                                                   |
| Edge functions         | `.cursor/rules/supabase-edge-functions.mdc`                                      |
| Multi-tenancy          | `.cursor/skills/multi-tenancy/SKILL.md`                                          |
| TanStack Query         | `.cursor/skills/tanstack-query/SKILL.md`                                         |
| Forms                  | `.cursor/rules/forms.mdc`                                                        |
| Emails / integrations  | `.cursor/skills/emails/SKILL.md`, `integrations/SKILL.md`                        |
| Social inbox           | `.cursor/skills/social-inbox/SKILL.md`                                           |
| File naming            | `.cursor/rules/naming-conventions.mdc`, `docs/archive/reference/naming-audit.md` |
| Full agent index       | `.cursor/rules/README.md`                                                        |

## Rule

If docs and code disagree, fix the doc in the same change (see `.cursor/rules/documentation-maintenance.mdc` and the `documentation-maintenance` skill).
