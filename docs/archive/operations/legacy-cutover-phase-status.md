---
title: Legacy cutover — phase completion status
status: active
updated: 2026-11-02
tags: [operations, migration]
---

# Legacy cutover — phase completion status

**Status:** Prep through Phase 5 is done. **Live site is still legacy** until cutover day (T0).

**Only step left before go-live:** the T0 freeze day (freeze legacy → reload from the freeze dump → move the legacy apex → activate crons). `kamespace.com` is already live with the current build, Resend sending/inbound are verified, and Auth points at it. Say **`kamewave`** when you want that day’s run.

Single progress view for Plan 02 (`kamespace-02`) and prerequisite Plan 01 (`kamespace-01`). **Production Supabase = `fworvijbrwpyngycotbz`** (2026-10-27). Live guests still on legacy Vercel + `zftt…` until T0.

Legend: **Done** | **Partial** | **Open** | **N/A (T0 / operator)**

## Summary (phases 0–5)

| Phase             | Status           | Gate to Phase 6                                                                                                                                                                                                                                                 |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Inventory   | **Done**         | B-18 signed off 2026-11-01; optional B-16/B-17/B-12 later                                                                                                                                                                                                       |
| **1** Prod wiring | **Partial**      | **2026-11-02:** extensions enabled (`pg_cron`/`pg_net`), 26 cron jobs defined and outbound ones parked. Open: prod Google OAuth (optional for T0) — [`phase1-prod-wiring-checklist.md`](./phase1-prod-wiring-checklist.md) |
| **2** Tooling     | **Done**         | —                                                                                                                                                                                                                                                               |
| **3** Shaping     | **Done** on fwor | `kameworks.tech` first login; super-admin secret on fwor; D6 scripts shipped                                                                                                                                                                                    |
| **4** Rehearsals  | **Partial**      | R3 automated + host walkthrough **2026-11-01** done; rollback dry-run sign-off optional — [`r3-rollback-rehearsal.md`](./r3-rollback-rehearsal.md)                                                                                                              |
| **5** App prep    | **Done** (code)  | §5.7 calendar blocking verified 2026-11-02; PMO forward proof at T0; structural SQL automated                                                                                                                                                                                            |

**2026-11-03 cutover delta (targeted, not a reload):** legacy vs prod parity checked table by table. Only one booking had changed on legacy (`f9e646d0…` GAF approved 2026-11-01, `PENDING_DOCUMENTS → READY_FOR_CHECKIN`) plus five `processed_emails` rows. Both were synced directly; the approved PDF was already in Storage. Status mix and counts now match exactly (450 bookings; 426/14/8/1/1). `platform_settings.migration_cutover_at` reset to the switch time. `app.kamehomes.space` now 308s to `kamespace.com`. **Remaining before legacy intake stops: move `kamehomes.space` + `www` off the legacy Vercel project.**

**2026-11-02 email + grants:** `kamespace.com` and `inbound.kamespace.com` are **verified** in Resend. A test message from `mail@kamespace.com` delivered; a signed inbound event and a real Resend webhook both wrote `processed_emails`; a bounce wrote `email_suppressions`. Root cause of the earlier silent inbound failure: a restore left 9 public tables with **RLS but no grants** for `service_role`. Fixed and captured in `sql/75-restore-public-grants.sql` (run after every reload).

**Phase 6:** edge secrets synced **2026-11-01**; CD Prod deploy green; Resend domains created (`kamespace.com`, `inbound.kamespace.com`). Open: DNS records, prod Google OAuth, PayMongo live mode. Operator summary: [`migration-module-status-summary.md`](./migration-module-status-summary.md).

**Phase 6+** T0 freeze pair: `CUTOVER_FREEZE_PAIR=1` + fresh legacy inventory.

**2026-11-02 cron proof:** the every-minute jobs (`marketing-generation-sweeper`, `voice-receptionist-reaper`) fire and the Edge handlers return `200` (`net._http_response`), so the `pg_cron → pg_net → function` loop is proven on prod.

**2026-11-02 prod cleanup:** QA fixtures and legacy guest sign-ins removed. Prod now holds 1 org (`kame-homes`), 1 property (`monaco-2604`), 2 auth users. Re-running the QA seed against `fwor` now requires `QA_SEED_CONFIRM=yes`.

## Plan 01 — legacy secrets backup

| Phase       | Status      | Notes                                                                                |
| ----------- | ----------- | ------------------------------------------------------------------------------------ |
| B0 Prep     | **Done**    | gitignore, hooks, templates, env skip                                                |
| B1 Capture  | **Partial** | 32+6 local keys; capture + liveness ok; legacy CLI secrets **403**; Vercel pull open |
| B2 Seal     | **Partial** | Tar + SHA256; age + B-17 drill open                                                  |
| B3 Hand-off | **Partial** | Integration inventory; B-18 sign-off open                                            |

Scripts: `merge-legacy-prod-env.mjs`, `capture-legacy-config.ts`, `verify-secret-hashes.ts`, `legacy-env-liveness.ts`, `build-legacy-prod-archive.sh`.

## Plan 02 — cutover phases (detail)

| Phase    | Status          | Notes                                                                                                                |
| -------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **0**    | **Done**        | 0.2 closed on R1/R2 evidence — [`legacy-schema-drift-0.2.md`](./legacy-schema-drift-0.2.md); 0.5 values in local env |
| **1**    | **Partial**     | 1.7 guards done; extensions + crons done 2026-11-02; checklist above                                                   |
| **2**    | **Done**        | R1/R2 + Oct 27 load + verify/safety                                                                                     |
| **3**    | **Done**        | Org/property/owner/plan on fwor; 3.9 export/import scripts                                                              |
| **4**    | **Partial**     | R1/R2 done; `hosted-prod-verify.ts` + `hosted-r3-smoke.ts` **2026-11-01/02**                                            |
| **5**    | **Done** (code) | 5.1–5.6 shipped; 5.7 structural via `hosted-prod-verify.ts`                                                             |
| **6**    | **Partial**     | Edge secrets synced; CD Prod green; crons installed but parked. Resend inbound MX + prod OAuth at T0                    |
| **7–10** | **Open**        | `main → develop` merged 2026-11-02; tag + `develop → main` + T0 DNS/freeze + hypercare                                  |

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
