---
title: 'CI/CD & environments (in progress)'
status: active
tags: [workflow, in-progress, deployment, ci-cd, supabase, vercel]
updated: 2026-08-09
stage: in-progress
kind: reference
---

# CI/CD & environments

Dual-track deployment: legacy live stack vs multi-tenant **`kame-homes`**. **Phase A (dev) active** — **`develop`** + **`dev.kamehomes.space`** + **fwor…**. **Phase B (prod) pending** — mt-prod Supabase, **`main`**, **`app.kamehomes.space`**, legacy data migration.

**Operator matrix:** [`ci-cd-environment-matrix.md`](../../../archive/operations/ci-cd-environment-matrix.md) · **Setup:** [`multi-tenant-dev-prod-setup.md`](../../../archive/operations/multi-tenant-dev-prod-setup.md)

---

## Docs in this folder

| Doc                                                                                | Role                                                      | Status                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| [`multi-tenant-dev-prod-environments.md`](./multi-tenant-dev-prod-environments.md) | **Start here** — phased plan, todos, CI/CD summary        | 🚧 Phase A in progress; Phase B deferred |
| [`ci-cd-dev-prod-design.md`](./ci-cd-dev-prod-design.md)                           | Design spec — dual-track model, env matrix, Vercel/GitHub | 🚧 Active (implementation ongoing)       |
| [`ci-cd-dev-prod.md`](./ci-cd-dev-prod.md)                                         | Implementation plan — Phases A–C shipped; D–F open        | 🚧 In progress                           |
| [`dev-staging-environment.md`](./dev-staging-environment.md)                       | Workflow tracker for dev/staging bootstrap                | 🚧 Operator checklist pending            |

## Shipped slices (stay in this folder until plan closed)

- Repo: `cd-dev.yml`, `ci-deploy*.sh`, `ci.yml`, prod CD scaffolds
- Docs: environment matrix, setup guide, GitHub env guide, legacy→mt-prod migration stub
- Guardrails: `supabase-deploy-guardrails-and-rollback` → [`../../done/supabase-deploy-guardrails-and-rollback.md`](../../done/supabase-deploy-guardrails-and-rollback.md)

## Archive runbooks (operations)

| Doc                                                                                            | Purpose                          |
| ---------------------------------------------------------------------------------------------- | -------------------------------- |
| [`dev-staging-environment.md`](../../../archive/operations/dev-staging-environment.md)         | Full dev/staging runbook         |
| [`production-deployment.md`](../../../archive/operations/production-deployment.md)             | Prod cutover checklist           |
| [`legacy-to-mt-prod-migration.md`](../../../archive/operations/legacy-to-mt-prod-migration.md) | Phase B data + storage migration |
| [`deployment.md`](../../../architecture/deployment.md)                                         | Ref inventory                    |

Back to [`../README.md`](../README.md).
