---
title: Migration module — status summary (operator)
status: active
updated: 2026-11-01
---

# Legacy → MT cutover — where we are

**Production backend:** `fworvijbrwpyngycotbz` (data loaded 2026-10-27).  
**Live guest traffic:** still **legacy** `zftt…` + `guest-form-management-app` + apex `kamehomes.space` until **T0**.

## Phase checklist

| Phase                             | Status           | Notes                                                                                                                                                                                            |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0** Inventory                   | **Done**         | Counts, link inventory, schema drift doc                                                                                                                                                         |
| **1** Prod wiring                 | **Done**         | GitHub secrets, Vercel → fwor, Auth on `kamespace.com`, extensions + 26 crons, Production branch `main` (prod OAuth client deferred to plan 05)                                                       |
| **2** Tooling                     | **Done**         | `migrate.sh`, verify scripts, guards, Storage sync, cron + cleanup SQL                                                                                                                           |
| **3** Shaping                     | **Done** on fwor | Kame Homes org, Monaco property, owner, comped plan                                                                                                                                              |
| **4** Rehearsals                  | **Done**         | R1/R2/R3 automated + host walkthrough; rollback dry-run documented                                                                                                                              |
| **5** App prep                    | **Done** (code)  | Redirects, resolver, watermarks, maintenance page                                                                                                                                                |
| **6** Integrations                | **Done**         | Resend sending + inbound verified; Telegram admin/staff/finance/maintenance migrated; PostHog/Gemini/VAPID set. **PayMongo deferred** pending approval                                     |
| **7** Repo                        | **Done**         | `legacy-final` tagged; `develop` → `main` fast-forwarded 2026-11-03; legacy Vercel Git disconnected                                                                                            |
| **8** T0 cutover                  | **Done**         | Measured delta synced, apex moved, crons flipped, Auth/Resend switched, production verified                                                                                                     |
| **9–10** Hypercare / decommission | **After T0**     | 30d monitoring, then retire zftt + legacy Vercel                                                                                                                                                 |

## Verify anytime

```bash
bun scripts/migrate/legacy-to-mt-prod/hosted-prod-verify.ts
bun scripts/migrate/legacy-to-mt-prod/hosted-r3-smoke.ts
bun scripts/migrate/legacy-to-mt-prod/verify-phase1-wiring.ts
bun scripts/migrate/legacy-to-mt-prod/verify-fwor-secrets-from-local.mjs
```

## Needs you (cannot fully automate)

1. **Legacy Vercel project:** Git is disconnected and domains are 308s. Keep the project for 30 days, then delete it (`sprmkes-projects`).
2. **Google Cloud:** Prod OAuth client (origins `kamespace.com`, `dev.kamespace.com`; callback `https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback`). No CLI access to the project from this machine.
3. **Resend:** Done — both domains verified, sender + inbound switched, webhook recreated with bounce/complaint events.
4. **PayMongo dashboard:** the account is in **test mode** and both existing webhooks are `disabled` (`max_retries_exceeded`), including `https://fworvijbrwpyngycotbz.supabase.co/functions/v1/paymongo-webhook`. Guest bookings are unaffected (legacy uses manual GCash), but plan/parking checkout cannot confirm until live keys and a fresh webhook exist.
5. **T0 window:** Pick freeze night; notify host; run [`t0-go-live-checklist.md`](./t0-go-live-checklist.md) with **kamewave**.
6. **Git:** Large dirty **`develop`** tree remains in the main checkout (unrelated PWA work). Migration docs + tooling are committed; do not `git add -A`.
7. **Security:** Rotate any PAT pasted in chat; keep `sbp_` only in `.env.management.local` + GitHub.

Canonical detail: [`legacy-cutover-phase-status.md`](./legacy-cutover-phase-status.md), Plan 02 in `docs/workflow/done/kamespace-02-legacy-prod-to-mt-prod-cutover.md`.
