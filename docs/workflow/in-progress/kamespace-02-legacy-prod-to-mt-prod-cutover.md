---
stage: in-progress
title: 'Legacy prod → multi-tenant prod cutover (data, storage, accounts, cleanup)'
status: in-progress
tags: [planning, deployment, migration, supabase, storage, vercel, multi-tenancy, cutover]
updated: 2026-11-01
---

# Legacy prod → multi-tenant prod cutover

## Progress (2026-11-02)

- **Done:** Phases 0, 2, 3 and 5 code on `fwor…` as prod; data + Storage loaded; automated R3 verify/smoke; safety guards; `pg_cron`/`pg_net` installed with 26 jobs defined; prod cleaned of QA fixtures and legacy guest sign-ins.
- **In progress:** Phase 1 prod wiring (Auth URLs, Vercel/GitHub env), Phase 6 integrations, T0 freeze pair.
- **Pending:** `kamespace.com` DNS + Resend inbound + prod Google OAuth (plan 04), T0 freeze + reload + DNS, Phases 7–10 decommission. `main → develop` merge landed 2026-11-02; re-merge at T0.

**Series.** Plan 2 of 5 in the Kame Space launch series: [01 secrets backup](./kamespace-01-legacy-prod-config-secrets-backup.md) → [02 cutover](./kamespace-02-legacy-prod-to-mt-prod-cutover.md) → [03 rebrand](./kamespace-03-rebrand-kame-homes-to-kame-space.md) → [04 domain move](./kamespace-04-domain-move-kamespace-com.md) → [05 Google verification](../planned/kamespace-05-google-services-verification.md).

**Goal.** Move Kame Homes off the live legacy stack (`main` → Vercel `guest-form-management-app` on `sprmkes-projects` → Supabase `zfttdwtceyqszyeyhilc`) onto the new multi-tenant app (`develop` → Vercel `kame-homes` on `kame-works` → **`fwor…` reused as multi-tenant production**). Every legacy row, Auth user and Storage object lands in mt-prod under a proper **Kame Homes org → property** shape. Every booking already on the books (especially future stays) keeps working end to end: links in emails already sent, document approvals, SD refunds, calendar availability, Telegram summaries. After a stable hypercare period, retire the legacy repo branch, Vercel project, Supabase project, domain wiring and service accounts.

This plan supersedes the stub task list in [`legacy-to-mt-prod-migration.md`](../../archive/operations/legacy-to-mt-prod-migration.md) and fills in Phase B of [`multi-tenant-dev-prod-environments.md`](../in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md).

---

## 1. What the repo already tells us (facts, verified 2026-10-22)

| Fact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Evidence                                          | Consequence                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` is a strict ancestor of `develop`: 0 commits on `main` not on `develop`, 1,970 on `develop` not on `main`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `git rev-list --count`                            | `develop → main` can fast-forward. Any legacy hotfix landed before cutover must be merged into `develop` first.                                                                                                                          |
| All 85 legacy migrations exist on `develop`. 83 are byte-identical. 2 differ (`20260724140000_recurrence_twice_monthly`, `20260724150000_recurrence_every_6_months`).                                                                                                                                                                                                                                                                                                                                                                                                                                                  | per-file `git diff main develop`                  | The 2 diffs only drop a `maintenance_items` constraint that later migrations re-add. Harmless for a DB that already ran the legacy versions.                                                                                             |
| `develop` adds **322 migrations** (407 total), many **interleaved** with legacy timestamps (for example `20260629180000_multi_tenancy_foundation` sits between legacy `202606*` files).                                                                                                                                                                                                                                                                                                                                                                                                                                | `ls supabase/migrations`                          | Upgrading a restored legacy DB needs `db push --include-all`. Out-of-order apply is **untested** today, so rehearsal is mandatory.                                                                                                       |
| The migration chain was **written to upgrade legacy data in place**. `20260629180000_multi_tenancy_foundation.sql` creates org `kame-home` ("Kame Home") owned by `kamehome.azurenorth@gmail.com` and property `monaco-2604` ("Monaco 2604", Azure North), then sets `property_id` on all `guest_submissions`, `finance_line_items` and early settings tables. Later migrations (`20260714120000_backfill_legacy_booking_statuses`, `20260703150000_org_settings`, `20260714130000_payment_methods_jsonb`, `20260719100000_developments`, `20260821120000_multi_tenancy_late_tables_property_id`, …) backfill further. | migration headers                                 | **Restore-then-upgrade** reuses those backfills instead of re-implementing them in an ETL. On an empty DB they silently skip (`RAISE NOTICE … skip`), which is why mt-dev never exercised them with real data.                           |
| Legacy buckets: `payment-receipts`, `valid-ids`, `templates`, `pet-vaccinations`, `pet-images`, `parking-endorsements`, `approved-gafs`, `approved-pet-forms`, `sd-refund-receipts`, `app-settings-assets`. New app adds 9 more and makes guest-PII buckets **private** (`20261310120100_guest_doc_storage_private_reads`).                                                                                                                                                                                                                                                                                            | migrations                                        | Object paths must be preserved. Stored URLs embed the `zftt…` host and must be rewritten. Readers parse URLs host-agnostically (`_shared/storageSignedUrl.ts#parseStorageObjectUrl`), but PDFs, emails and previews still show the host. |
| Public guest endpoints **require** `?property=` or an id (`_shared/propertyScope.ts#resolvePublicPropertyId`, no default). The new UI's `legacyGuestRedirects` send `/form`, `/sd-form?bookingId=…` etc. **without** `?property=` to `/properties`, which drops the booking.                                                                                                                                                                                                                                                                                                                                           | `ui/src/features/guest/property/routes/index.tsx` | Links in emails already sent from legacy (SD form, pay-parking, success) break unless the legacy host injects the property slug. See §6.                                                                                                 |
| Legacy integrations that **no longer exist** in the new app: Google Calendar sync, Google Sheets sync, Gmail listener for PMO approvals (`calendarService.ts`, `sheetsService.ts`, `gmail-listener`). New app uses Resend inbound (`approval-email-webhook`) + iCal (`calendar-sync-cron`, `ical-export`).                                                                                                                                                                                                                                                                                                             | `git show main:supabase/functions/_shared`        | In-flight bookings awaiting a PMO approval reply in Gmail need a manual or forwarding path. Host Google Calendar/Sheet stop updating at cutover.                                                                                         |
| New app schedules **23 pg_cron jobs** (review lifecycle, SD refund, parking reminders, Telegram admin/staff/finance/maintenance/marketing, billing, superhost, contract expiry, …).                                                                                                                                                                                                                                                                                                                                                                                                                                    | `cron.schedule(` in migrations                    | First run on years of historic data may **blast old guests** (review requests, reminders). Each cron needs an audit before go-live (§5.6).                                                                                               |
| `scripts/migrate/legacy-to-mt-prod/` is a README stub. `scripts/data/sync-prod-public-data-to-local.sh` already handles pooler/IPv4 dumps of legacy. `backup-supabase.sh` / `rollback-supabase.sh` exist.                                                                                                                                                                                                                                                                                                                                                                                                              | `scripts/`                                        | Reuse the connection and dump helpers. Don't invent a new dump path.                                                                                                                                                                     |

---

## 2. Scope

**In**

- New accounts and projects: mt-prod Supabase (new Supabase account/org), `kame-homes` Vercel Production (kame-works), production-grade secrets for every integration.
- Postgres: full legacy data (public + `auth` + migration history + `storage.buckets`) restored, then upgraded by the `develop` migration chain.
- Kame Homes tenant shaping: org name/slug, property records, owner + team members, org settings, verification tier, plan entitlement, development link, public listing.
- Storage: every object in every legacy bucket copied with the same path, then a DB URL rewrite.
- Auth: carry users over with the same UUIDs (bookings, finance and audit rows reference them).
- Continuity of existing and future bookings (§6), including links in emails already sent.
- `develop → main` merge, CD prod enablement, domain and DNS cutover.
- Rehearsals with written acceptance criteria, a cutover-day runbook, rollback, hypercare.
- Decommission of legacy repo track, Vercel project, Supabase project, domain wiring and old service credentials, gated by time and checks.

**Out**

- Re-creating legacy Google Calendar events or Sheets rows in the new app. The new app does not use them.
- Gmail inbox history import. Approvals already processed live in `processed_emails`. Unprocessed ones are handled manually (§6.3).
- New product features. Only migration-enabling fixes, such as legacy-link redirects and cron watermarks.
- Merging mt-dev (`fwor…`) test data into prod. Only the curated Kame Homes **configuration** may be exported from dev (decision D6).

---

## 3. Decisions (recommended; confirm in §12)

| #      | Decision                        | Recommendation                                                                                                                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                         |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Data strategy                   | **Restore-then-upgrade.** Dump legacy (roles, schema, data incl. `auth` + `supabase_migrations`), restore into a fresh mt-prod, run `supabase db push --include-all` with the `develop` chain, then apply a Kame Homes shaping script. **Fallback:** fresh schema + per-table ETL, only if rehearsal shows the out-of-order chain cannot be fixed with small new migrations. | The chain already encodes the legacy → multi-tenant transforms. Preserves every UUID, so booking links, storage paths and audit references stay valid. ETL would re-implement roughly 40 backfills by hand. |
| **D2** | Write freeze vs live delta sync | **Planned freeze window** (2–4 h, late night Manila, low check-in day). Legacy guest intake shows a maintenance page. Final dump taken after the freeze starts.                                                                                                                                                                                                              | Single-host volume makes a short freeze cheap. A delta sync across a changing schema is the riskiest code in the whole plan.                                                                                |
| **D3** | Auth users                      | **Carry over** via the `auth` schema dump (same `id`, email, identities). Every session is invalidated (new JWT keys), so admins sign in again with Google on the new OAuth client.                                                                                                                                                                                          | Same UUIDs keep `organizations.owner_id` and audit FKs intact. Google `sub` is stable across OAuth clients, so the identity rows keep matching.                                                             |

**2026-10-27 update:** only the two admin accounts (`sprmke.dev@gmail.com`, `kamehome.azurenorth@gmail.com`) are carried over. Legacy guests never had app login, so the 5 guest Google sign-ins are dropped during load via `sql/50-cleanup-guest-auth.sql` (nulls `guest_user_id`, deletes the auth rows). `guest_email` is retained on every booking.
| **D4** | Production domain | ~~New app on **`app.kamehomes.space`**~~ **Owner-confirmed 2026-10-25: `https://kamespace.com` is the new prod origin; dev env = `https://dev.kamespace.com`.** Legacy apex `kamehomes.space` + `www` stay redirect-only on the legacy Vercel project → `https://kamespace.com/**` (not `app.kamehomes.space`) for at least 12 months. Rebrand plan revisits later as part of the Kame Space switchover if anything needs to change. | Hundreds of legacy emails hold apex links. The domain itself must never be dropped while bookings or SD refunds reference it. |
| **D5** | Repo | Keep **`sprmke/kame-homes`** as the single repo. "Old repo" cleanup means: tag `legacy-final` on `main`, fast-forward `main` to `develop`, disconnect `main` from the legacy Vercel project, archive legacy-only scripts and guards. Transfer to a `kame-works` GitHub org only if confirmed (Q3). | The repo already hosts both tracks. A new repo would lose history and CI wiring for no gain. |
| **D6** | Source of Kame Homes configuration | **Legacy data + migration backfills are the source of truth for bookings and finance.** Curated config built in mt-dev (property settings, templates, public pages, media, pricing calendars) is exported table-by-table with an allow-list script and imported **after** the upgrade, keyed by property slug, never by dev UUID. | Dev contains test bookings and junk. Only hand-picked config should cross. |
| **D7** | Region / Postgres | mt-prod in **Southeast Asia (Singapore)**, Postgres 17, same as mt-dev. Use the PG17 `pg_dump` from the current Supabase CLI. | Region moves after launch mean another full migration ([`deployment.md`](../../architecture/deployment.md)). |
| **D8** | T0 data path (2026-11-02) | **Reload from the freeze dump.** Legacy keeps taking bookings and edits until the freeze, so the Oct 31 copy is not the freeze-time truth. T0 rebuilds the local rehearsal from the freeze dump and re-pushes (`pushLocalRehearsalToHosted.sh`), then shape + Storage delta + verify. Skip the reload only if the freeze dump shows zero drift across carried tables (same counts, same `max(created_at)`, same `max(updated_at)`). No hand-patching of individual rows. | The alternative, a row-level delta across a live schema, is the riskiest code in the plan. A reload is already rehearsed end to end (R1/R2) and wipes any fixture rows. |

---

## 4. Environment and account inventory

| Surface                                           | Legacy (retire)                                                             | New (target)                                                                 | Action                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Git                                               | `main` (legacy UI + 85 migrations)                                          | `develop` → merged to `main` at cutover                                      | Tag `legacy-final`, fast-forward                                          |
| Vercel                                            | `guest-form-management-app` (`sprmkes-projects`), apex `kamehomes.space`    | `kame-homes` (`kame-works`), Production branch `main`, `app.kamehomes.space` | Production env vars, domain moves                                         |
| Supabase                                          | `zfttdwtceyqszyeyhilc` (old account)                                        | **mt-prod** (new account, ref TBD)                                           | Create, restore, upgrade                                                  |
| Supabase dev                                      | n/a                                                                         | `fworvijbrwpyngycotbz`                                                       | Source for D6 config export only. Confirm which account it lives in (Q4). |
| Auth providers                                    | Google OAuth (legacy client), `ADMIN_ALLOWED_EMAILS`                        | Google OAuth **prod** client → mt-prod callback                              | New client, origins, redirect URIs                                        |
| Email                                             | Resend (legacy account?), legacy sender domain, Gmail inbox for PMO replies | Resend prod account, `inbound.kamehomes.space` MX → `approval-email-webhook` | Domain verification move (§7)                                             |
| Telegram                                          | Bot tokens in legacy `telegram_*_settings` rows                             | Same rows after migration                                                    | **Disable legacy crons first** to avoid duplicate posts                   |
| Google                                            | Service account, Calendar, Sheets, Gmail OAuth                              | Maps key, OAuth client only                                                  | Revoke legacy credentials at decommission                                 |
| Meta / PayMongo / PostHog / Gemini / Groq / VAPID | n/a on legacy                                                               | Prod credentials on mt-prod + Vercel                                         | Fresh setup per existing checklists                                       |
| GitHub Environments                               | n/a                                                                         | `production` env secrets, `CUTOVER_ENABLED`, `cd-prod.yml`                   | Enable after first manual upgrade                                         |
| DNS (Namecheap)                                   | `@`, `www` → legacy Vercel                                                  | `app`, `@`, `www`, `inbound` (MX), Resend DKIM/SPF                           | Lower TTLs to 300 s at T-48h                                              |

---

## 5. Implementation tasks

### Phase 0 — Inventory and sign-off (no writes anywhere)

- [x] **0.1 Legacy row inventory.** Read-only SQL against legacy via the session pooler. Row counts for every `public` table, `auth.users`, `auth.identities`, `storage.objects` grouped by bucket (count + total bytes). `guest_submissions` grouped by `status`, by check-in month, and **future check-ins** (`check_in_date >= today Manila`, both `MM-DD-YYYY` and `YYYY-MM-DD` formats). Save to `scripts/migrate/legacy-to-mt-prod/sql/00-inventory.sql`. Results go to a gitignored `backups/migration/inventory-<ts>.json` (contains no PII, counts only). ✅ **2026-10-24** — done via `scripts/migrate/legacy-to-mt-prod/inventory.ts` (Bun + `pg`, no psql/Docker needed — legacy pooler is IPv4). Snapshot in `backups/migration/inventory-2026-10-24T10-15-26-485Z.json`. Key counts: 18 `public` tables; `guest_submissions` 445 (422 COMPLETED / 13 CANCELLED / 8 READY_FOR_CHECKIN / 1 PENDING_REVIEW / 1 PENDING_DOCUMENTS); **8 future check-ins** (6 ready, 1 review, 1 documents — see §6.3 staging); `auth.users` 7 (7 google identities); storage 1,471 objects across 10 buckets, largest `valid-ids` 566 obj / ~395 MB (~242 MB total all); migration history 85/85 (20240213 → 20260820120000).
- [x] **0.2 Schema drift check.** ✅ **2026-11-01** — closed on R1/R2 + dry-run evidence; doc [`legacy-schema-drift-0.2.md`](../../archive/operations/legacy-schema-drift-0.2.md). Fresh byte-diff optional before T0 if legacy dashboard hotfixes land.
- [x] **0.3 Migration history check.** Confirm `supabase_migrations.schema_migrations` on legacy lists exactly the 85 `main` versions. ✅ **2026-10-24** — exactly 85 rows, versions `20240213`–`20260820120000`; full per-row list captured in the inventory JSON. SPDX note: version list matches `main`'s migration file names in count; byte-level name diff pending 0.2 tooling.
- [x] **0.4 Extension check.** List extensions on legacy (`pg_cron`, `pg_net`, `vault`, `pgcrypto`, …) vs what `develop` migrations need. ✅ **2026-10-24** — legacy has `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`. `develop` migrations additionally declare `pg_trgm`: **enable it in Phase 1.3** before restore. `vault` is unused; GMAIL listener retention is decided via §6.5, not blocked by extension absence. mt-prod Phase 1.3 enable-list: `pgcrypto`, `pg_trgm`, `pg_cron`, `pg_net`, `plpgsql`.
- [~] **0.5 Integration inventory.** Names-only runbook: [`legacy-integration-inventory.md`](../../archive/operations/legacy-integration-inventory.md). Values: Plan 01 local capture **2026-11-01** (32/32 edge template keys). **B-18 sign-off** still gates Phase 1 decommission and §10. Hosted digest match (B-06) pending CLI access.
- [x] **0.6 Legacy link inventory.** Grep legacy email templates and `main` UI for every guest-facing URL pattern emitted to date (`/form`, `/success`, `/calendar`, `/sd-form?bookingId=`, `/bookings/:id/parking`, PDF/asset links). This feeds the redirect map in §6.1. ✅ **2026-10-24** — complete list: guest emails only ever link `${publicGuestAppOrigin}/sd-form?bookingId=<uuid>` (`emailService.ts:1403`). Admin/host links: `/bookings/<uuid>` (calendar service + Telegram + email shell). Asset URLs on the apex host: `/images/logo.png` (email logo, `renderEmailHtml.ts`) and `/images/kame-home-gcash-qr-payment.jpg` (QR; custom override may instead embed a `zftt…` Storage URL). Legacy never emitted `/form`, `/calendar`, `/success`, `/guest-review`, or pay-parking links inside emails (verified by grep); those exist only as manually shared `/form`/`/calendar` intake links. Static `/images/*` paths already exist on develop (`ui/public/images/`), so the apex cutover serves them unchanged. Storage object URLs embed the `zftt…` host; guest PII buckets become private in the new app, so guests' old links reach only `templates`/`app-settings-assets` (covered by legacy-storage-alive-through-hypercare).
- [x] **0.7 Answer §12 open questions** and freeze D1–D7. 🔶 **2026-10-24** — Q1 brand/slug: proposed `Kame Homes`/`kame-homes` (confirm with host); Q2: legacy serves exactly **one unit** (445 bookings, single `app_settings` row, Telegram setting rows confirmed single-property) — Monte/2604-only is effectively confirmed; Q3–Q9 still open. D1–D7 validated by R1 so far (restore-then-upgrade works).

### Phase 1 — Accounts and mt-prod provisioning

**Reframed 2026-10-27:** no separate mt-prod project yet. Reuse **`fworvijbrwpyngycotbz`** as production; tasks below are rewired to dashboard rename, prod Vercel/GitHub env, and guards (not "create new project").

- [~] **1.1** ~~Create mt-prod~~ **Reuse `fwor…` as prod** — rename in Supabase dashboard; record ref in [`deployment.md`](../../architecture/deployment.md) and `supabase/.env.prod.local`. Data + Storage already loaded 2026-10-27.
- [ ] **1.2** Create a throwaway hosted **rehearsal** project in the same account and region (deleted after cutover).
- [x] **1.3** Enable required extensions on both before restore (from 0.4). ✅ **2026-11-02** — `pg_cron` and `pg_net` were missing on `fwor` (the cron migrations no-op without them, so all migrations were marked applied with zero jobs). Installed both plus `pg_trgm` was already present; `supabase_vault` and `uuid-ossp` were present. Rebuilt the job surface with `sql/60-install-extensions-and-crons.sql`: **26 jobs** defined, 13 outbound jobs parked inactive until the T0 go call, and `cron.job_run_details` confirms execution (per-minute jobs succeeded).
- [ ] **1.4** Auth config: Site URL `https://kamespace.com`, redirect URLs, Google provider with the **prod** OAuth client. JWT/API keys stay new (sessions reset by design).
- [ ] **1.5** Vercel `kame-homes`: Production env vars (`VITE_SUPABASE_URL`, `VITE_API_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, PostHog, …) → mt-prod. Production branch = `main`. Do **not** attach `kamespace.com` to Production until cutover (domain registered/verified at T-2d; fallback `app.kamehomes.space` if unavailable — rebrand R2 TODO).
- [x] **1.6** GitHub `production` environment secrets for mt-prod. ✅ **2026-11-01** — `bootstrap-github-production-env.sh`; `CUTOVER_ENABLED=true` for CD Prod.
- [x] **1.7** Update `scripts/dev/prod-deploy-guard-lib.sh` / `check-linked-project.sh` so the mt-prod ref is recognized as **prod** (kamewave-gated) and `zftt…` stays deny-listed for multi-tenant deploys. ✅ **2026-11-01** — `check-linked-project.sh` classifies `fwor…` as prod; guard lib documents fwor-as-prod; migration `lib.sh` `require_kamewave_for_remote_target`.

### Phase 2 — Migration tooling (`scripts/migrate/legacy-to-mt-prod/`)

Bash orchestrator plus SQL files plus one Bun script for Storage. Every stage is idempotent, logs to `backups/migration/<run-id>/`, and refuses to write to `zfttdwtceyqszyeyhilc`.

```
scripts/migrate/legacy-to-mt-prod/
  README.md                       runbook entry point (replace stub)
  migrate.sh                      stages: preflight | dump | restore | upgrade | shape | rewrite | storage | config-import | verify
  lib.sh                          target guards, pooler/IPv4 URL helper (lift from scripts/data/sync-prod-public-data-to-local.sh)
  sql/00-inventory.sql            read-only counts (legacy and target)
  inventory.ts                    Phase 0.1 runner: bun + pg for sql/00-inventory.sql (counts-only JSON; guards)
  sql/05-legacy-freeze.sql        unschedule legacy pg_cron jobs, record freeze timestamp (run on LEGACY with kamewave)
  sql/10-post-restore-fixups.sql  drift fixes from 0.2, before upgrade
  sql/20-shape-kame-homes.sql     org/property/member/settings shaping (Phase 3)
  sql/30-rewrite-storage-urls.sql zftt host → mt-prod host, legacy origin → new origin
  sql/40-derived-rebuild.sql      search index, rollups, counters, sequences
  sql/45-cron-watermarks.sql      (realized instead as 20261316128600 watermark migration + _shared/cutoverWatermark.ts guard)
  sql/50-cleanup-guest-auth.sql   drop legacy guest sign-ins after a restore
  sql/60-install-extensions-and-crons.sql  pg_cron/pg_net + rebuild 26 jobs, park outbound until T0
  sql/61-activate-all-crons.sql   T0: activate every parked job after legacy crons stop
  sql/70-clean-prod-test-data.sql remove readiness-QA orgs/users from a project used as prod
  sql/90-verify.sql               invariants; exits non-zero on failure
  storage/copyBuckets.ts          resumable object copy with manifest + size/etag check
  config/exportDevConfig.ts       D6 allow-list export from fwor keyed by slug
  config/importConfig.ts          import onto mt-prod by slug
  verify/compareCounts.ts         legacy inventory vs target, per table
```

- [x] **2.1 `dump`.** Use `supabase db dump --db-url "$LEGACY_DB_URL"` three times: `--role-only` → `roles.sql`; schema → `schema.sql`; `--data-only --use-copy` → `data.sql`. Include `auth`, `supabase_migrations` and `storage.buckets`. **Exclude `storage.objects`**, which the copy script recreates. Dumps go to gitignored `backups/migration/<run-id>/`. They contain PII: never commit, delete after hypercare. 🔶 **2026-10-24** — dump path verified read-only against legacy (`--schema public` probe → `backups/migration/schema-probe/legacy-public-schema.sql`). Full three-file dump runs inside `migrate.sh dump` at rehearsal time.
- [x] **2.2 `restore`.** `psql` with `session_replication_role = replica` for data, in order: roles → schema → data. Abort on the first error. ✅ **2026-10-24 (R1)** — implemented in `migrate.sh restore`; clean full restore of legacy into local `legacy_r1`. Supabase CLI skips managed schemas, so `auth`/`storage`/`supabase_migrations` schemas are dumped via `postgres:17` Docker (`pg_dump --schema=…`); `data.sql` is filtered to `public`-only COPY blocks (awk) because those schemas carry their own data files. Restore prerequisites now encoded: `CREATE DATABASE … OWNER TO postgres` + `extensions`/`priv`/`vault`/`pgsodium(_masks)` schemas + `supabase_realtime` publication + `pgcrypto`/`pg_cron`/`pg_net` extensions, all idempotent. (`session_replication_role` not needed because COPY order respects FKs; revisit if a later table set introduces cycles.) Local rehearsal requires temporarily pointing `cron.database_name` at the rehearsal db + a Postgres container restart (`stage_reset_cron_db` reverts); on mt-prod restore lands in `postgres` itself so the switch is unnecessary there.
- [x] **2.3 `upgrade`.** Run `sql/10-post-restore-fixups.sql`, then `supabase db push --db-url "$TARGET_DB_URL" --include-all`. **Manual, kamewave-gated, first time only.** `cd-prod.yml`'s strict-order check would reject the interleaved versions on this one run. Capture the full log. ✅ **2026-10-24 (R1)** — the full 322-migration chain applied to real legacy data on the make-go rehearsal db with exactly **one** chain fix needed (see 2.4: `20260629215000_gmail_listener_state_singleton_drop_guard.sql`). Full logs under `backups/migration/r1-20261024/upgrade-push.log`.
- [x] **2.4 Chain fixes.** ✅ **2026-10-24 (R1, first finding):** `20260629220000_gmail_listener_state_per_property.sql` updated `gmail_listener_state.id` from `'default'` → `property_id::text` while the legacy `CHECK gmail_listener_state_singleton (id='default')` still existed → contradicts on the real singleton row. Fix: NEW guard migration **`20260629215000_gmail_listener_state_singleton_drop_guard.sql`** (drops the legacy constraint early; no-op on fresh DBs where the UPDATE in 29220000 had nothing to do). Shipped migrations untouched, per policy.
- [x] **2.5 `rewrite`.** Generic scan of every `text`/`jsonb` column in `public` for `zfttdwtceyqszyeyhilc.supabase.co` and the legacy origin (`https://kamehomes.space`, `https://www.kamehomes.space`). Rewrite to the mt-prod host and `https://app.kamehomes.space`. Print a before/after count per column. Also set `public_guest_app_origin` and similar origin settings in `app_settings` / `org_settings`. ✅ **2026-10-24 (R1)** — `sql/30-rewrite-storage-urls.sql` executed cleanly on the rehearsal db: 17 `guest_submissions` URL columns, `app_settings`/`org_settings` logo + `public_guest_app_origin` (→ `app.kamehomes.space`), plus an `activity_log.changes` jsonb rewrite. Post-rewrite check: 0 `zftt`/legacy-origin refs remaining in `guest_submissions`; target host is a psql var (`PSQLVAR_TARGET_HOST`), so mt-prod gets the real project ref. Only LIKE-guarded rows are re-updated, so the stage is idempotent.
- [x] **2.5b `derived-rebuild`.** Sequences → bump every owned sequence past max(id); search index → repopulate the trigger-maintained `public_listing_search` by no-op-updating the base tables (triggers were created after rows were restored). ✅ **2026-10-24 (R1)** — `sql/40-derived-rebuild.sql`: index repopulated (2 rows: 1 property + 1 development) and sequences bumped.
- [x] **2.6 `storage`.** ✅ **2026-10-25 (R2)** — `storage/copyBuckets.ts` (modes `manifest` / `dry-run` / `copy`). Dry-run against legacy with `LEGACY_SERVICE_ROLE_KEY`: **1,471 / 1,471 objects reachable, 0 missing, exact size match** — the private buckets (`approved-gafs` 229, `approved-pet-forms` 11, `sd-refund-receipts` 128, `templates` 3) need the service-role bearer; public reads use `?apikey=x`. Tooling notes baked in: env vars must also be readable from gitignored `supabase/.env.local` (shell child-env can be unreliable); `LEGACY_OBJECT_BASE_URL` should end at `/storage/v1` (the script appends the route). Full object copy executes on R3/cutover day after mt-prod exists. The pasted-in-chat key is queued for §10.4 rotation.
- [x] **2.7 `verify`.** Exit non-zero unless every invariant in §5.7 holds. ✅ **2026-11-01** — `migrate.sh verify` runs `90-verify.sql` + `verify/parseSqlVerify.ts`, target inventory (`INVENTORY_OUT`), and `verify/compareCounts.ts`.
- [x] **2.8 Safety.** A `--dry-run` flag on every stage. Hard refusal if the target ref equals legacy. Kamewave prompt on any stage touching mt-prod or legacy. `log_deploy()` audit line per stage. ✅ **2026-11-01** — `DRY_RUN=1` on dump/restore/upgrade; `require_kamewave_for_remote_target` for remote `TARGET_DB_URL`; `log_deploy_stage` → `backups/deploy-log.csv`; legacy ref guard unchanged.

### Phase 3 — Kame Homes org and property shaping (`sql/20-shape-kame-homes.sql`)

Runs after `upgrade`. All statements are idempotent and keyed by slug.

- [x] **3.1 Org.** ✅ **2026-10-25 (R2 rehearsal + owner decision)** — file `sql/20-shape-tenant-org.sql` (neutral name per rebrand R1). Owner confirmed the cutover tenant shape stays **"Kame Homes" / `kame-homes`** (§12.1) — the Kame Space rename remains a later step of the rebrand plan, which then renames the tenant too. Description seeded; logo/favicon/logo_url sourced from legacy `app_settings.email_logo_url` rewritten to `https://kamespace.com/images/logo.png` (origin decisions in D4/§12). Old org slug search covered by the rewrite report (0 legacy refs). Set description, logo (`logo_url` from `app-settings-assets`), contact info from legacy `app_settings`. **Changing the slug changes every admin URL.** Do it before any link is shared, and confirm no stored URL embeds the old org slug (search in 2.5).
- [x] **3.2 Owner.** ✅ **2026-10-25** — backfill did not fall back to "oldest auth user": `organizations.owner_id` resolves to `kamehome.azurenorth@gmail.com` (asserted loudly by the shaping SQL, which now raises if absent).
- [x] **3.3 Property / properties.** ✅ **2026-10-25** — chain backfills carry `monaco-2604` complete (ACTIVE/CONDO, tower/unit, residence Azure North, max 6 guests). Shaping adds the idempotent floor + house rules + check-in/out window settings (14:00/11:00 legacy-confirmed). Single-unit inventory-confirmed (Q2 closed).
- [~] **3.4 Team.** 🔶 shaping inserts every `ADMIN_ALLOWED_EMAILS` email (owner auto-skipped) as `organization_members.role_id='ADMIN'`; owner-confirmed 2026-10-27: exactly two admin emails — `sprmke.dev@gmail.com` and `kameworks.tech@gmail.com` (no other staff). Shaping seats auth users that exist in legacy (`sprmke.dev` done in rehearsal); `kameworks.tech` has never signed in on legacy, so it rides the `ADMIN_ALLOWED_EMAILS` super-admin secret on mt-prod and gets its org member row on first Google sign-in.
- [~] **3.5 Plan and verification.** 🔶 comped `managed` `org_subscriptions` (`source='admin'`, price snapshot 0, `active`) + org `settings.verification.{baseStatus,enhancedStatus}='approved'` ✓ (verified badge on). Remaining when cutover happens: confirm the comped snapshot is what finance expects, and the super-admin allow list on mt-prod (§3.6 secret setup).
- [x] **3.x activity trail.** ✅ one `activity_log` row `org.migrated_from_legacy` (source `cron`, redacted changes with legacy ref + slug mapping), idempotent.
- [x] see 3.4 note above (owner must confirm the prod allow list before T0).
- [x] see 3.5 note above (comped managed + verified badge implemented and idempotent).
- [x] **3.6 Super-admin.** ✅ **2026-11-01** — `SUPER_ADMIN_EMAILS` (+ admin allow list) on fwor via `push-fwor-secrets-from-local.mjs`; confirm `/admin` on sign-in with listed emails.
- [x] **3.7 Parking.** ✅ booking add-on kept (migrations preserved `parking_*` on `guest_submissions`; no vertical created). A dedicated parking **vertical** is a §12b revisit todo (owner: defer).
- [~] **3.8 Telegram and email automation settings.** 🔶 per-property `telegram_*_settings` restored with `property_id` (chain backfill, restored row counts match); bots/chat IDs carried. At R3/cutover: null the tokens in rehearsal, verify new-app email automations resolve per property and one Telegram summary per slot.
- [x] **3.9 D6 config import** (owner-confirmed: carry curated config). ✅ **2026-11-01** — `config/exportDevConfig.ts`, `importConfig.ts`, `allow-list.json`; procedure in [`config/README.md`](../../../scripts/migrate/legacy-to-mt-prod/config/README.md). Run against pre-load backup restore, not live fwor, unless overwriting prod config intentionally.

### Phase 4 — Rehearsals (mandatory; at least 3)

| Run                | Target                                                               | Data                             | Outbound integrations                                                                                                                   |
| ------------------ | -------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R1                 | Local Docker (`./dev.sh`, then wipe the DB, then restore)            | Fresh legacy dump                | None (no secrets)                                                                                                                       |
| R2                 | Local, after chain fixes from R1                                     | New dump                         | None                                                                                                                                    |
| R3 dress rehearsal | Hosted rehearsal project + `kame-homes` Preview deploy pointed at it | Fresh dump **plus Storage copy** | **Disabled.** No Resend key (or a sandbox domain), Telegram tokens nulled in DB, Meta/PayMongo unset, crons enabled to test §5.6 guards |

- [x] **4.1** Time every stage. The sum sets the freeze window length for D2. 🔶 **2026-10-24 (R1 local, Wi-Fi, no mt-prod yet):** dump ≈ 2 min · restore ≈ 50 s · upgrade (322 migrations) ≈ 2.5 min · rewrite < 1 min · derived-rebuild < 10 s. Remote timings will be slower (dump over pooler ≈ +80%); even doubling everything, the DB work fits comfortably inside a 2–3 h freeze.
- [x] **4.2** Run `verify` and `compareCounts.ts`. Fix, then rerun from scratch, until clean twice in a row. ✅ **2026-10-24/25 (R1 + R2)** — clean **twice in a row**: R2 reran the full cycle from a fresh dump (dump → restore → fixups → upgrade → rewrite → derived-rebuild → inventory) straight through with zero failures; `verify/compareCounts.ts` (inventory pair diff, with the intentional-develop-drops allowlist) reports all counts match, legacy vs upgraded target, fast-forward both times.
- [x] **4.3** Functional smoke on R3 (§5.7 list). ✅ **2026-11-01** — automated smoke + host admin walkthrough on dev signed off ([`r3-rollback-rehearsal.md`](../../archive/operations/r3-rollback-rehearsal.md)). PMO forward proof remains optional hypercare.
- [~] **4.4** Test the **rollback** path: legacy unfreeze steps and DNS revert (§8.5). ✅ **2026-11-01** — dry-run checklist in [`r3-rollback-rehearsal.md`](../../archive/operations/r3-rollback-rehearsal.md); operator sign-off row open.
- [x] **4.5** Write the final timings and any deviations into the runbook. ✅ **2026-11-01** — R1 local timings in §4.1; consolidated tracker [`legacy-cutover-phase-status.md`](../../archive/operations/legacy-cutover-phase-status.md).

### Phase 5 — App changes needed before cutover (on `develop`)

- [x] **5.1 Legacy link redirects** (§6.1). ✅ **2026-11-01** — `ui/vercel.json` host-scoped 308 rules for `kamehomes.space` / `www.kamehomes.space`: `/form`, `/calendar`, `/success` → `https://kamespace.com/properties/monaco-2604/…` (query preserved), then `/(.*)` → `https://kamespace.com/$1` for everything else (admin paths, `/sd-form`, `/bookings/:id/parking`, `/images/*`), which the SPA then resolves (`LegacyAdminRedirect`, `resolve-booking-property`, `LegacyPayParkingRedirect`). Guard test `ui/src/lib/legacyApexRedirects.test.ts` locks the order and the slug. Rules are inert until the apex is attached to `kame-homes` (step 8). **Attach as domains, not dashboard redirects**, or the map is skipped. Plan 04 K-14 later consolidates the host map into code.
- [x] **5.2 Booking-id property resolution.** For `/sd-form`, `/guest-review`, `/success` and pay-parking, when `?property=` is missing and a `bookingId` is present, resolve the property from the booking server-side (public lookup returning slug only) and redirect. Covers legacy links even after the apex redirect is removed. Update `LegacyGuestPathRedirect` to use it instead of dumping guests on `/properties`. ✅ **2026-10-24** — new edge `supabase/functions/resolve-booking-property/` (GET `?bookingId=<uuid>`, rate-limited, slug-only response, 404 for unknown/CANCELLED/IMPORTED, no PII, cache `guestToken`) + `ui/src/features/guest/lib/guestBookingPropertyResolver.ts` (exported `guestEdgeGetUrl` from `guestBookingAccess`, 5 unit tests). `LegacyGuestPathRedirect` (sd-form / guest-review segments) now resolves from the booking instead of dumping on `/properties`; pay-parking already resolved via `get-pay-parking`; `/success` unchanged because no legacy email ever emitted a `/success` link (0.6). Activity log: N/A — read-only. Plans/Team RBAC: N/A — public guest surface, no gated feature.
- [x] **5.3 Maintenance page for legacy.** ✅ **2026-11-01** — static `ui/public/maintenance.html` (no JS, `noindex`, light/dark). **Decision change:** no hotfix commit on `main`, because `develop..main` is 0 today and plan 7.3 needs a clean fast-forward; the page ships with `develop` and the freeze is a Vercel redirect on the legacy project (`/form` → `https://dev.kamehomes.space/maintenance.html`, 308) that is added at the freeze and removed after the go call. Only guest intake is redirected, so admins stay read-only-capable. Steps: [`legacy-to-mt-prod-migration.md`](../../archive/operations/legacy-to-mt-prod-migration.md) § Cutover web config.
- [x] **5.4 PMO approval path for in-flight bookings** (§6.3). 🔶 **2026-11-01** — matcher coverage added in `supabase/functions/_shared/approvalEmailMatcher_test.ts`: forwarded / `RE: Fwd:` subjects and re-sent attachments still match, unit labels are not hardcoded, and attachment names tolerate case/separators. **Host precondition:** the forwarding mailbox must be on the property's Documents Approver allow list, because `isSenderAllowed` checks the outer `From` of the forwarded message; a rejection leaves `processed_emails.reason = sender_not_allowed:<address>`. Runbook updated. R3 proof with a real forwarded approval remains.
- [x] **5.5 Cron watermarks** (§5.6), as new migrations. ✅ **2026-10-25** — `20261316128600_cutover_watermark_platform_settings.sql` adds `platform_settings.migration_cutover_at` (NULL = guards inactive; set at cutover T0 by the shaping script; clearable by super-admin). `platformSettingsCache.ts` exposes `migrationCutoverAt`. **2026-11-02:** `fwor` has the watermark set from the last load; the T0 reload resets it to the freeze time.
- [x] **5.6 Historic-blast audit.** ✅ **2026-10-25 (audit + guards; R3 proof remaining)** — findings: only **review-lifecycle-hourly** could blast historic guests (its fallback opens windows for recent check-outs → new review-request emails to legacy guests). Guard: `_shared/cutoverWatermark.ts::shouldSkipForCutoverWatermark` (checkout < cutover+1d ⇒ settled history) wired into `reviewLifecycle.ts` fallback AND `reviewAutomation.ts` auto-reviews (skip reason `cutover_watermark`); Deno tests pass (5) and full edge suites: 911 `_shared` + 230 `tests/` ok — note: these suites also caught a missing assistant-parity manifest entry (`marketing-ai-sessions`, pre-existing) which is now classified as a Marketing Studio handoff. Everything else is inert or lead-windowed: `sd-refund-cron` only fires for guests near/past check-out whose `sd_refund_form_emailed_at` is null (legacy flags carried over — no duplicates), `parking-reminder-daily` is net-new and only within `REMINDER_LEAD_DAYS` of a future check-in (`parking_reminder_sent_at=null`), legacy-era Telegram crons (telegram-admin-hourly / finance-daily+hourly / maintenance-hourly / staff-daily) are **already unscheduled by the develop chain** (property-scoped dispatch jobs only exist with vault secrets — inert until T0), and `platform-billing-daily` is unrelated until Phase 3.5's comped plan decision. **R3 proof with crons on remains.**
- [x] **5.6 Historic-blast audit.** ✅ see 5.5 note above (audit result merged there; R3 proof with crons on remains).
- [~] **5.7 Verification checklist** (`sql/90-verify.sql` + manual). ✅ **2026-11-01** — structural SQL + inventory via `hosted-prod-verify.ts`; `compareCounts` at T0 only (`CUTOVER_FREEZE_PAIR=1`). Manual rows below remain for host walkthrough:
  - Row counts match the legacy inventory for every carried table, and `auth.users` / `auth.identities` counts match.
  - 0 `guest_submissions` with null `property_id`. Every status is in the canonical set. Status distribution matches expectations after `backfill_legacy_booking_statuses`.
  - Future bookings: same count and same date set as legacy. Each one shows on the property calendar (`get-booked-dates`) and blocks availability.
  - 0 remaining references to `zfttdwtceyqszyeyhilc` or the legacy origin in `public`.
  - Every storage URL/path referenced in the DB resolves to an existing object (script HEAD check). Per-bucket counts and bytes match.
  - Private buckets serve via signed URLs (`get-booking-asset-url`).
  - Admin walkthrough: bookings list, 10 sample bookings across statuses (documents visible, PDFs generate, receipts open), finance totals per month equal legacy, maintenance items, settings, templates.
  - Guest walkthrough: book a test stay on the rehearsal property, upload docs, run it through every status with sandbox email. Open a legacy SD-form link and pay-parking link through the redirect.
  - Sequences/identity columns are past the max id (`40-derived-rebuild.sql`).
  - Supabase advisors (security + performance) show no new criticals.

### Phase 6 — Integrations re-wire (prod)

- [ ] **6.1 Resend.** Prod API key on mt-prod. Sender domain verified in the account mt-prod uses. If that is a **different Resend account**, plan the domain move: add the domain to the new account and update DKIM/SPF at T-2d if both can coexist; otherwise do it inside the freeze window. Inbound: `inbound.kamehomes.space` MX → Resend inbound → `approval-email-webhook` on mt-prod. Event webhook for bounces → `email_suppressions`.
- [ ] **6.2 Google.** New prod OAuth client (origins `https://kamespace.com`, redirect `https://<mt-prod>.supabase.co/auth/v1/callback`). Maps key restricted to the new domains.
- [ ] **6.3 Telegram.** Bots unchanged. Legacy crons unscheduled at freeze (`sql/05-legacy-freeze.sql`) **before** mt-prod crons start. Verify no duplicate daily summary on day 1.
- [ ] **6.4 Meta, PayMongo, PostHog, Gemini/Groq, VAPID.** Follow existing prod checklists ([`pwa.md`](../../architecture/pwa.md) §9, `meta-messaging` skill, [`validation-and-env.md`](../../architecture/validation-and-env.md)). Vault secrets for pg_cron (`anon_key`, each `*_cron_secret`) per [`scheduled-jobs-and-testing.md`](../../archive/operations/scheduled-jobs-and-testing.md). **2026-11-01:** fwor edge secrets aligned with `supabase/.env.local` via `push-fwor-secrets-from-local.mjs` (`verify-fwor-secrets-from-local.mjs` all ok).
- [x] **6.5 Encryption keys.** ✅ **2026-11-02 — N/A.** The Gmail listener tables (`gmail_mail_integration`, `gmail_listener_state`) are dropped by the develop chain, so no legacy row needs `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`. Verified absent on `fwor`.
- [x] **6.6 Edge functions.** ✅ **2026-11-01** — CD Prod [41269033886](https://github.com/sprmke/kame-homes/actions/runs/41269033886) (gate + quality + deploy + smoke) green on `main` → fwor.

### Phase 7 — Code and repo

- [ ] **7.1** Merge every outstanding `main` hotfix into `develop` (should be none: `develop..main` = 0 today). Freeze `main` hotfixes from T-3d.
- [ ] **7.2** Tag `legacy-final` on `main` (and push) before fast-forwarding.
- [ ] **7.3** PR `develop → main` (fast-forward). CI green. Merge during the freeze, after the DB upgrade passes verify.
- [ ] **7.4** Disconnect `main` from the legacy Vercel project's Git integration **before** the merge, so pushing `main` doesn't build the new app on the old project with old env vars.
- [ ] **7.5** Enable `cd-prod.yml` (`CUTOVER_ENABLED=true`) after the first manual upgrade. Every later deploy uses strict order.

---

## 6. Existing and future bookings: continuity checklist

This is the "seamless transition" contract. Each item has an owner step above.

### 6.1 Links in emails already sent

Legacy emails point to `https://kamehomes.space/<path>`. After cutover the apex is attached to `kame-homes` (or a tiny redirect-only Vercel project) with `vercel.json` redirects that **inject the property slug**:

| Legacy URL                                                                                                                             | New URL                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/form?…`                                                                                                                              | `/properties/<slug>/form?…`                                          |
| `/calendar`                                                                                                                            | `/properties/<slug>/calendar`                                        |
| `/success?…`                                                                                                                           | `/properties/<slug>/success?…`                                       |
| `/sd-form?bookingId=X`                                                                                                                 | `/properties/<slug>/sd-form?bookingId=X`                             |
| `/bookings/:id/parking`                                                                                                                | `/properties/<slug>/parking/:id`                                     |
| `/bookings`, `/bookings/:id`, `/dashboard`, `/finance`, `/maintenance`, `/marketing`, `/operations`, `/settings`, `/staff`, `/sign-in` | `/org/<org>/property/<slug>/…` equivalents (admin; sign-in required) |
| `/`                                                                                                                                    | `https://kamespace.com/` (or the property listing)                   |

Because UUIDs are preserved (D1), `bookingId` values in old links resolve against mt-prod. Phase 5.2 is the long-term fallback once the apex redirect is removed. Storage links in old emails (`zftt…/storage/v1/object/public/...`) break when legacy is deleted. Guest PII buckets are private in the new app anyway, so only `templates`/`app-settings-assets` style public assets matter. Keep legacy Storage alive through hypercare (§9).

### 6.2 Future stays booked on legacy

- [ ] Freeze-time list of every future booking (id, guest, dates, status) exported to the host as a checklist.
- [ ] Each appears in mt-prod with the same status, dates, guest count, fees, balance, uploaded docs and approved PDFs.
- [ ] Calendar availability on the new public pages blocks those dates. Re-run the iCal export if the host syncs to Airbnb/other channels via iCal (update the feed URL in those channels to the mt-prod `ical-export` URL).
- [ ] Status-driven side effects that would fire later (GAF/pet approval, ready-for-check-in email, SD refund form, review request) work for migrated rows. R3 runs one migrated future booking end to end.
- [ ] Host's Google Calendar and Sheet stop updating at cutover. Host is told. If they still need a calendar, subscribe Google Calendar to the new `ical-export` feed.

### 6.3 In-flight bookings (status-specific)

| Legacy status at freeze                                                          | Risk                                                                                             | Handling                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PENDING_REVIEW`                                                                 | None                                                                                             | Host reviews in the new admin                                                                                                                                                                                                                                                                                                          |
| `PENDING_DOCUMENTS` / `PENDING_GAF` / `PENDING_PET_REQUEST` (awaiting PMO reply) | PMO replies to the **Gmail** Reply-To from legacy emails. The new app reads Resend inbound only. | Before freeze, list them. For each: after cutover, the host uploads the approved PDF in admin, **or** set a Gmail forwarding filter to the Resend inbound address for the hypercare window (confirm `approval-email-webhook` matches forwarded mail by booking reference; test in R3). New requests from mt-prod use the new Reply-To. |
| `PENDING_PARKING_REQUEST`                                                        | Same as above for parking endorsements                                                           | Same                                                                                                                                                                                                                                                                                                                                   |
| `READY_FOR_CHECKIN` / `READY_FOR_CHECKOUT`                                       | Guest arrives mid-cutover                                                                        | Avoid a freeze on a check-in day. Check-in info email already sent from legacy stays valid.                                                                                                                                                                                                                                            |
| `PENDING_SD_REFUND`                                                              | SD form link + refund cron                                                                       | Link via §6.1. Cron guarded so no duplicate reminders (§5.6).                                                                                                                                                                                                                                                                          |
| `COMPLETED` / `CANCELLED`                                                        | Review-request blast                                                                             | Watermark guard (§5.6)                                                                                                                                                                                                                                                                                                                 |

### 6.4 Bookings made during the freeze

Guest intake shows the maintenance page, so none should exist. Verify after the final dump: `max(created_at)` on legacy equals the value in the dump. If any slipped in, re-run the delta for those ids only (manual SQL, documented).

---

## 7. Data-handling rules (PII)

- Dumps and manifests live only in gitignored `backups/migration/`, on the operator machine, encrypted disk. Delete after hypercare sign-off (§9). Record deletion in the runbook.
- Never paste dumps, rows or object contents into chat, issues or logs. Scripts print counts only.
- Rehearsal projects are deleted after cutover. R1/R2 local volumes are wiped with `bun run stop:supabase` + volume removal.
- Do not scrub PII in rehearsals (`scrub-prod-pii-after-restore.sql`), because counts and links must match. Instead **neutralize all outbound channels** (§Phase 4 table).

---

## 8. Cutover runbook (timeline)

All prod writes need **`kamewave`** from the user in the same message.

**T-14d**

- R3 dress rehearsal passed twice. Timings known. Host sign-off on R3 walkthrough.
- Pick the freeze window: no check-in or check-out, late night Manila.
- Notify the host's team. Guests with stays in the next 7 days get an optional heads-up email from legacy.

**T-2d**

- DNS TTLs to 300 s. Resend domain move started if coexistence is possible.
- `main` code freeze. mt-prod is empty except extensions. Vercel Production env set.

**T0 (freeze window)**

1. Legacy backup: `bun run backup:supabase:prod` (kamewave).
2. Enable the legacy maintenance page (5.3). Confirm no new `guest_submissions`.
3. `sql/05-legacy-freeze.sql` on legacy: unschedule legacy pg_cron jobs (Telegram, SD refund, finance). Note the Gmail listener state.
4. `migrate.sh dump` → `restore` → `upgrade` → `sql.run 30-rewrite-storage-urls` (`PSQLVAR_TARGET_HOST=fwor…`) → `sql.run 40-derived-rebuild` on the local rehearsal DB, then `pushLocalRehearsalToHosted.sh` (truncates + restores `public`/`auth`/`storage` on `fwor`, sets `migration_cutover_at`). Then `sql/20-shape-tenant-org.sql`, the Storage delta (`syncHostedStorageFromLegacy.ts`), and `verify`. **Stop and roll back on any failure.** See D8 for the fallback when the freeze dump shows no drift.
5. Deploy edge functions + secrets to mt-prod. Confirm Vault cron secrets, then **do not** activate the parked jobs until the go call (`sql/61-activate-all-crons.sql`).
6. Disconnect legacy Vercel Git → merge `develop → main` → `kame-homes` Production build.
7. Attach `kamespace.com` to Production (DNS already swung at T-2d). Host signs in with Google and runs the admin walkthrough on real data.
8. Move apex `kamehomes.space` + `www` to `kame-homes` with the legacy redirect rules. Point `inbound` MX at Resend inbound for mt-prod.
9. Smoke: one internal test booking end to end (then cancel it), one legacy SD link, one legacy pay-parking link, iCal export.
10. Go / no-go call. Go means the maintenance page is gone, since the apex now redirects.

**Rollback (any point before the go call)**

- Re-attach apex to the legacy Vercel project, remove the maintenance page, re-schedule legacy crons from the backup's cron metadata. Legacy DB was never written except the freeze SQL, so no data restore is needed.
- After go, rollback means new bookings exist only in mt-prod. Forward-fix is preferred. A reverse migration is out of scope; that is why §5.7 must pass before go.

---

## 9. Hypercare (T0 → T+30d)

- Daily for 7 days: check edge function errors and logs, cron runs (`cron.job_run_details`), Resend bounces, inbound approvals arriving, Telegram summaries (exactly one per slot), PostHog errors.
- Track every legacy-URL hit on the apex redirects (Vercel logs) to size how long redirects are needed.
- Keep legacy Supabase **paused but not deleted** (read-only reference, Storage fallback). Keep the legacy Vercel project with deployments disabled.
- Sign-off criteria to start decommission: 30 days clean, every pre-cutover future booking has checked out and settled (SD refunds closed), host approval.

---

## 10. Decommission and cleanup (after sign-off)

Ordered. Each step is reversible until the last one.

- [ ] **10.1** Final legacy backup (DB + Storage manifest) archived offline, encrypted, with a retention date set by the host's data policy. Then delete working dumps in `backups/migration/`.
- [ ] **10.2** Legacy Vercel `guest-form-management-app`: remove domains, delete project (`sprmkes-projects`). Remove `VITE_*` env vars that point at `zftt…`.
- [ ] **10.3** Legacy Supabase `zftt…`: pause → wait 14 days → delete. Remove `PROD_PROJECT_REF` / `LEGACY_PROD_PROJECT_REF` from GitHub env secrets and `.env*.local` files.
- [ ] **10.4** Credentials: revoke legacy Google service account, Calendar/Sheets access, Gmail OAuth client and app password. Old Google OAuth client, old Resend API keys, any legacy Telegram webhook config. Rotate any secret that existed in both stacks ([`secret-rotation.md`](../../archive/operations/secret-rotation.md)).
- [ ] **10.5** Gmail forwarding filter (6.3) removed once no legacy-pending approvals remain.
- [ ] **10.6** Repo cleanup: remove the legacy dual-track guard text and deny-list entries for `zftt…` once the project is gone (`prod-deploy-guard-lib.sh`, `ci-deploy-lib.sh`, `no-prod-deploy.mdc`, `CLAUDE.md` "Dual-track" paragraph, `deployment.md`). Archive `scripts/data/sync-prod-public-data-to-local.sh` or point it at mt-prod. Keep `legacy-final` tag forever.
- [ ] **10.7** Domain: keep apex + redirects for at least 12 months (D4). Remove `LegacyGuestPathRedirect` only after redirect hits fall to zero for 90 days. **Never** let `kamehomes.space` lapse. Old links in guest inboxes stay valid only while it resolves.
- [ ] **10.8** Delete the rehearsal Supabase project and any temporary Vercel preview env pointing at it.
- [ ] **10.9** Ship: move this plan to `docs/archive/todos/shipped/`, update docs (§11).

---

## 11. Risks

| Risk                                                                     | Likelihood                       | Impact                                | Mitigation                                                                  |
| ------------------------------------------------------------------------ | -------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| A `develop` migration fails on real legacy data or on out-of-order apply | High (never exercised with data) | Blocks cutover                        | R1/R2 local loops; fix with new guard migrations (2.4); fallback ETL (D1)   |
| Backfill chose the wrong owner (`ORDER BY created_at` fallback)          | Low                              | Wrong org owner                       | 3.2 verify; shaping script asserts owner email                              |
| Cron blasts historic guests on first run                                 | Medium                           | Guest-facing spam, reputation         | 5.6 watermark guards, proven in R3 with crons on                            |
| Duplicate Telegram/email from both stacks                                | Medium                           | Confusing to host and guests          | Legacy crons unscheduled at step T0.3, before mt-prod functions get secrets |
| Legacy email links dead-end                                              | High without 5.1/5.2             | Guests can't do SD form / pay parking | Apex redirects + booking-id resolution                                      |
| PMO approvals lost in Gmail                                              | Medium                           | Booking stuck in `PENDING_DOCUMENTS`  | 6.3 list + manual upload or forwarding                                      |
| Resend domain can't be verified in two accounts                          | Medium                           | Email outage during move              | Decide in Phase 0; move inside freeze if needed                             |
| Storage copy incomplete                                                  | Low                              | Missing IDs/receipts                  | Manifest + count/bytes + per-URL HEAD check                                 |
| Slug rename breaks stored admin links                                    | Low                              | Broken bookmarks                      | Rename in shaping before go-live; search stored URLs                        |
| PII leak via dumps                                                       | Low                              | Severe                                | §7 rules                                                                    |

---

## 12. Open questions (answer in Phase 0)

1. **Org brand and slug.** "Kame Homes" / `kame-homes`, or keep the backfill's `kame-home`? (Slug is in every admin URL.) **Owner-confirmed 2026-10-25: shape as "Kame Homes" / `kame-homes` NOW (this supersedes the rebrand plan's Q1 note; the Kame Space rename happens after cutover in [`kamespace-03-rebrand-kame-homes-to-kame-space.md`](./kamespace-03-rebrand-kame-homes-to-kame-space.md)), which owns the tenant rename then.**
2. **Final domain (rebrand R2).** **Owner-confirmed 2026-10-25: prod = `https://kamespace.com` (apex), dev env = `dev.kamespace.com`.** OAuth/Resend/Meta origins get set up once for these. Legacy apex `kamehomes.space` + `www` keep redirecting into `kamespace.com` per D4. TODO: register/verify `kamespace.com` DNS at T-2d (registry/DNS provider TBD) and verify the domain is available before cutover — **if it is not, fall back to `app.kamehomes.space` and revisit**.
3. **Accounts / mt-prod project.** **Owner decision 2026-10-27: REUSE the existing mt-dev Supabase project `fworvijbrwpyngycotbz` as production** (rename "Kame Homes - Dev" to a prod name in the dashboard) to avoid the extra project cost while there are no paying users; a separate dev project gets added later once the app has stable users/income. Consequences: `fwor`'s current dev data is wiped and restored from the legacy dump (backup kept per §10 retention), and `develop`-branch migrations now target live prod data — schema changes need freeze discipline at cutover. Resend/Google/PostHog remain per §7 at cutover.
4. **Property list.** Is Monaco 2604 the only unit with legacy bookings, or did legacy serve several units? If several, which booking field identifies the unit?
5. **Repo.** Stay on `sprmke/kame-homes` (recommended default; transfer to a `kame-works` GitHub org only if the owner asks later).
6. **Plan for the Kame Homes org.** Owner-confirmed 2026-10-25: comped `managed`/internal plan (via `org_subscriptions`; no plan-gate friction in prod).
7. **Parking vertical.** **Owner: TODO — revisit after cutover.** Parking stays a booking add-on for Azure North in the cutover itself (no new vertical affected); the question of a dedicated parking entity for the new model is tracked as a follow-up todos item below.
8. **Dev config (D6).** **Owner-confirmed 2026-10-25: carry curated dev config to prod** (property settings, templates, public pages, stay guide, media, pricing calendar) via allow-list export keyed by slug — the recommended option (rebuild-by-hand loses the polished public-page work and risks drift).
9. **Freeze tolerance.** **Explained 2026-10-25, awaiting host confirmation**: the "freeze" is a short maintenance window during which guest booking intake on LEGACY is paused so the final data dump captures a complete consistent copy — guests hitting the form see a "Back shortly" page; admin stays readable. **Proposed: 2–4 h, late night Manila (e.g. 02:00–04:00), on a day with no check-in or check-out** (see the future-booking list; 8 bookings, none conflict on such a night). Confirm or propose a window preference.
10. **Legacy data retention.** **Owner-confirmed 2026-10-25: 30 days** offline (encrypted) backup retention after cutover sign-off; deletion recorded in the runbook.

---

## 12b. Revisit todos (owner-requested, do NOT apply during cutover)

| Todo                                                                                                                                                                             | When                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parking vertical** — decide whether Kame Homes needs a dedicated parking entity in the new model or parking stays a booking add-on for Azure North. Owner said: defer + track. | After cutover + hypercare; see also the Q7 answer in §12                                                                                           |
| **Kame Space rename** — tenant org name/slug, visible product strings, QR/asset filenames, socials                                                                               | After cutover verified on dev + prod, per [`kamespace-03-rebrand-kame-homes-to-kame-space.md`](./kamespace-03-rebrand-kame-homes-to-kame-space.md) |
| **Dev env origin** — `dev.kamespace.com` on the mt-dev project (`fwor`) + DNS                                                                                                    | Can land before or after cutover (independent)                                                                                                     |

---

## 13. Docs to update (same change as each phase)

- [`legacy-to-mt-prod-migration.md`](../../archive/operations/legacy-to-mt-prod-migration.md): becomes the operational runbook (commands, stage order, timings). Points here for rationale.
- [`scripts/migrate/legacy-to-mt-prod/README.md`](../../../scripts/migrate/legacy-to-mt-prod/README.md) and [`scripts/README.md`](../../../scripts/README.md): new scripts and `bun run` aliases.
- [`deployment.md`](../../architecture/deployment.md), [`ci-cd-environment-matrix.md`](../../archive/operations/ci-cd-environment-matrix.md), [`multi-tenant-dev-prod-setup.md`](../../archive/operations/multi-tenant-dev-prod-setup.md), [`multi-tenant-dev-prod-environments.md`](../in-progress/ci-cd-environments/multi-tenant-dev-prod-environments.md): mt-prod ref, Phase B ticked, dual-track ended.
- [`production-deployment.md`](../../archive/operations/production-deployment.md): apex cutover done, new prod deploy path.
- [`migration-runbook.md`](../../archive/operations/migration-runbook.md): one-time `--include-all` upgrade note, plus the new guard migrations.
- [`docs/architecture/overview.md`](../../architecture/overview.md) + [`docs/PROJECT.md`](../../PROJECT.md): env vars, legacy-link redirect behavior, `migration_cutover_at`.
- Route guides (`route-guides` skill): legacy redirect behavior on guest SD form / pay-parking / form guides.
- `CLAUDE.md`, `.cursor/rules/no-prod-deploy.mdc`, `.cursor/rules/README.md`: dual-track section rewritten after decommission. Keep the Claude and Cursor copies in sync.
- `activity-log`: one `org.migrated_from_legacy` event per org/property in the shaping script. Cron guard changes: `activity-log: N/A, read-side guard only`.
