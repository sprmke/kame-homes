---
title: 'GitHub Environments — CI/CD one-time setup'
status: active
tags: [operations, deployment, ci-cd, github]
updated: 2026-08-09
---

# GitHub Environments — CI/CD one-time setup

**Full matrix (git / Vercel / URLs / secrets):** [`ci-cd-environment-matrix.md`](./ci-cd-environment-matrix.md)

**Phased plan:** [`multi-tenant-dev-prod-environments.md`](../../workflow/in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md)

GitHub Environment names are **not** git branch names:

| GitHub Environment | Git branch that triggers it | Purpose                                             |
| ------------------ | --------------------------- | --------------------------------------------------- |
| **`development`**  | **`develop`**               | Auto Supabase deploy to **fwor…**                   |
| **`production`**   | Manual (Phase B)            | Mt-prod Supabase — **not configured until release** |

**No `production` git branch.** At release, merge **`develop` → `main`** and use **`main`** for Vercel Production.

Vercel **`Preview`** / **`Production`** are separate — configured in Vercel dashboard, not here.

---

## Workflows

| Workflow          | Trigger                                                                       | GitHub Environment              | Target                          |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------- | ------------------------------- |
| `ci.yml`          | Push/PR `main`, `develop`                                                     | —                               | Quality only                    |
| `cd-dev.yml`      | Push **`develop`** (paths: `supabase/**`, `scripts/deploy/**`, workflow file) | **`development`**               | MULTI_TENANT_DEV `fwor…`        |
| `cd-preprod.yml`  | Manual                                                                        | `preproduction`                 | Optional rehearsal              |
| `cd-prod.yml`     | Manual (gated)                                                                | **`production`**                | MULTI_TENANT_PROD — **Phase B** |
| `cd-rollback.yml` | Manual                                                                        | `development` / `preproduction` | Validates env                   |

**Note:** Vercel deploys UI from git. `cd-dev.yml` deploys **Supabase only**.

---

## Environment: `development` (required now)

GitHub → repo → **Settings → Environments → New environment** → name: **`development`**

_(Not named `develop` — that is the git branch.)_

Add **Environment secrets**:

| Secret                    | Value                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`   | Supabase PAT ([Account → Access Tokens](https://supabase.com/dashboard/account/tokens))                                                                               |
| `SUPABASE_PROJECT_REF`    | `fworvijbrwpyngycotbz`                                                                                                                                                |
| `SUPABASE_DB_PASSWORD`    | Database password used by linked CLI migration commands                                                                                                               |
| `SUPABASE_ANON_KEY`       | Dev anon key for post-deploy smoke + adversarial tests. **Optional** if `SUPABASE_ACCESS_TOKEN` can call the Management API (`ci-smoke.sh` resolves anon when unset). |
| `DEV_DB_URL`              | Session-pooler URI for backups and cd-dev `pg_stat_statements` capture (production-readiness doc 00). Empty secret skips capture with no artifact.                    |
| `LEGACY_PROD_PROJECT_REF` | `zfttdwtceyqszyeyhilc`                                                                                                                                                |

**Do not** add these to Vercel — the SPA needs **`VITE_*`** vars on Vercel Preview instead.

Add environment variable `SMOKE_PROPERTY_SLUG` with a stable **ACTIVE public** dev property when you want full post-deploy smoke (property, availability, search). When unset, `ci-smoke.sh dev` uses the first slug from `list-public-properties`, or passes **partial** smoke (listing only) if hosted dev has zero public listings.

### After `DEV_DB_URL` is set (production-readiness doc 00)

1. Push to **`develop`** with a change under `supabase/**` or `scripts/deploy/**`, or use **Actions → CD Dev → Run workflow** if wired, so **`cd-dev.yml`** deploy runs with the secret present.
2. Open the green run → confirm the **pg_stat_statements snapshot** step did not emit `pg_stat skipped`.
3. Download the artifact: `gh run download <run-id> -n pg-stat-statements-hosted-dev`.
4. Copy the JSON into `docs/workflow/planned/production-readiness-checklist/baselines/` (keep the `*-pg-stat-statements-hosted-dev-ci.json` naming).
5. Update doc **00** row 4 and the checklist **README** operator section with the run id.

Edge latency uses the same pattern with artifact name `edge-latency-hosted-dev`.

---

## Environment: `production` (mt-prod — Phase B only)

**Defer** until MULTI_TENANT_PROD Supabase exists and legacy data migration is planned.

Same secret **names**, mt-prod ref:

| Secret                    | Value                                            |
| ------------------------- | ------------------------------------------------ |
| `SUPABASE_PROJECT_REF`    | **MULTI_TENANT_PROD** ref _(not fwor, not zftt)_ |
| `LEGACY_PROD_PROJECT_REF` | `zfttdwtceyqszyeyhilc`                           |
| `SUPABASE_ACCESS_TOKEN`   | PAT with access to mt-prod project               |
| `SUPABASE_DB_PASSWORD`    | mt-prod database password                        |
| `SUPABASE_ANON_KEY`       | mt-prod anon key for public endpoint smoke tests |
| `PROD_DB_URL`             | mt-prod session-pooler URI for complete backup   |

Add **Required reviewers** for human promote and environment variable
`SMOKE_PROPERTY_SLUG` with a stable active mt-prod property. Enable
`CUTOVER_ENABLED=true` only when approved. Wire `cd-prod.yml` deploy step.

**Legacy live cutover** (apex `kamehomes.space`) is a separate step — see [`production-deployment.md`](./production-deployment.md).

---

## Vercel env vars (not GitHub)

Configure in **kame-homes** → Settings → Environment Variables:

| Vercel column  | Git branch (now / at release) | URL                   | Supabase                           |
| -------------- | ----------------------------- | --------------------- | ---------------------------------- |
| **Preview**    | **`develop`** (now)           | `dev.kamehomes.space` | fwor anon URL + key                |
| **Production** | **`main`** (at release)       | `app.kamehomes.space` | mt-prod anon URL + key _(Phase B)_ |

See [`multi-tenant-dev-prod-setup.md`](./multi-tenant-dev-prod-setup.md).

---

## Branch protection (recommended)

| Branch    | Rules                                           |
| --------- | ----------------------------------------------- |
| `main`    | Require PR, require `quality` CI, no force push |
| `develop` | Require PR on PRs (optional), no force push     |

At release: protect **`main`** as the multi-tenant prod line (after **`develop` → `main`** merge).

---

## Verify CD (Phase A)

1. **`development`** secrets configured.
2. Push to **`develop`**.
3. Actions → **CD Dev** → deploy job succeeds.
4. Legacy **`zftt…`** unchanged.
5. `dev.kamehomes.space` → Network → **`fwor…`**.

---

## Related

- Status + todos: [`multi-tenant-dev-prod-environments.md`](../../workflow/in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md)
- Setup guide: [`multi-tenant-dev-prod-setup.md`](./multi-tenant-dev-prod-setup.md)
- Legacy migration: [`legacy-to-mt-prod-migration.md`](./legacy-to-mt-prod-migration.md)
- CI/CD implementation plan (in progress): [`ci-cd-dev-prod.md`](../../workflow/in-progress/ci-cd-environments/ci-cd-dev-prod.md)
