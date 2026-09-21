---
title: 'Hosted-dev rollback rehearsal (production-readiness doc 24 / 30)'
status: active
tags: [operations, deployment, rollback, rehearsal, mt-dev]
updated: 2026-09-21
---

# Hosted-dev rollback rehearsal

**Goal:** Prove the team can recover MULTI_TENANT_DEV (`fworvijbrwpyngycotbz`) within a measured RTO using the scripts in this repo — not just read them.

**This document does not replace** `migration-runbook.md` §6 or `production-deployment.md` §12. Read those before any restore.

**Status (2026-09-21):** Preflight script shipped (`scripts/deploy/hosted-dev-rollback-rehearsal-preflight.sh`). **Full drill not executed** in automation; operator must run on a trusted machine with mt-dev credentials.

---

## Preconditions

| Item         | Check                                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Target       | MULTI_TENANT_DEV only — never legacy `zftt…` or mt-prod                           |
| CLI link     | `bun run env:status` shows `dev` / `fwor…`                                        |
| Secrets      | `supabase/.env.dev.local` with `DEV_DB_URL` (session pooler) for backup + restore |
| Pat          | `SUPABASE_ACCESS_TOKEN` for CLI deploy/backup if not already logged in            |
| Empty target | Restore uses `--fresh-target` into a project with **zero** `public` tables        |

Preflight (read-only):

```bash
bun run rehearsal:rollback:dev:preflight
```

---

## Rehearsal sequence

Record **start/end timestamps** for RTO. Append results to `docs/workflow/planned/production-readiness-checklist/24-hosting-and-deployment.md` (Measured before/after or Implementation status).

### 1. Baseline backup

```bash
bun run backup:supabase:dev
```

Confirm new files under `backups/dev/` (`*_schema.sql`, `*_data.sql`). Note file sizes and duration.

### 2. Simulate failure (choose one)

| Option                           | When to use                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| **A. Functions-only bad deploy** | Test `rollback:functions:dev` without touching Postgres            |
| **B. Full DB restore**           | Test `rollback:supabase:dev` into a **new empty** Supabase project |

Option B is the doc 30 "single largest open risk" — prioritize when time allows.

### 3A. Functions rollback (lower risk)

```bash
git log -1 --oneline   # note current SHA
# After a deliberate bad functions deploy (or use a known prior SHA):
bun run rollback:functions:dev -- <good-git-ref>
```

Verify: `curl` public `get-health`, run `bun run verify:deployed-preview` against `https://dev.kamehomes.space`, spot-check host sign-in on dev.

### 3B. Full restore (higher fidelity)

1. Create a **new** Supabase project (or use an agreed empty rehearsal project).
2. `supabase link --project-ref <empty-ref>`
3. `bun run rollback:supabase:dev -- --fresh-target` (typed confirms per script)
4. `bun run deploy:supabase:dev` or `rollback:functions:dev` to align edge code with schema
5. Point **only** your local/hybrid UI at the rehearsal project if needed; do not change Vercel Production

Verify per `migration-runbook.md` §6: row counts sample, auth login, Storage URLs from DB rows, `pg_cron` jobs present, disable crons during restore if duplicating emails (`incident-response.md`).

### 4. Post-restore smoke

Same bar as cd-dev deploy job:

- `./scripts/deploy/ci-smoke.sh dev` (with `SUPABASE_*` env)
- `deno test --allow-net --allow-env supabase/functions/tests/adversarialAuthLive.test.ts`
- `PREVIEW_URL=https://dev.kamehomes.space bun run verify:deployed-preview` (UI still on Vercel dev domain; API must match linked project if you cut over)

### 5. Document RTO

| Metric                      | Value |
| --------------------------- | ----- |
| Backup duration             |       |
| Restore duration            |       |
| Functions rollback duration |       |
| Total RTO                   |       |
| Surprises / manual steps    |       |

---

## What not to do

- Do not run `rollback:supabase:prod` without **`kamewave`** in the same user message (agents blocked).
- Do not restore into the **live** `fwor…` project without `--fresh-target` semantics (in-place restore is disabled by design).
- Do not rehearse against production Vercel or legacy `main` / `zftt…`.

---

## Related

- `scripts/deploy/rollback-supabase.sh`, `rollback-functions.sh`, `backup-supabase.sh`
- `.github/workflows/cd-rollback.yml` (env validation only in v1)
- Checklist: `docs/workflow/planned/production-readiness-checklist/24-hosting-and-deployment.md`, `30-availability-and-recovery.md`
