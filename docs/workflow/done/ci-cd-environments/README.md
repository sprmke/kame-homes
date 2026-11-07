---
title: 'CI/CD & environments (closed)'
status: done
tags: [workflow, done, deployment, ci-cd, supabase, vercel]
updated: 2026-11-07
stage: done
kind: reference
---

# CI/CD & environments

**Closed 2026-11-07.** The dual-track target described in this folder (separate mt-dev and
mt-prod Supabase projects, `dev.kamehomes.space`, `app.kamehomes.space`, and a Phase B prod
cutover) was never completed as written. It was superseded by the **one-project cutover** on
2026-11-02: a single Supabase project (`fwor…`, "Kame Space") serves both `develop` and
`kamespace.com`, the legacy `zftt…` project is retired, and `.github/workflows/cd-prod.yml`
is the only backend pipeline. The repo/CI work in Phases A–C shipped and is still in use;
keep this folder for the decision history only.

Current deployment truth: [`../../../architecture/deployment.md`](../../../architecture/deployment.md).

**Operator matrix:** [`ci-cd-environment-matrix.md`](../../../archive/operations/ci-cd-environment-matrix.md) · **Setup:** [`multi-tenant-dev-prod-setup.md`](../../../archive/operations/multi-tenant-dev-prod-setup.md)

---

## Docs in this folder

| Doc                                                                                | Role                                                      | Status                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md) | Phased plan, todos, CI/CD summary                         | Closed (superseded 2026-11-02)           |
| [`ci-cd-dev-prod-design.md`](./ci-cd-dev-prod-design.md)                           | Design spec — dual-track model, env matrix, Vercel/GitHub | Historical; Phases A–C shipped           |
| [`ci-cd-dev-prod.md`](./ci-cd-dev-prod.md)                                         | Implementation plan — Phases A–C shipped; D–F obsolete    | Historical                               |
| [`dev-staging-environment.md`](./dev-staging-environment.md)                       | Workflow tracker for dev/staging bootstrap                | Closed; no hosted dev environment exists |

## Shipped slices

- Repo: `cd-prod.yml` (single backend pipeline), `ci.yml`, `ci-deploy*.sh`
- Docs: environment matrix, setup guide, GitHub env guide, legacy→mt-prod migration record
- Guardrails: `supabase-deploy-guardrails-and-rollback` → [`../supabase-deploy-guardrails-and-rollback.md`](../supabase-deploy-guardrails-and-rollback.md)

## Archive runbooks (operations)

| Doc                                                                                            | Purpose                            |
| ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| [`dev-staging-environment.md`](../../../archive/operations/dev-staging-environment.md)         | Full dev/staging runbook           |
| [`production-deployment.md`](../../../archive/operations/production-deployment.md)             | Prod cutover checklist             |
| [`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md) | Completed Phase B migration record |
| [`deployment.md`](../../../architecture/deployment.md)                                         | Ref inventory                      |

Back to [`../README.md`](../README.md).
