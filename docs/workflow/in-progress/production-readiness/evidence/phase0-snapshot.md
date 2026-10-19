---
title: 'Phase 0 snapshot — baseline before re-verification'
stage: in-progress
updated: 2026-10-19
kind: evidence
---

# Phase 0 snapshot (2026-10-19)

Parent plan: [`../../production-readiness-launch-audit.md`](../production-readiness-launch-audit.md)

## Repo state

| Item                    | Value                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch / HEAD           | `develop` @ `bc75f73e` (in sync with `origin/develop`)                                                                                                                                     |
| `develop` vs `main`     | `main` is 1848 commits behind (legacy track, expected)                                                                                                                                     |
| Linked Supabase project | `fworvijbrwpyngycotbz` (dev)                                                                                                                                                               |
| Working tree            | 78 changed paths from a **concurrent session** (super-admin system health, marketing themes thumbnails/AI describe, for-hosts tour). Not part of this audit; do not commit them from here. |
| Docker                  | running (29.4.3)                                                                                                                                                                           |
| `gh`                    | authenticated as `sprmke`                                                                                                                                                                  |

## CI / CD on `develop`

| Workflow                       | Last green                             | Latest                                         |
| ------------------------------ | -------------------------------------- | ---------------------------------------------- |
| CI                             | `68993f65` (2026-09-27)                | failing (`39150594476`, `bc75f73e`)            |
| CD Dev (multi-tenant Supabase) | `86df2182` (2026-09-23, `35898933371`) | failing at quality (unbounded guard)           |
| Sync Help Center content (dev) | none found                             | failing: `DEV_SUPABASE_SERVICE_ROLE_KEY` empty |

Hosted dev drift since last green CD: **161 commits, 17 new migrations, 70 edge-function folders**.

## Root causes found (committed tree)

Each CI job stops at its first failing step, so later guards were masked. Running every step locally found:

| Guard                      | Failure                                                                                                                                | Fix (this session, uncommitted)                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge handler tests         | `marketing-themes` missing from assistant parity manifest                                                                              | `excluded('property.marketing', …)` in `_shared/dashboardAssistantParity.ts` + exclusion row in `docs/architecture/ai-dashboard-assistant.md` |
| Unbounded query guard      | `marketing-themes/index.ts` list + template-key scan had no bound                                                                      | `.limit(MAX_THEMES_PER_PROPERTY)` and `.limit(MAX_COUNTED_TEMPLATES)`                                                                         |
| `select('*')` guard        | `marketing-themes`, `_shared/supportTicketSubmitterActions.ts`, `_shared/inboxQuickReplyTemplates.ts` (masked)                         | Allowlisted with reason: single-row insert/update returns or 40-row capped narrow table                                                       |
| Auth matrix guard (doc 21) | 4 functions flagged (masked): `dashboard-stats`, `dashboard-assistant-briefing`, `dashboard-assistant-feedback`, `user-ui-preferences` | Read by hand. Scope via `resolveDashboardStatsScope` (first two) or caller-owned rows (last two). Allowlisted with reasons.                   |

Also fixed for the concurrent system-health work (uncommitted, ships with it): `_shared/systemHealth/probes.ts` row bounds, `select('*')` allowlist entry, AI gateway guard exemption (models-list key probes, no generation).

## GitHub environment `development`

| Secret / var                                                               | State                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `LEGACY_PROD_PROJECT_REF` | present                                                                         |
| `DEV_SUPABASE_SERVICE_ROLE_KEY`                                            | **set this session** from `supabase/.env.dev.local` (unblocks Help Center sync) |
| `DEV_DB_URL`                                                               | missing — needs dev DB password (operator)                                      |
| `SMOKE_PROPERTY_SLUG`                                                      | missing (optional, operator)                                                    |

## Unmerged branch review (`feature/architecture-phase-1` = `feature/marketing-ai-image-quality-hardening`)

- Branch point `33fc0e90` (2026-09-21); `develop` is 186 commits ahead of it. The −57k lines in a straight diff are `develop`'s progress, not branch deletions.
- Branch-only content: ~145 synced `.agents/skills` files, docs, and Sentry + `EdgeError` code.
- **Sentry (`_shared/sentry.ts`, `ui/src/lib/sentry/client.ts`) and `EdgeError` are already on `develop`** (landed via `1d2d5ffc`). Nothing app-facing is unique to the branch.
- Recommendation: do not merge; safe to delete the branch once the skill syncs are confirmed unneeded.

## Error tracking decision

**PostHog is the launch provider for error tracking and alerting.** It is already wired on UI and edge (catalog, PII sanitizer, identity/groups, source maps) and supports error alerts once the operator creates the projects. Sentry stays in the tree as a no-op (no `SENTRY_DSN` set); revisit only if PostHog alerts prove insufficient. Operator action: create PostHog projects + alert destinations (tracked in the operator list).

## Low-severity notes for the ledger

- `dashboard-assistant-feedback`: a user removed from an org can still rate their own past assistant messages (ownership check is user-only, not membership). Low.
- `marketing-themes` folder counts stop at 5000 saved items per property.
