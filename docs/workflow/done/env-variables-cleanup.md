---
title: 'Env variables cleanup (UI + Supabase)'
status: done
tags: [workflow, done, devops]
updated: 2026-08-27
---

# Env variables cleanup (UI + Supabase)

Shipped 2026-08-27.

## Summary

- Audited code + scripts for env usage; removed vars no longer read at runtime.
- Rewrote **`ui/.env.example`**, **`ui/.env.development.*.example`**, **`supabase/.env.example`**, **`.env.dev.example`**, **`.env.prod.example`** — short headers, grouped sections, optional vars commented.
- Reorganized gitignored env files (`ui/.env.development`, `.env.development.dev`, `.env.production`, `supabase/.env.local`, `.env.dev.local`, `.env.production`).
- Backups: **`.env-backups/2026-08-27/`** (gitignored).
- Re-format helper: **`bun scripts/dev/reorganize-env-files.mjs`**.

## Removed from env (migrated or retired)

| Removed                                                    | Now lives in                                       |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `EMAIL_TO`, `EMAIL_REPLY_TO`, `PARKING_OWNER_EMAILS`       | `app_settings` / org PMO email resolution          |
| `GCASH_*`, `SD_REFUND_CRON_*`, `EMAIL_LOGO_URL`            | Property/org settings                              |
| Global `TELEGRAM_BOT_TOKEN`, `TELEGRAM_*_CHAT_ID`          | Per-property/parking Telegram settings (encrypted) |
| Google Calendar/Sheets/Gmail OAuth (except encryption key) | Removed with Resend inbound approvals              |
| `VITE_SUPABASE_DB_PASSWORD`                                | Unused                                             |

## Docs

- Inventory: [`../../architecture/validation-and-env.md`](../../architecture/validation-and-env.md)
- Dev setup: [`../../archive/operations/dev-staging-environment.md`](../../archive/operations/dev-staging-environment.md)

## Follow-up (manual)

Audit hosted **Supabase Dashboard → Edge Functions → Secrets** and **Vercel `VITE_*`** — delete the same retired keys if copied there earlier.
