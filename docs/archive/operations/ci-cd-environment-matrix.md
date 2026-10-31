---
title: 'CI/CD environment matrix (canonical)'
status: active
tags: [operations, deployment, ci-cd, vercel, supabase, github]
updated: 2026-08-09
---

# CI/CD environment matrix

**Phased plan:** [`ci-cd-environments/README.md`](../../workflow/in-progress/ci-cd-environments/README.md)

---

## NOW — dev only (active)

| Stack           | Git           | Vercel (`kame-homes`)                  | URL                       | Supabase                                    |
| --------------- | ------------- | -------------------------------------- | ------------------------- | ------------------------------------------- |
| **New app dev** | **`develop`** | **Preview** + Preview `VITE_*`         | **`dev.kamehomes.space`** | **MULTI_TENANT_DEV** `fworvijbrwpyngycotbz` |
| **Legacy live** | **`main`**    | `guest-form-management-app` Production | **`kamehomes.space`**     | **LEGACY** `zfttdwtceyqszyeyhilc`           |

```text
push develop  →  kame-homes Preview  →  dev.kamehomes.space  →  fwor…
                 cd-dev.yml (GitHub development secrets)

push main     →  guest-form-management-app only  →  kamehomes.space  →  zftt…
                 (kame-homes does NOT deploy from main until Phase B)
```

| Item                        | Status                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| **`app.kamehomes.space`**   | DNS may exist; **prod backend deferred** — do not wire mt-prod `VITE_*` yet |
| **`production` git branch** | **Not used** — prod release uses **`main`**                                 |
| **`cd-prod.yml`**           | **Inactive** until mt-prod project + release                                |
| **Second Supabase project** | **Deferred** (~$10/m when created)                                          |

---

## AT RELEASE — prod (pending)

| Stack            | Git              | Vercel (`kame-homes`)                | URL                       | Supabase                                             |
| ---------------- | ---------------- | ------------------------------------ | ------------------------- | ---------------------------------------------------- |
| **New app prod** | **`main`**       | **Production** + Production `VITE_*` | **`app.kamehomes.space`** | **MULTI_TENANT_PROD** _(create)_                     |
| **Legacy**       | `main` → cutover | Retire or redirect apex later        | `kamehomes.space`         | migrate data **`zftt…` → mt-prod** then decommission |

```text
1. Create mt-prod Supabase
2. Run legacy → mt-prod migration (data + storage) — see legacy-to-mt-prod-migration.md
3. Merge develop → main
4. kame-homes Production Branch = main
5. app.kamehomes.space → mt-prod
6. Enable cd-prod.yml + GitHub production secrets
```

---

## Naming cheat sheet

| Term                     | Meaning                                                      |
| ------------------------ | ------------------------------------------------------------ |
| Git **`develop`**        | Daily multi-tenant work                                      |
| Vercel **Preview**       | Hosted dev builds (`dev.kamehomes.space`)                    |
| GitHub **`development`** | Secrets for **`cd-dev.yml`** (not a git branch)              |
| Git **`main`**           | **Prod release line** for new app (after merge from develop) |
| Vercel **Development**   | Local `vercel dev` only — ignore for hosted                  |

---

## Secrets — where they live (now)

| Purpose         | Variables                                                                  | Where                                             |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| Dev UI          | `VITE_*` → fwor                                                            | Vercel **Preview**                                |
| Dev Supabase CD | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `LEGACY_PROD_PROJECT_REF` | GitHub **`development`**                          |
| Legacy UI       | `VITE_*` → zftt                                                            | Vercel **`guest-form-management-app`** Production |
| Local dev       | `.env.dev.local`, `.env.development.dev`                                   | Gitignored                                        |

**Prod UI / prod CD secrets** — add in Phase B only.

---

## GitHub Actions (current)

| Workflow                                                      | Active     | Trigger                             | Target                                                     |
| ------------------------------------------------------------- | ---------- | ----------------------------------- | ---------------------------------------------------------- |
| [`ci.yml`](../../../.github/workflows/ci.yml)                 | ✅         | PR + push **`main`**, **`develop`** | Quality                                                    |
| [`cd-dev.yml`](../../../.github/workflows/cd-dev.yml)         | ✅         | push **`develop`**                  | Deploy **fwor…** (`db push --include-all` + all functions) |
| [`cd-prod.yml`](../../../.github/workflows/cd-prod.yml)       | ❌ pending | manual + `CUTOVER_ENABLED`          | **mt-prod** (Phase B)                                      |
| [`cd-preprod.yml`](../../../.github/workflows/cd-preprod.yml) | ❌         | manual                              | optional                                                   |

---

## Google / Auth (by phase)

| Phase                      | Supabase project | Site URL                      | OAuth client                                                                     |
| -------------------------- | ---------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| **Now**                    | **fwor**         | `https://dev.kamehomes.space` | **Dev** client → origins: localhost + dev subdomain                              |
| **Release**                | **mt-prod**      | `https://app.kamehomes.space` | **Prod** client (new — do not reuse dev or legacy live client until intentional) |
| **Legacy (unchanged now)** | **zftt**         | `https://kamehomes.space`     | Existing live client                                                             |

Redirect URI pattern: `https://<project-ref>.supabase.co/auth/v1/callback`

---

## Related

- Setup (Phase A): [`multi-tenant-dev-prod-setup.md`](./multi-tenant-dev-prod-setup.md)
- Migration (Phase B): [`legacy-to-mt-prod-migration.md`](./legacy-to-mt-prod-migration.md)
- GitHub secrets: [`github-environments-setup.md`](./github-environments-setup.md)
- Ref inventory: [`deployment.md`](../../architecture/deployment.md)
