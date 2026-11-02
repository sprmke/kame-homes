---
title: Legacy integration inventory (names only)
status: active
updated: 2026-11-01
tags: [operations, migration, legacy]
---

# Legacy integration inventory (Phase 0.5)

Names and surfaces only. Values live in gitignored `supabase/.env.legacy-prod.local`, `ui/.env.legacy-prod.local`, and `backups/legacy-prod-config/`. Plan: [`kamespace-01-legacy-prod-config-secrets-backup.md`](../../workflow/in-progress/kamespace-01-legacy-prod-config-secrets-backup.md).

## Supabase legacy project

| Item                  | Ref / location                                                      |
| --------------------- | ------------------------------------------------------------------- |
| Project               | `zfttdwtceyqszyeyhilc` (dashboard: guest-form-app)                  |
| Edge secrets template | `supabase/.env.legacy-prod.example` (32 keys)                       |
| Config row backup     | `backups/legacy-prod-config/<date>/` via `capture-legacy-config.ts` |

## Vercel legacy

| Item                 | Location                                         |
| -------------------- | ------------------------------------------------ |
| Project              | `guest-form-management-app` (`sprmkes-projects`) |
| Production env names | `ui/.env.legacy-prod.example` (6 `VITE_*` keys)  |
| Domains              | `kamehomes.space`, `www.kamehomes.space`         |

## Third parties (legacy-era)

| Integration               | Env / DB                                 | On mt-prod (`fwor`)                                    |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Resend send               | `RESEND_API_KEY`                         | Replace with prod account key at Phase 6               |
| Telegram bots             | Legacy: env + `telegram_*_settings` rows | **DB per property**; legacy env kept for rollback only |
| Google Calendar / Sheets  | `GOOGLE_*`                               | **Retired** on mt-prod                                 |
| Gmail listener            | `GMAIL_*`, `gmail_mail_integration`      | **Retired**; Resend inbound on mt-prod                 |
| Gemini / Groq             | `GEMINI_*`, `GROQ_API_KEY`               | Reuse or rotate at Phase 6                             |
| GCash display             | `GCASH_*` / `app_settings`               | From migrated data                                     |
| Google Auth (guest/admin) | Supabase Auth provider + OAuth clients   | New prod OAuth client (Phase 1.4 / 6.2)                |
| Namecheap DNS             | `kamehomes.space` zone                   | Apex redirects per plan 02 §6.1                        |
| GitHub env secrets        | `PROD_*` (write-only)                    | mt-prod matrix in prod-env-matrix                      |

## Cron (legacy)

Captured as JSON: `backups/legacy-prod-config/<date>/cron-jobs.json`. Legacy Telegram/SD crons must be unscheduled at T0 (`sql/05-legacy-freeze.sql`) before mt-prod crons receive secrets.

## Sign-off

- [x] Names recorded (this file + Plan 01 templates).
- [ ] Hosted digest match (`verify-secret-hashes.ts` with `secrets-digests.json` from CLI).
- [ ] Plan 01 B-18 operator sign-off.
