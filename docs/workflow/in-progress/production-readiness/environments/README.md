---
title: 'Test environments, accounts, fixtures'
status: active
updated: 2026-10-19
stage: in-progress
kind: reference
readiness: unverified
launch_gate: F
---

# Test environments

Phase 4 of the launch audit. Destructive tests: **local Docker first**. Hosted writes need the `kamewave` unlock (see below).

| Env                 | UI                            | API / DB               | Safe for                                                               |
| ------------------- | ----------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Local               | `./dev.sh`                    | `127.0.0.1:54321`      | Full reset, adversarial, seeds, load tests (no unlock needed)          |
| **Production (mt)** | `https://kamespace.com`       | `fworvijbrwpyngycotbz` | Read-only probes by default; writes/seeds/deploys only with `kamewave` |
| Staging UI          | `https://dev.kamehomes.space` | `fwor…` (**same DB**)  | UI review only — not a separate backend                                |
| Legacy production   | `guest-form-management-app`   | `zftt…`                | Read-only only; no new work                                            |

**2026-11-02 correction:** `fwor…` became MULTI_TENANT_PROD on 2026-10-27
(`docs/architecture/deployment.md`). There is **no separate staging backend**, so
`dev.kamehomes.space` shares production data and the `CD Dev` workflow deploys to
production. Treat every hosted write as a production write.

## GitHub Environment `development` (2026-10-19)

Present: `DEV_SUPABASE_SERVICE_ROLE_KEY`, `LEGACY_PROD_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

**Missing (PR-025):** `DEV_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`, var `SMOKE_PROPERTY_SLUG`. CD Dev smoke/pg_stat skip or fail without these.

## Hosted-dev Edge secrets (names only)

61 secrets. Cron secrets present for the named jobs. `TURNSTILE_SECRET_KEY`, `CAPTCHA_MODE`, `GUEST_BOOKING_ACCESS_ENFORCE`, `POSTHOG_API_KEY`, `PAYMONGO_*`, `RESEND_*` are set.

Not in Edge (often local-only): `SENTRY_DSN` (intentional no-op), `GEMINI_API_KEY` singular (rotation uses `GEMINI_API_KEYS`).

## Accounts needed for Phase 7

| Persona                                       | Account                                                                                      | Status      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------- |
| Org owner (Free)                              | `sprmke.dev+qa-owner@gmail.com`, org `readiness-qa-stays`, listing `qa-monaco-1801` (ACTIVE) | ✅ seeded   |
| Outsider (other org)                          | `sprmke.dev+qa-outsider@gmail.com`, org `readiness-qa-outsider`                              | ✅ seeded   |
| Guest authed                                  | `sprmke.dev+qa-guest@gmail.com`                                                              | ✅ seeded   |
| Super admin                                   | email on `SUPER_ADMIN_EMAILS` (step-up OTP to inbox)                                         | ⛔ operator |
| Org owner (paid)                              | needs PayMongo sandbox checkout                                                              | ⛔ PR-033   |
| Property Full Access / Operations / Read Only | invites send email                                                                           | 🟡 next     |
| Parking member                                | needs a parking listing                                                                      | 🟡 next     |

Seed: `node scripts/dev/seed-readiness-qa-dev.mjs` (hosted dev only, idempotent, real edge functions). Logins land in `supabase/.env.qa.dev.local` (gitignored). Sessions are minted with admin magic link + token-hash verify because hosted Auth captcha blocks scripted password sign-in.

Probes and walks that use the seed:

- `node scripts/dev/probe-readiness-idor-dev.mjs` — cross-tenant reads/writes
- `node scripts/dev/qa-walk-hosted-dev.mjs` — every host, guest and public route at 375 / 768 / 1280

## Seeds

Local-only SQL seeds still apply to the Docker stack (`seed-search-fixtures.sql`, `seed-monaco-2612-demo-data.sql`, `seed-dashboard-demo-data.sql`, `seed-analytics-demo-data.sql`, `seed-ai-qa.ts`). Gaps: paid-tier org, role members, large-tenant 10k bookings (PR-052). RLS local probe: `probe-rls-anon-local.sh` after `db:reset`.

## Rollback rehearsal

`bun run rehearsal:rollback:dev:preflight` needs `DEV_DB_URL`. Measured drill is PR-024.
