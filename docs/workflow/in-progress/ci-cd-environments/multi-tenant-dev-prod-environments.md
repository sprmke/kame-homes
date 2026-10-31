---
title: 'Multi-tenant environments — phased plan (dev now · prod at release)'
status: active
tags: [workflow, in-progress, deployment, supabase, vercel, multi-tenancy]
updated: 2026-09-16
stage: in-progress
kind: plan
---

# Multi-tenant environments — phased plan

## Decision (2026-08-09)

| When                | Supabase                                        | Git (new app)                          | URL                       |
| ------------------- | ----------------------------------------------- | -------------------------------------- | ------------------------- |
| **Now (WIP)**       | **`fwor…` dev only**                            | **`develop`**                          | **`dev.kamehomes.space`** |
| **At prod release** | **New mt-prod project** + legacy data migration | **`main`** (not a `production` branch) | **`app.kamehomes.space`** |

- **No second Supabase project until release** — saves ~$10/m while building.
- **Do not create a `production` git branch** — at release merge **`develop` → `main`** and point **`kame-homes`** Production at **`main`**.
- **Legacy** (`kamehomes.space` + `zftt…`) stays live until cutover; then migrate data/storage into mt-prod per [`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md).

**Matrix:** [`ci-cd-environment-matrix.md`](../../../archive/operations/ci-cd-environment-matrix.md)

---

## Status

### Done ✅

| Item                                                                           |
| ------------------------------------------------------------------------------ |
| Two-project strategy (dev now, prod at release — not branching)                |
| Supabase **MULTI_TENANT_DEV** `fworvijbrwpyngycotbz` deployed                  |
| Git **`develop`** = multi-tenant line                                          |
| **`dev.kamehomes.space`** DNS + Vercel Preview → branch **`develop`**          |
| Removed misplaced `SUPABASE_*` from Vercel (GitHub only)                       |
| Supabase Auth URLs on **fwor** for dev domain (+ localhost in Redirect URLs)   |
| CI/CD repo: `cd-dev.yml`, `ci-deploy*.sh`, `ci.yml`                            |
| Legacy apex **`kamehomes.space`** on `guest-form-management-app` / **`zftt…`** |
| Docs: setup guide, environment matrix, prod env example template               |

### In progress 🚧

| Item                                                                                          |
| --------------------------------------------------------------------------------------------- |
| Vercel **Preview** `VITE_*` → fwor → redeploy **`develop`**                                   |
| GitHub Environment **`development`** + secrets → **`cd-dev.yml`** green on push **`develop`** |
| Google OAuth **dev** client → fwor Supabase provider                                          |
| Login smoke on **`dev.kamehomes.space`**                                                      |

### Deferred until prod release 📋

See **Phase B** below and [`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md).

| #   | Task                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create **MULTI_TENANT_PROD** Supabase project                                                                                    |
| 2   | **`legacy-to-mt-prod` migration** — Postgres data + Storage objects **`zftt…` → mt-prod**                                        |
| 3   | Merge **`develop` → `main`**; **`kame-homes`** Production Branch = **`main`**                                                    |
| 4   | Vercel **Production** `VITE_*` → mt-prod; **`app.kamehomes.space`** live on mt-prod                                              |
| 5   | Supabase Auth + **Google OAuth prod** on mt-prod                                                                                 |
| 6   | Edge secrets on mt-prod                                                                                                          |
| 7   | GitHub **`production`** environment secrets + enable **`cd-prod.yml`**                                                           |
| 8   | Apex / legacy user cutover (optional phase — [`production-deployment.md`](../../../archive/operations/production-deployment.md)) |

**Note:** **`app.kamehomes.space`** DNS may exist early; prod backend/UI wiring waits until Phase B. Do not point Production `VITE_*` at mt-prod until the project exists.

---

## Phase A — Now (dev only)

Daily work: **`develop`** → **`dev.kamehomes.space`** → **`fwor…`**.

### A1 — Vercel Preview (dev UI)

- [ ] **`VITE_*`** on **Preview only** → fwor keys
- [ ] Redeploy **`develop`**
- [ ] Network tab on **`dev.kamehomes.space`** → **`fwor…supabase.co`**

### A2 — GitHub CD (dev backend)

- [ ] Environment **`development`**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF=fwor…`, `LEGACY_PROD_PROJECT_REF=zftt…`
- [ ] Push **`develop`** → **CD Dev** passes

### A3 — Auth + Google (dev only)

- [x] fwor Site URL = `https://dev.kamehomes.space`; Redirect URLs include localhost
- [ ] Google OAuth **dev** → fwor provider
- [ ] Login works on dev URL + local `./dev.sh --ui-only --env dev`

### A4 — Local

- [x] `supabase/.env.dev.local`, `ui/.env.development.dev`

**Do not** create mt-prod Supabase or **`production`** git branch in Phase A.

---

## Phase B — Prod release (when ready)

Trigger: product ready for **`app.kamehomes.space`** with **isolated prod data**.

### B1 — Create mt-prod Supabase

- [ ] New project (Postgres 17, same region as fwor)
- [ ] Record ref in [`deployment.md`](../../../architecture/deployment.md)
- [ ] `supabase/.env.prod.local` + schema/functions deploy (`kamewave` if using prod scripts)

### B2 — Legacy data + storage migration

- [ ] Implement/run migration per [`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md)
- [ ] Verify row counts, Storage objects, Auth strategy documented
- [ ] Rehearse on fwor or staging copy before mt-prod cutover

### B3 — Git + Vercel (use **`main`**, not `production` branch)

- [ ] PR **`develop` → `main`** (multi-tenant code on main)
- [ ] **`kame-homes`** → Settings → Environments → Production → Branch = **`main`**
- [ ] Vercel **Production** `VITE_*` → mt-prod
- [ ] **`app.kamehomes.space`** → Production → verify Network → mt-prod ref

### B4 — Integrations (prod)

- [ ] Supabase Auth on **mt-prod**: Site URL `https://app.kamehomes.space`
- [ ] **Google OAuth prod** client (separate from dev) → mt-prod
- [ ] Gmail / Calendar / Resend / Meta — prod secrets on mt-prod (mirror dev checklist)
- [ ] Update Google Cloud authorized origins + redirect URIs for prod domain

### B5 — GitHub CD prod

- [ ] GitHub **`production`** environment → mt-prod ref secrets
- [ ] Set `CUTOVER_ENABLED=true` only when approved
- [x] Wire **`cd-prod.yml`** deploy step (quality, schema diff, backup, strict migration order, functions, real-GET smoke); keep the cutover gate disabled until mt-prod exists
- [ ] Manual promote: merge to **`main`** + run CD prod when migrations changed

### B6 — Legacy apex cutover (separate approval)

- [ ] Optional later: **`kamehomes.space`** apex → new app ([`production-deployment.md`](../../../archive/operations/production-deployment.md) Phase D)
- [ ] Retire or redirect legacy `guest-form-management-app` when users moved

---

## CI/CD summary (current)

| Workflow         | Active now?               | Trigger                     | Target                               |
| ---------------- | ------------------------- | --------------------------- | ------------------------------------ |
| `ci.yml`         | ✅                        | PR + push `main`, `develop` | Quality                              |
| `cd-dev.yml`     | ✅ (needs GitHub secrets) | push **`develop`**          | **fwor…**                            |
| `cd-prod.yml`    | ✅ implemented, gated     | manual                      | mt-prod — enable only in **Phase B** |
| `cd-preprod.yml` | ❌                        | manual                      | optional                             |

---

## Related

- Setup (Phase A): [`multi-tenant-dev-prod-setup.md`](../../../archive/operations/multi-tenant-dev-prod-setup.md)
- Migration runbook (Phase B): [`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md)
- Shipped dual-track CI: [`ci-cd-dev-prod.md`](./ci-cd-dev-prod.md)
