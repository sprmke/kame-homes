---
title: 'Cutover dry run (dev only)'
status: active
updated: 2026-10-19
launch_gate: G
readiness: unverified
---

# Cutover dry run (no prod writes)

Walk of `production-deployment.md`, `migration-runbook.md` § production, `legacy-to-mt-prod-migration.md`, and `ci-cd-environments/` Phase B. **No `kamewave`.**

| Step in the runbooks                          | Would it work today?                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup prod (`PROD_DB_URL`)                   | **Unknown.** Operator must confirm `PROD_DB_URL` exists locally, not in GitHub `development`.                                                 |
| `supabase db push` to **mt-prod**             | **Would fail.** mt-prod project is not created.                                                                                               |
| `cd-prod.yml`                                 | **Gated.** `CUTOVER_ENABLED` unset. Confirm stays gated.                                                                                      |
| Link CLI to LEGACY `zftt…` and push mt schema | **Unsafe / forbidden** until cutover. Dual-track: `main` + LEGACY is live.                                                                    |
| Restore drill analogue on **dev**             | Preflight script exists (`rehearsal:rollback:dev:preflight`) but needs `DEV_DB_URL` (**missing** on GitHub env). Measured RTO never captured. |
| Auth redirect URLs for `app.kamehomes.space`  | Not configured (domain not the live UI yet).                                                                                                  |
| Help Center sync on prod                      | Separate workflow; `DEV_SUPABASE_SERVICE_ROLE_KEY` was empty until 2026-10-19 (dev only).                                                     |
| Function `static_files` for email templates   | Already in `config.toml` for sending functions — re-check at cutover.                                                                         |
| `ENVIRONMENT=production` cron fail-closed     | Needs every `*_CRON_SECRET` in Vault **and** Edge on the prod project. P0-6 still open even on **dev**.                                       |

**Unclear in the docs:** which Vercel project Production env flips from Preview `dev.kamehomes.space` to `app.kamehomes.space`, and the exact order vs creating the new Supabase project. `ci-cd-environments/README.md` is the source; `production-deployment.md` still reads like a single-project cutover in places.

**Would fail if run now:** any command targeting mt-prod; any restore rehearsal without `DEV_DB_URL`; any claim that hosted-dev equals `develop` HEAD until function deploy + merge of #145/#146 finish.
