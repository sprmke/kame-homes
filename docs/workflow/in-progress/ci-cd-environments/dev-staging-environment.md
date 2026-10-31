---
title: 'Dev / staging environment'
status: active
tags: [workflow, in-progress, deployment]
updated: 2026-08-09
stage: in-progress
kind: plan
---

# Dev / staging environment

**Authoritative setup guides:**

- Dev bootstrap: [`docs/archive/operations/dev-staging-environment.md`](../../../archive/operations/dev-staging-environment.md)
- **mt-dev setup (now):** [`multi-tenant-dev-prod-setup.md`](../../../archive/operations/multi-tenant-dev-prod-setup.md)
- **Active plan + status:** [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md) · [`ci-cd-environment-matrix.md`](../../../archive/operations/ci-cd-environment-matrix.md)

## Summary (2026-08-09)

| Phase          | Stacks                                                                               | Status      |
| -------------- | ------------------------------------------------------------------------------------ | ----------- |
| **Now**        | legacy (`main` + `zftt…`) · **mt-dev** (`develop` + `fwor…` + `dev.kamehomes.space`) | **Active**  |
| **At release** | + **mt-prod** (new Supabase) · **`develop` → `main`** · `app.kamehomes.space`        | **Pending** |

- **No `production` git branch** — prod release uses **`main`**.
- **Local modes:** full Docker (`./dev.sh`), hosted dev UI (`--ui-only --env dev`), hybrid API (`dev:remote-api`)
- **Dev deploy:** `bun run deploy:supabase:dev` → **`fwor…`** only

## Shipped in repo

| Artifact                  | Path                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Runbook                   | `docs/archive/operations/dev-staging-environment.md`                                         |
| **mt-dev setup**          | `docs/archive/operations/multi-tenant-dev-prod-setup.md`                                     |
| **Legacy → mt-prod stub** | `docs/archive/operations/legacy-to-mt-prod-migration.md`                                     |
| Dev deploy script         | `scripts/deploy/deploy-supabase-dev.sh`                                                      |
| Env templates             | `supabase/.env.dev.example`, `supabase/.env.prod.example`, `ui/.env.development.dev.example` |
| CI dev CD                 | `.github/workflows/cd-dev.yml`                                                               |

## Operator checklist

### Phase A — now

See [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md) § Phase A:

1. Vercel Preview **`VITE_*`** → fwor
2. GitHub **`development`** secrets → test **`cd-dev.yml`**
3. Google OAuth **dev** → fwor
4. Login smoke on **`dev.kamehomes.space`**

### Phase B — at prod release (deferred)

1. Create **MULTI_TENANT_PROD** Supabase
2. Run **legacy → mt-prod** migration ([`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md))
3. Merge **`develop` → `main`**; Vercel Production branch = **`main`**
4. Vercel Production **`VITE_*`** → mt-prod; **`app.kamehomes.space`**
5. Auth + Google OAuth prod on mt-prod
6. GitHub **`production`** secrets + **`cd-prod.yml`**
