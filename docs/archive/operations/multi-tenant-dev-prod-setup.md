---
title: 'Multi-tenant setup — dev now · prod at release'
status: active
tags: [operations, deployment, multi-tenancy, supabase, vercel]
updated: 2026-08-09
---

# Multi-tenant setup — dev now · prod at release

**Plan:** [`multi-tenant-dev-prod-environments.md`](../../workflow/in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md) · **Matrix:** [`ci-cd-environment-matrix.md`](./ci-cd-environment-matrix.md)

**Scope:** New app [`kame-homes`](https://vercel.com/kame-works/kame-homes). Legacy [`guest-form-management-app`](https://vercel.com/sprmkes-projects/guest-form-management-app) + **`zftt…`** unchanged.

---

## NOW vs LATER

|                  | **Now (Phase A)**         | **At release (Phase B)**                                      |
| ---------------- | ------------------------- | ------------------------------------------------------------- |
| **Git**          | **`develop`**             | Merge **`develop` → `main`**                                  |
| **URL**          | **`dev.kamehomes.space`** | **`app.kamehomes.space`**                                     |
| **Supabase**     | **`fwor…`** only          | **New mt-prod** + legacy data migration                       |
| **Vercel**       | Preview `VITE_*` → fwor   | Production `VITE_*` → mt-prod; Production branch = **`main`** |
| **Google OAuth** | Dev client → fwor         | Prod client → mt-prod                                         |
| **Cost**         | One Supabase project      | +~$10/m for mt-prod                                           |

**Do not** create a **`production`** git branch. **Do not** create mt-prod Supabase until Phase B.

---

# Phase A — Dev setup (do now)

## A1 — Vercel Preview

**Settings → Environment Variables** — **Preview only:**

| Variable                 | Value                                                   |
| ------------------------ | ------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://fworvijbrwpyngycotbz.supabase.co/functions/v1` |
| `VITE_API_URL`           | same                                                    |
| `VITE_SUPABASE_ANON_KEY` | fwor anon key                                           |
| `VITE_NODE_ENV`          | `development`                                           |

**Domains:** `dev.kamehomes.space` → Preview → branch **`develop`**.

Redeploy **`develop`**.

## A2 — Supabase Auth (fwor)

- **Site URL:** `https://dev.kamehomes.space` (one URL only)
- **Redirect URLs:** add separately — `http://localhost:5173`, `http://127.0.0.1:5173`, `https://dev.kamehomes.space`, `https://*.vercel.app/**`

## A3 — Google OAuth (dev)

|                |                                                             |
| -------------- | ----------------------------------------------------------- |
| **Origins**    | `http://localhost:5173`, `https://dev.kamehomes.space`      |
| **Redirect**   | `https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback` |
| **Paste into** | fwor → Auth → Google                                        |

## A4 — GitHub CD

Environment **`development`** (not git branch `develop`):

| Secret                    | Value                  |
| ------------------------- | ---------------------- |
| `SUPABASE_ACCESS_TOKEN`   | PAT                    |
| `SUPABASE_PROJECT_REF`    | `fworvijbrwpyngycotbz` |
| `LEGACY_PROD_PROJECT_REF` | `zfttdwtceyqszyeyhilc` |

Push **`develop`** → **CD Dev** in Actions.

## A5 — Verify

- `dev.kamehomes.space` → Network → **`fwor…`**
- Legacy `kamehomes.space` → **`zftt…`**

---

# Phase B — Prod release (defer)

See [`legacy-to-mt-prod-migration.md`](./legacy-to-mt-prod-migration.md) and plan Phase B.

1. Create **MULTI_TENANT_PROD** Supabase (~$10/m)
2. Run **legacy → mt-prod** migration (Postgres + Storage)
3. **`develop` → `main`** PR
4. **`kame-homes`** Production Branch = **`main`**
5. Vercel **Production** `VITE_*` → mt-prod
6. Auth + **Google OAuth prod** on mt-prod
7. Enable **`cd-prod.yml`** + GitHub **`production`** secrets

**`app.kamehomes.space`:** wire to mt-prod only in Phase B (DNS can wait or exist early).

---

## DNS (Namecheap)

| Host      | Purpose                                 |
| --------- | --------------------------------------- |
| `@`       | Legacy apex — **do not change**         |
| `dev`     | CNAME → Vercel target for Preview       |
| `app`     | CNAME → Vercel (prod wiring in Phase B) |
| `_vercel` | TXT verify if Vercel requires           |

---

## Local files

| File                       | Target                                       |
| -------------------------- | -------------------------------------------- |
| `supabase/.env.dev.local`  | fwor deploy                                  |
| `ui/.env.development.dev`  | local UI → fwor                              |
| `supabase/.env.prod.local` | Phase B only (template: `.env.prod.example`) |

---

## Related

- [`deployment.md`](../../architecture/deployment.md)
- [`github-environments-setup.md`](./github-environments-setup.md)
- [`production-deployment.md`](./production-deployment.md)
