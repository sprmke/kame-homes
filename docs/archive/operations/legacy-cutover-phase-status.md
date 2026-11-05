---
title: Legacy cutover — phase completion status
status: active
updated: 2026-11-02
tags: [operations, migration]
---

# Legacy cutover — phase completion status

**Status: complete 2026-11-03.** `kamespace.com` is production; legacy `kamehomes.space` + `app` are 308s; both legacy projects are paused. Hypercare runs to 2026-12-03, then decommission.

**Deferred (tracked, not blockers):** Maps Embed API on the key, property photos, PayMongo live mode (pending approval), and the 30-day decommission (delete paused legacy projects + revoke old Google credentials).

Single progress view for Plan 02 ([done](../../workflow/done/kamespace-02-legacy-prod-to-mt-prod-cutover.md)) and prerequisite Plan 01 ([done](../../workflow/done/kamespace-01-legacy-prod-config-secrets-backup.md)). **Production Supabase = `fworvijbrwpyngycotbz`**.

Legend: **Done** | **Partial** | **Open** | **N/A (T0 / operator)**

## Summary (phases 0–5)

| Phase             | Status           | Gate to Phase 6                                                                                                                                    |
| ----------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Inventory   | **Done**         | B-18 signed off 2026-11-01; optional B-16/B-17/B-12 later                                                                                          |
| **1** Prod wiring | **Done**         | Extensions + 26 jobs, Auth on `kamespace.com`, Vercel Production branch `main`. A dedicated prod Google OAuth client is deferred to plan 05.       |
| **2** Tooling     | **Done**         | —                                                                                                                                                  |
| **3** Shaping     | **Done** on fwor | `kameworks.tech` first login; super-admin secret on fwor; D6 scripts shipped                                                                       |
| **4** Rehearsals  | **Partial**      | R3 automated + host walkthrough **2026-11-01** done; rollback dry-run sign-off optional — [`r3-rollback-rehearsal.md`](./r3-rollback-rehearsal.md) |
| **5** App prep    | **Done**         | Redirects, resolver, watermarks; calendar blocking verified; structural SQL green.                                                                 |

- **Vercel Production branch is now `main`** (2026-11-03). Next push/merge to `main` builds Production automatically; `develop` continues to build Preview and deploy the backend. No more manual `vercel --prod`.

**2026-11-03 operator completions:**

- PMO notified of the new sender/approval address.
- `dev.kamehomes.space` removed from Vercel, the Auth allow list, Turnstile and the Maps key; the host now returns 404.
- Legacy Vercel project Git integration disconnected (no more builds on `main`).
- **PayMongo stays open/pending** until the account is approved for live mode. Current state: test mode, both webhooks disabled. Guest bookings use manual GCash and are unaffected.

**2026-11-03 post-cutover fixes:**

- **Parking reminders hit historic guests.** `calendarDaysBetween` clamps negatives to 0, so three 2025 bookings looked like "today" and received a reminder at 06:00 on 2026-11-02 (two `.con` typos, one dead yahoo address). Eligibility moved to `parkingReminderEligibility.ts`, rejects check-ins before today, and is unit-tested; a manual sweep now returns `sent: 0`.
- **Telegram verification:** admin group received a real summary; staff/finance/maintenance use the same encrypted row path and run hourly.

- **Review lifecycle cron was failing hourly** (`getPlatformSettingsSnapshot is not defined`, plus a `skip` helper used before declaration). Fixed, redeployed, verified 200 on the scheduled :17 run. The review modules are now in `check:edge-types` so it cannot ship again.
- **Telegram was silently off** on prod: legacy used env credentials, the new app needs per-property encrypted rows. Rotated `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` (no encrypted data existed), migrated admin/staff/finance/maintenance bot tokens + chat ids, enabled those channels. `telegram-admin-cron` returned `sent: true`; the other channels run at :00.
- Property location set (`settings.city/province`, address) so the public page no longer shows "Philippines, Philippines".
- QA sign-in removed; prod has 2 auth users.
- Production backup taken (`backups/prod/20261102T181127Z_*`).

**2026-11-03 switch complete:** `kamespace.com` is the working app. Apex + `www` + `app` redirect 308 with path/query preserved. Legacy crons unscheduled (0 jobs); prod crons active (26/26). The property was renamed in-app to **Kame Home** / `kame-home` (450 bookings still linked); verify V6 no longer hardcodes `monaco-2604`.

**2026-11-03 cutover delta (targeted, not a reload):** legacy vs prod parity checked table by table. Only one booking had changed on legacy (`f9e646d0…` GAF approved 2026-11-01, `PENDING_DOCUMENTS → READY_FOR_CHECKIN`) plus five `processed_emails` rows. Both were synced directly; the approved PDF was already in Storage. Status mix and counts now match exactly (450 bookings; 426/14/8/1/1). `platform_settings.migration_cutover_at` reset to the switch time. `app.kamehomes.space` now 308s to `kamespace.com`. **DONE 2026-11-03:** `kamehomes.space`, `www` and `app` are 308s to `kamespace.com` with paths and queries preserved; legacy intake is closed; legacy cron count is **0**; the 26 prod jobs are **active**.

**2026-11-02 email + grants:** `kamespace.com` and `inbound.kamespace.com` are **verified** in Resend. A test message from `mail@kamespace.com` delivered; a signed inbound event and a real Resend webhook both wrote `processed_emails`; a bounce wrote `email_suppressions`. Root cause of the earlier silent inbound failure: a restore left 9 public tables with **RLS but no grants** for `service_role`. Fixed and captured in `sql/75-restore-public-grants.sql` (run after every reload).

**Phase 6:** edge secrets synced **2026-11-01**; CD Prod deploy green; Resend domains created (`kamespace.com`, `inbound.kamespace.com`). Open: DNS records, prod Google OAuth, PayMongo live mode. Operator summary: [`migration-module-status-summary.md`](./migration-module-status-summary.md).

**Phase 6+** T0 freeze pair: `CUTOVER_FREEZE_PAIR=1` + fresh legacy inventory.

**2026-11-02 cron proof:** the every-minute jobs (`marketing-generation-sweeper`, `voice-receptionist-reaper`) fire and the Edge handlers return `200` (`net._http_response`), so the `pg_cron → pg_net → function` loop is proven on prod.

**2026-11-02 prod cleanup:** QA fixtures and legacy guest sign-ins removed. Prod now holds 1 org (`kame-homes`), 1 property (`monaco-2604`), 2 auth users. Re-running the QA seed against `fwor` now requires `QA_SEED_CONFIRM=yes`.

## Plan 01 — legacy secrets backup

| Phase       | Status      | Notes                                                                                          |
| ----------- | ----------- | ---------------------------------------------------------------------------------------------- |
| B0 Prep     | **Done**    | gitignore, hooks, templates, env skip                                                          |
| B1 Capture  | **Partial** | 32+6 local keys; capture + liveness ok; legacy CLI secrets **403**; Vercel pull open           |
| B2 Seal     | **Partial** | Tar + SHA256; age + B-17 drill open                                                            |
| B3 Hand-off | **Done**    | Integration inventory complete; **B-18 signed and re-verified 2026-11-03** (archives + hashes) |

Scripts: `merge-legacy-prod-env.mjs`, `capture-legacy-config.ts`, `verify-secret-hashes.ts`, `legacy-env-liveness.ts`, `build-legacy-prod-archive.sh`.

## Plan 02 — cutover phases (detail)

| Phase    | Status          | Notes                                                                                                                |
| -------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **0**    | **Done**        | 0.2 closed on R1/R2 evidence — [`legacy-schema-drift-0.2.md`](./legacy-schema-drift-0.2.md); 0.5 values in local env |
| **1**    | **Partial**     | 1.7 guards done; extensions + crons done 2026-11-02; checklist above                                                 |
| **2**    | **Done**        | R1/R2 + Oct 27 load + verify/safety                                                                                  |
| **3**    | **Done**        | Org/property/owner/plan on fwor; 3.9 export/import scripts                                                           |
| **4**    | **Partial**     | R1/R2 done; `hosted-prod-verify.ts` + `hosted-r3-smoke.ts` **2026-11-01/02**                                         |
| **5**    | **Done** (code) | 5.1–5.6 shipped; 5.7 structural via `hosted-prod-verify.ts`                                                          |
| **6**    | **Partial**     | Edge secrets synced; CD Prod green; crons installed but parked. Resend inbound MX + prod OAuth at T0                 |
| **7–10** | **Open**        | `main → develop` merged 2026-11-02; tag + `develop → main` + T0 DNS/freeze + hypercare                               |

**T0 data path (D8, decided 2026-11-02):** reload from the freeze dump (`migrate.sh` local rebuild → `pushLocalRehearsalToHosted.sh` → shape → Storage delta → verify). Fallback to verify-only when the freeze dump shows zero drift. Full order: [`legacy-to-mt-prod-migration.md`](./legacy-to-mt-prod-migration.md).

## Automated verify (run anytime)

```bash
bun scripts/migrate/legacy-to-mt-prod/hosted-prod-verify.ts
bun scripts/migrate/legacy-to-mt-prod/hosted-r3-smoke.ts
bun scripts/migrate/legacy-to-mt-prod/verify-phase1-wiring.ts
# Auth redirects (Management API token required):
bun scripts/migrate/legacy-to-mt-prod/verify-fwor-auth-redirects.mjs
```

At T0 freeze:

```bash
CUTOVER_FREEZE_PAIR=1 LEGACY_INVENTORY=backups/migration/inventory-<freeze>.json \
  bun scripts/migrate/legacy-to-mt-prod/hosted-prod-verify.ts
```

## Next phase after checklist

**Phase 6** integrations + **`kamewave`** function deploy to fwor, then **Phase 7–8** T0.

Related: [`legacy-to-mt-prod-migration.md`](./legacy-to-mt-prod-migration.md), [`legacy-integration-inventory.md`](./legacy-integration-inventory.md).
