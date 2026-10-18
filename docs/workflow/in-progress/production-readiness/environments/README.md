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

Phase 4 of the launch audit. Destructive tests: local Docker first, then hosted **dev**. Never prod.

| Env         | UI                            | API / DB                          | Safe for                                              |
| ----------- | ----------------------------- | --------------------------------- | ----------------------------------------------------- |
| Local       | `./dev.sh`                    | Docker Supabase `127.0.0.1:54321` | Full reset, adversarial, load seed                    |
| Hosted dev  | `https://dev.kamehomes.space` | `fworvijbrwpyngycotbz`            | Smoke, live auth, PayMongo **sandbox**, restore drill |
| Legacy prod | `guest-form-management-app`   | `zftt…`                           | **Read-only** without `kamewave`                      |
| mt-prod     | not created                   | —                                 | Cutover only                                          |

## GitHub Environment `development` (2026-10-19)

Present: `DEV_SUPABASE_SERVICE_ROLE_KEY`, `LEGACY_PROD_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

**Missing (PR-025):** `DEV_DB_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`, var `SMOKE_PROPERTY_SLUG`. CD Dev smoke/pg_stat skip or fail without these.

## Hosted-dev Edge secrets (names only)

61 secrets. Cron secrets present for the named jobs. `TURNSTILE_SECRET_KEY`, `CAPTCHA_MODE`, `GUEST_BOOKING_ACCESS_ENFORCE`, `POSTHOG_API_KEY`, `PAYMONGO_*`, `RESEND_*` are set.

Not in Edge (often local-only): `SENTRY_DSN` (intentional no-op), `GEMINI_API_KEY` singular (rotation uses `GEMINI_API_KEYS`).

## Accounts needed for Phase 7

| Persona                                       | Where      | Notes                         |
| --------------------------------------------- | ---------- | ----------------------------- |
| Super admin                                   | hosted-dev | email on `SUPER_ADMIN_EMAILS` |
| Org owner (paid)                              | hosted-dev | existing test org             |
| Org owner (Free)                              | hosted-dev | plan-gate paths               |
| Property Full Access / Operations / Read Only | hosted-dev | invitees                      |
| Parking member                                | hosted-dev |                               |
| Guest authed                                  | hosted-dev | portal                        |
| Outsider (other org)                          | hosted-dev | IDOR                          |

Do not commit passwords. Store locally in `supabase/.env.dev.local` (gitignored).

## Seeds

Reuse existing scripts (`seed-search-fixtures.sql`, `seed-monaco-2612-demo-data.sql`, `seed-dashboard-demo-data.sql`, `seed-analytics-demo-data.sql`, `seed-ai-qa.ts`). Gaps: one org per plan tier with every role (4.2); large-tenant 10k bookings (PR-052); hosted-dev `/properties` empty until listing functions finish (PR-109). RLS local probe: `probe-rls-anon-local.sh` after `db:reset`.

## Rollback rehearsal

`bun run rehearsal:rollback:dev:preflight` needs `DEV_DB_URL`. Measured drill is PR-024.
