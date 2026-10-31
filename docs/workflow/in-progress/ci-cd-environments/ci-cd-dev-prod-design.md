---
title: 'CI/CD to dev and production (Supabase + Vercel)'
status: active
stage: in-progress
kind: design
tags: [workflow, in-progress, deployment, ci-cd, supabase, vercel, operations, multi-tenancy]
updated: 2026-08-09
---

# CI/CD to dev and production — Design

## Status

**In progress** — Phases A–C shipped in repo; Phase F (environments wiring) active; Phase B prod deferred.

- Spec: this file.
- **Implementation plan:** [`ci-cd-dev-prod.md`](./ci-cd-dev-prod.md)
- **Status + todos:** [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md)
- Builds on: quality CI, Vercel Preview/Production, deploy guardrails, multi-tenancy deploy warnings in production-deployment §4.

### Branch rename FAQ

Prefer **align or merge multi-tenant tip into long-lived `develop`**, then point **`kame-homes`** Production Branch at `develop`. Do **not** rename in a way that force-updates **`main`**. See plan Task 0.

## Context (why this is not a simple main→prod pipeline)

| Reality today                                                                                 | Implication                                                                                        |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **`main`** powers the **live** app used by customers                                          | Must stay stable; only **legacy-safe** deploys                                                     |
| **`main` Vercel Production** → **legacy Supabase project** (single-tenant-era data + storage) | **Never** push multi-tenant migrations/functions at this project from CI until an explicit cutover |
| WIP: **`feature/support-multi-users-and-properties`** (multi-tenant code + migrations)        | Ship via **staging track**, not by overwriting `main`/legacy Supabase                              |
| **`develop`** branch already exists on remote                                                 | Reuse as the long-lived multi-tenant integration branch (don’t invent a parallel name)             |
| Production docs already ban multi-tenant functions on prod without schema                     | Align CI/CD and Vercel with that rule — **hard fail closed**                                       |

**Prime directive:** Anything we automate now must **not** mutate or replace:

1. the **`main`** production SPA configuration pointing at legacy Supabase, or
2. the **legacy Supabase project** (DB + Storage + Auth users) until a planned cutover window.

---

## Recommended dual-track model (locked)

Two **parallel products** until multi-tenant is ready, then one cutover:

```text
TRACK A — LIVE (protect users)          TRACK B — MULTI-TENANT STAGING (iterate safely)
─────────────────────────────          ──────────────────────────────────────────────
git: main (hotfixes only)              git: develop ← merge feature/* here first
Vercel: Production                     Vercel: Staging (or dedicated Preview) for `develop`
Supabase: LEGACY_PROD (untouched by    Supabase: MULTI_TENANT_DEV (auto CD)
          multi-tenant CD)             Supabase: MULTI_TENANT_PREPROD (optional promote practice)
                                      (Later cutover → MULTI_TENANT_PROD or upgraded LEGACY)
```

### Why not “merge multi-tenant into `main` and create develop from main first”?

Your suggestion is directionally right (**long-lived develop + promote to main**). Adjustments for **GFM’s dangerous asymmetry**:

| Step people often do                                  | Best practice here                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create `develop` from `main`, then merge feature      | Fine for history, **but** `main` must **not** receive multi-tenant until cutover. `develop` already exists — **reset/update `develop` from multi-tenant tip**, not force multi-tenant through `main` first |
| Treat Vercel Production as develop                    | **Never** — would wire multi-tenant UI at users or wrong DB                                                                                                                                                |
| Point CI prod deploy at existing production Supabase  | **Blocked until cutover** — that project is LEGACY_PROD                                                                                                                                                    |
| Use Supabase “DB branching” product as the only model | Optional later; we use **separate projects** (already in runbook / separate accounts) — clearer fail-closed refs                                                                                           |

### Confirmed: phased Supabase projects (2026-08-09)

**Decision:** **MULTI_TENANT_DEV** (`fwor…`) **now**; **MULTI_TENANT_PROD** (new project) **at prod release** — not Supabase branching.

**Active plan:** [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md) · guide [`multi-tenant-dev-prod-setup.md`](../../../archive/operations/multi-tenant-dev-prod-setup.md).

**No `production` git branch.** At release: merge **`develop` → `main`**, wire **`kame-homes`** Production to **`main`** + mt-prod. Legacy data migration: [`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md).

### Confirmed answer to your branching question

1. **Yes — long-lived `develop` for multi-tenant integration.**
2. **Do not** merge `feature/support-multi-users-and-properties` into **`main`** until cutover readiness.
3. **`develop` workflow (best):**
   - Ensure `develop` is the multi-tenant line: merge **feature → `develop`** (or rename/repoint once feature is stable).
   - Periodically merge **`main` → `develop`** (hotfixes only) so develop stays cognizant of production fixes — resolve conflicts on develop, not reverse.
   - Day-to-day PRs: target **`develop`**, not `main`.
4. **`main`:**
   - Hotfix / emergency only for **legacy** users.
   - Prefer cherry-picks **from develop back to main only if** the change is safe under **legacy schema** (no multi-tenant dependency).
5. When multi-tenant is ready: cutover procedure (later section) then **`develop` → `main`**, flip Vercel Production env to multi-tenant project, enable multi-tenant prod CD secrets.

---

## Environment matrix (source of truth)

Names used in docs and CI. **Project refs** (public in URLs) are listed in [`docs/architecture/deployment.md`](../../architecture/deployment.md); **keys** stay in gitignored env / GitHub secrets only.

| Logical env                  | Git branch                        | Vercel target                                           | Supabase project                                                                                | Mutated by CI?                                                                             |
| ---------------------------- | --------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **legacy-prod**              | `main`                            | **Production**                                          | **LEGACY_PROD** `zfttdwtceyqszyeyhilc`                                                          | **No multi-tenant CD.** Hotfixes only (manual or separate legacy workflow if ever needed). |
| **mt-dev**                   | `develop` (+ feature PR Previews) | **Staging** for `develop`, **Preview** for PRs → mt-dev | **MULTI_TENANT_DEV** `fworvijbrwpyngycotbz`                                                     | **Yes — auto** on push to `develop`                                                        |
| **mt-preprod** (recommended) | promote from `develop` SHA        | Optional second Vercel env or temporarily Staging       | **MULTI_TENANT_PREPROD** (fresh multi-tenant prod _shape_, empty or copied data for rehearsals) | **Human promote only**                                                                     |
| **mt-prod**                  | `main` **after cutover**          | **Production** (after env flip)                         | Either **new** multi-tenant prod project **or** upgraded LEGACY after migration                 | **Human promote only**                                                                     |

### Supabase project inventory (target state)

| Project                         | Project ref                             | Account guidance                                         | Purpose                                                               |
| ------------------------------- | --------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| **LEGACY_PROD**                 | `zfttdwtceyqszyeyhilc`                  | Existing prod account                                    | Live bookings, Auth, Storage — **do not CI-deploy multi-tenant here** |
| **MULTI_TENANT_DEV**            | `fworvijbrwpyngycotbz`                  | Separate **dev** account (`.env.dev.local`)              | Daily multi-tenant API + data for staging UI                          |
| **MULTI_TENANT_PREPROD** (rec.) | _(create later)_                        | Same org as eventual mt-prod or isolated                 | Dry-run promote, cutover dress rehearsals                             |
| **MULTI_TENANT_PROD**           | _(create at release — see setup guide)_ | **`kame-homes`** Production URL (`**main**` after merge) | Prod backend for new app — after legacy data migration                |

Informal alias **NEW_PROD** = **MULTI_TENANT_DEV** until cutover — not Vercel Production.

**GitHub Environments** (CI secrets scopes) map 1:1 to targets we allow CD to touch:

| GH Environment  | Maps to                                                               | Reviewers  | Deployable SHA                     |
| --------------- | --------------------------------------------------------------------- | ---------- | ---------------------------------- |
| `development`   | MULTI_TENANT_DEV                                                      | none in v1 | `develop` only                     |
| `preproduction` | MULTI_TENANT_PREPROD                                                  | required   | `develop` only                     |
| `production`    | MULTI_TENANT_PROD (**not** LEGACY until cutover docs flip the secret) | required   | `main` only **after** cutover flag |

**Hard guard in every CD job:** assert `SUPABASE_PROJECT_REF` is in an **allow-list** env var and is **not** equal to `LEGACY_PROD_PROJECT_REF` unless `CUTOVER_LEGACY_UPGRADE=true` (default false). Fail closed before link/push.

---

## Vercel — locked setup (two projects, same repo)

| Vercel project                         | Dashboard                                                                         | Production branch                                              | Production env → Supabase                      |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| **LEGACY** `guest-form-management-app` | [sprmkes-projects](https://vercel.com/sprmkes-projects/guest-form-management-app) | **`main`**                                                     | LEGACY `zftt…`                                 |
| **NEW** `kame-homes`                   | [kame-works](https://vercel.com/kame-works/kame-homes)                            | Preview: **`develop`** · Production: **`main`** _(at release)_ | Preview → **fwor…** · Production → **mt-prod** |

Each project **Production** env holds that track's `VITE_*` vars. Multi-tenant deploys only via **`kame-homes`** until cutover.

**Locked:** dedicated second Vercel project (`kame-homes`) — not single-project Preview/Staging.

### Preview for PRs (optional)

| Vercel project                  | PR target            | Preview env      |
| ------------------------------- | -------------------- | ---------------- |
| **`kame-homes`**                | mt branch            | MULTI_TENANT_DEV |
| **`guest-form-management-app`** | `main` hotfixes only | LEGACY           |

Branch-protection: forbid multi-tenant merges into `main` until cutover.

### OAuth / Auth redirects (manual, not CI)

Each public origin needs listing in Supabase Auth + Google OAuth:

- **`guest-form-management-app`** domain → **LEGACY** Auth only.
- **`kame-homes`** domain (+ Previews) → **MULTI_TENANT_DEV** Auth only.

---

## Git workflow (day to day)

```text
feature/*  ──PR──►  develop  ──(auto)──►  MULTI_TENANT_DEV + kame-homes (Production)
                      │
                      │ human Promote
                      ▼
               MULTI_TENANT_PREPROD   (optional rehearsals)

main (hotfixes) ──► LEGACY_PROD + guest-form-management-app (Production)

   └── cutover: merge develop → main, consolidate Vercel/Supabase (Phase D)
```

### Bringing feature work onto `develop` (now)

1. Checkout `develop`, update from remote.
2. Merge **`feature/support-multi-users-and-properties` → `develop`** (or open a PR).
3. Fix conflicts on develop; **do not** force-push `main`.
4. Deploy MULTI_TENANT_DEV from `develop` (CI or `deploy:supabase:dev`).
5. **`kame-homes`:** Production Branch = `develop` (or keep `feature/…` until switched); Production env = `fwor…`.
6. Continue feature work as PRs **into `develop`**.

If `develop` is stale relative to the feature tip: **prefer develop = multi-tenant tip** over “main-only history.” History can be cleaned later; **user safety first**.

### Hotfixes on legacy production

```text
hotfix/* from main → PR to main → guest-form-management-app (Production)
                 └── optionally cherry-pick into develop if still relevant without multi-tenant deps
```

---

## CI/CD (revised triggers)

### Quality

- `.github/workflows/ci.yml` on **PRs + `develop` + `main`**.
- Branch protection: required `quality` on both `develop` and `main`.

### Auto CD — multi-tenant **dev** only

| Trigger                 | Workflow     | Target                                             |
| ----------------------- | ------------ | -------------------------------------------------- |
| `push` to **`develop`** | `cd-dev.yml` | MULTI_TENANT_DEV (backup → db → functions → smoke) |

**Not** on push to `main` (that would either hit wrong project or pressure the wrong train).

### Human promote — preprod / (later) prod

| Trigger                                     | Workflow         | Target                                                                                   |
| ------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `workflow_dispatch` “Promote to preprod”    | `cd-preprod.yml` | MULTI_TENANT_PREPROD, Environment `preproduction`                                        |
| `workflow_dispatch` “Promote to production” | `cd-prod.yml`    | MULTI_TENANT_PROD, Environment `production` — **disabled or secret-empty until cutover** |

### Explicit non-targets for automation

- No workflow may receive `LEGACY_PROD` project ref as `SUPABASE_PROJECT_REF` while multi-tenant trees are checked out, unless cutover runbook unlocks it.
- Agent `kamewave` remains for **local** attempts at linked prod; CI uses Environments, not the unlock word.

### Script / CI contract (unchanged intent)

- CI mode flags on deploy/backup (`--ci` / `CI=1` / `DEPLOY_CONFIRM`).
- No `--skip-backup` in CI.
- Ref assertion = expected project.
- Multi-tenancy function guard: **allow** on mt-dev/preprod; **forbid** deploy of multi-tenant functions to LEGACY.
- Reuse existing scripts via thin `ci-deploy.sh` / `ci-smoke.sh`.

---

## Data & storage: transferable without breaking live prod

### Principle

**Copy → rehearse → cut over.** Never “point staging at LEGACY and experiment.”  
All rehearsal writes go to MULTI_TENANT_DEV / PREPROD.

### What must move for multi-tenant prod (when ready)

| Asset                 | Approach                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Postgres data**     | Prefer scripted dump/transform/load into **target multi-tenant project**, not ad-hoc Dashboard clicks. Build on patterns already used (`sync-prod-public-data-to-local`, `pg_dump` / `db dump` in runbooks). Cutover needs **expand schema first** (migrations applied on target), then data load/backfill for `property_id` / orgs as required by multi-tenant model. |
| **Storage (buckets)** | List buckets on LEGACY; `rclone` / platform copy / custom script per bucket to target project (paths preserve object keys where possible). Rehearse sizes and public vs private.                                                                                                                                                                                       |
| **Auth users**        | Hardest. Prefer **same project upgrade** if Auth continuity is critical, **or** export users with official Supabase migration guidance / re-invite if new project. Design cutover chooses A/B **after** inventory — not automatic in v1 CI.                                                                                                                            |
| **Secrets / Edge**    | Manual Dashboard + documented checklist (never copy prod secrets into dev).                                                                                                                                                                                                                                                                                            |
| **Cron / Vault**      | Manual after schema; see scheduled-jobs runbook.                                                                                                                                                                                                                                                                                                                       |

### Recommended cutover strategies (choose later with inventory)

| Strategy                                        | When                                                                                                          | Risk                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **A. New MULTI_TENANT_PROD project + env flip** | Clean multi-tenant host; switch Vercel Production secrets + Auth domains when ready                           | Auth/user migration complexity; DNS/domain updates                                                               |
| **B. In-place upgrade of LEGACY_PROD**          | Migrate schema on same project during maintenance; then merge `develop` → `main` and deploy multi-tenant code | Single project simplifies Auth/Storage; **requires** immaculate backup + rehearsal on PREPROD clone + `kamewave` |

**Best practice until inventory is full:** implement **PREPROD as a clone-shaped rehearsal** (empty + sample loads, then optional full dump drill). **Do not bind CD “production” secrets to LEGACY** until strategy A or B is chosen and rehearsed.

### What we do _now_ (data)

1. Leave LEGACY fully online.
2. Bootstrap MULTI_TENANT_DEV with multi-tenant migrations from `develop` (no LEGACY write).
3. Optional: **read-only** dump from LEGACY for **local/dev seed** (existing sync direction prod→local; never reverse without review).
4. Document cutover as its own runbook section / plan phase (implementation module after CD plumbing).

---

## End-to-end connection map

```text
                    GitHub
         ┌────────────┴────────────┐
         ▼                         ▼
      develop                    main
         │                         │
    quality CI                 quality CI
         │                         │
    cd-dev AUTO                    │
         │                         │ (no multi-tenant CD)
         ▼                         ▼
 MULTI_TENANT_DEV            LEGACY_PROD  ◄── live users
         │                         │
         ▼                         ▼
 Vercel Staging / Preview     Vercel Production
 (mt-dev env vars)            (legacy env vars)

Later cutover:
  develop → main merge
  CD/promote → MULTI_TENANT_PROD (or LEGACY upgraded)
  Vercel Production env vars flip
```

---

## Phased delivery (updated)

### Phase 0 — Isolate & wire tracks (do first; zero user risk)

1. Confirm LEGACY_PROD `zfttdwtceyqszyeyhilc` vs MULTI_TENANT_DEV `fworvijbrwpyngycotbz` — documented in [`deployment.md`](../../architecture/deployment.md).
2. Git: merge multi-tenant feature → **`develop`**; keep **`main`** clean of multi-tenant ship.
3. Vercel: **`guest-form-management-app`** stays `main`+LEGACY; **`kame-homes`** Production branch + env → MULTI_TENANT_DEV.
4. Auth/OAuth: register staging origins on **mt-dev only**.
5. Soft process: no merge to main without “legacy-safe” checklist.

### Phase 1 — CI/CD for multi-tenant track

1. Scripts: CI mode + ref allow-list + “never LEGACY” guard.
2. `cd-dev.yml` on **`develop`**.
3. `cd-preprod.yml` + Environment (optional but recommended).
4. `cd-prod.yml` scaffolded but **secrets empty / workflow disabled** until cutover.
5. Rollback workflows for dev/preprod.
6. Docs + operator checklists.

### Phase 2 — Cutover readiness (separate effort, linked)

1. Choose strategy A or B with Auth/storage constraints.
2. Full dump rehearsal → PREPROD.
3. Storage copy dry-run.
4. Maintenance window plan, rollback plan (LEGACY snapshot + Vercel env rollback).
5. Enable production secrets for mt-prod; merge `develop` → `main` when green.

### Phase 3 — Hardening

- PR→dev deploy when `supabase/**` changes.
- Playwright on Staging.
- Off-runner backup store.
- Vercel Agent PR review (optional).

---

## Success criteria

1. Live users on **main + LEGACY** continue unaffected by multi-tenant work/CD.
2. `develop` changes auto-land on **MULTI_TENANT_DEV** + Staging UI without laptop-only deploys.
3. Human can promote to preprod with approval; production multi-tenant CD cannot hit LEGACY by accident.
4. Cutover path for data/storage/Auth is documented before anyone flips Production env vars.
5. Agents still blocked from careless prod shell without `kamewave`.

## Risks & mitigations

| Risk                                   | Mitigation                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Accidentally CD multi-tenant to LEGACY | Ref allow-list + `LEGACY_PROD_PROJECT_REF` deny; production secrets empty until cutover    |
| Merge multi-tenant to `main` early     | Process + branch protection; required review; CI assertion optional (path/migration names) |
| Staging UI still pointing at LEGACY    | Vercel Staging envs only mt-dev URL/keys; checklist                                        |
| Data loss on cutover                   | Backup first; PREPROD dress rehearsal; no unattended prod restore                          |
| Auth lockout on new project cutover    | Prefer strategy B **or** rehearsed user migration; support runbook                         |

## Approaches considered

| Approach                                       | Verdict                                          |
| ---------------------------------------------- | ------------------------------------------------ |
| Single main CD to one Supabase forever         | Unsafe given multi-tenant delta vs live users    |
| Auto everything including LEGACY               | Rejected                                         |
| Feature branch only, no develop                | Poor long-term integration; we use **`develop`** |
| **Dual-track + gated promote + cutover phase** | **Chosen**                                       |

## Approval / next

- Supersedes earlier “auto CD on `main` → dev” simplification with **auto CD on `develop` → mt-dev** and **main = legacy protect**.
- **Next:** finish Phase F in [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md); move this folder to `done/` when Phase B + legacy cutover are closed.
