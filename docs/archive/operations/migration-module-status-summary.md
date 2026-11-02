---
title: Migration module — status summary (operator)
status: active
updated: 2026-11-01
---

# Legacy → MT cutover — where we are

**Production backend:** `fworvijbrwpyngycotbz` (data loaded 2026-10-27).  
**Live guest traffic:** still **legacy** `zftt…` + `guest-form-management-app` + apex `kamehomes.space` until **T0**.

## Phase checklist

| Phase                             | Status           | Notes                                                                                                                                                                     |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Inventory                   | **Done**         | Counts, link inventory, schema drift doc                                                                                                                                  |
| **1** Prod wiring                 | **Mostly done**  | GitHub secrets, Vercel → fwor, Auth redirects, **extensions + 26 cron jobs (outbound parked)**; **T0:** Site URL → `kamespace.com`, prod Google OAuth client              |
| **2** Tooling                     | **Done**         | `migrate.sh`, verify scripts, guards, Storage sync, cron + cleanup SQL                                                                                                     |
| **3** Shaping                     | **Done** on fwor | Kame Homes org, Monaco property, owner, comped plan                                                                                                                       |
| **4** Rehearsals                  | **Mostly done**  | R1/R2/R3 automated + host walkthrough; rollback sign-off optional                                                                                                         |
| **5** App prep                    | **Done** (code)  | Redirects, resolver, watermarks, maintenance page                                                                                                                         |
| **6** Integrations                | **Partial**      | Edge secrets synced; CD Prod green ([41269033886](https://github.com/sprmke/kame-homes/actions/runs/41269033886)); Resend inbound MX, prod Google OAuth, Meta/VAPID at T0 |
| **7** Repo                        | **Open**         | `main → develop` merged 2026-11-02; T0: tag `legacy-final`, `develop → main`, legacy Vercel disconnect                                                                     |
| **8** T0 cutover                  | **Open**         | Freeze legacy, reload from freeze dump (D8), compareCounts, DNS, apex move, activate crons                                                                                |
| **9–10** Hypercare / decommission | **After T0**     | 30d monitoring, then retire zftt + legacy Vercel                                                                                                                          |

## Verify anytime

```bash
bun scripts/migrate/legacy-to-mt-prod/hosted-prod-verify.ts
bun scripts/migrate/legacy-to-mt-prod/hosted-r3-smoke.ts
bun scripts/migrate/legacy-to-mt-prod/verify-phase1-wiring.ts
bun scripts/migrate/legacy-to-mt-prod/verify-fwor-secrets-from-local.mjs
```

## Needs you (cannot fully automate)

1. **Namecheap / DNS:** add the 12 records in [`phase1-prod-wiring-checklist.md`](./phase1-prod-wiring-checklist.md#dns-records-to-add-namecheap-zone-kamespacecom) (apex A, `www`, Resend send + inbound). Vercel domains and Resend domains are already created; they verify as soon as DNS lands. At T0 move apex `kamehomes.space` to `kame-homes`.
2. **Google Cloud:** Prod OAuth client (origins `kamespace.com`, `dev.kamespace.com`; callback `https://fworvijbrwpyngycotbz.supabase.co/auth/v1/callback`). No CLI access to the project from this machine.
3. **Resend:** Nothing to create — `kamespace.com` (sending) and `inbound.kamespace.com` (receiving) exist; they need the DNS records above.
4. **PayMongo dashboard:** the account is in **test mode** and both existing webhooks are `disabled` (`max_retries_exceeded`), including `https://fworvijbrwpyngycotbz.supabase.co/functions/v1/paymongo-webhook`. Guest bookings are unaffected (legacy uses manual GCash), but plan/parking checkout cannot confirm until live keys and a fresh webhook exist.
5. **T0 window:** Pick freeze night; notify host; run [`t0-go-live-checklist.md`](./t0-go-live-checklist.md) with **kamewave**.
6. **Git:** Large dirty **`develop`** tree remains in the main checkout (unrelated PWA work). Migration docs + tooling are committed; do not `git add -A`.
7. **Security:** Rotate any PAT pasted in chat; keep `sbp_` only in `.env.management.local` + GitHub.

Canonical detail: [`legacy-cutover-phase-status.md`](./legacy-cutover-phase-status.md), Plan 02 in `docs/workflow/in-progress/kamespace-02-legacy-prod-to-mt-prod-cutover.md`.
