---
title: 'Migration Runbook — New Booking Flow'
status: active
tags: [operations, migrations]
updated: 2026-08-02
---

# Migration Runbook — New Booking Flow

> **Production cutover (ordered backups → migrations → functions → secrets → Google → UI → cron):** see **[`docs/archive/operations/production-deployment.md`](./production-deployment.md)** for a single checklist with exact commands.
>
> **Legacy → multi-tenant prod data migration** (separate Supabase projects, Phase B release): see **[`legacy-to-mt-prod-migration.md`](./legacy-to-mt-prod-migration.md)** — not the same as schema migrations in this repo.
>
> Step-by-step apply + rollback instructions for the redesign in [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]].
> Every step is **additive and reversible** on Phase 0. Later phases (1–6) introduce behavior change and must be deployed in order.
>
> **⚠ Production safety.** The migration files in `supabase/migrations/` **do not run automatically**. They only execute when you:
>
> - run `supabase start` / `supabase db reset` (local Postgres on port **54322** only), **or**
> - explicitly run `supabase db push --linked` / `supabase db push --db-url <…>` (remote).
>
> **Never** run `supabase db push` against prod until §5 ("Applying to production") has been read end-to-end and a backup is confirmed. After migrations and function deploy, complete **§11** for Dashboard auth, Edge secrets, Google Cloud, UI env, and **`pg_cron`** scheduling.
>
> The UI `.env.development` may point at hosted Supabase — treat prod-linked URLs as sensitive. Phase 0 migrations are additive SQL only; full stack behavior also depends on shipped Edge Functions and UI (see [`docs/todos/`](../todos/README.md)).

---

## 1. What Phase 0 changes

Phase 0 is the **`20260501000000`–`20260501000010`** batch: **backup snapshot**, **nullable columns** on `guest_submissions`, **`processed_emails` + `gmail_listener_state`**, and **four storage buckets**. No application code deploy is required for these files alone — but **nothing in production should rely on new workflow columns until Edge/UI for later phases is deployed**.

### 1.0 How files run

`supabase start`, `supabase db reset`, and `supabase db push` apply **every** file under `supabase/migrations/` in **lexicographic order** by filename. Besides Phase 0, your repo includes **older** baseline migrations (`202402*`, `202502*`, …) and **newer** Phase 2+ migrations (`202604*`, `20260502*`, …). A greenfield local reset therefore installs **the whole chain**, not “Phase 0 only.”

### 1.1 Phase 0 batch (execute-ready)

| File                                                    | Purpose                                                                                                                                                                    | Rollback hint                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `20260501000000_backup_guest_submissions.sql`           | Historical Phase 0 snapshot; removed by `20261316121200_pre_production_security_hardening.sql` because `CREATE TABLE AS` did not inherit RLS.                              | Already removed by the hardening migration.                                                              |
| `20260501000002_add_workflow_columns.sql`               | Nullable pricing/parking/pet/SD arrays + `status_updated_at`, `settled_at`; partial index on `status_updated_at`.                                                          | Drop columns + index (see §6).                                                                           |
| `20260501000003_add_approved_pdf_columns.sql`           | Nullable `approved_gaf_pdf_url`, `approved_pet_pdf_url`.                                                                                                                   | `DROP COLUMN …`                                                                                          |
| `20260501000004_add_is_test_booking.sql`                | **`is_test_booking`** + partial index (historical). **Superseded** by `20260608120000_drop_is_test_booking.sql` on current branch — new installs add then drop the column. | N/A if drop migration applied; else `DROP COLUMN IF EXISTS is_test_booking` (+ index drops with column). |
| `20260501000005_create_processed_emails_table.sql`      | `processed_emails` for Gmail listener dedupe.                                                                                                                              | `DROP TABLE IF EXISTS processed_emails;`                                                                 |
| `20260501000006_create_parking_endorsements_bucket.sql` | Public bucket **`parking-endorsements`** (+ RLS policies).                                                                                                                 | Delete objects, then `DELETE FROM storage.buckets WHERE id = 'parking-endorsements';`                    |
| `20260501000007_create_approved_gafs_bucket.sql`        | Private buckets **`approved-gafs`**, **`approved-pet-forms`** (+ service_role policies).                                                                                   | Delete objects; remove bucket rows + policies.                                                           |
| `20260501000008_create_sd_refund_receipts_bucket.sql`   | Private bucket **`sd-refund-receipts`** (+ policies).                                                                                                                      | Same pattern.                                                                                            |
| `20260501000009_create_gmail_listener_state.sql`        | Table **`gmail_listener_state`** (`historyId` cursor).                                                                                                                     | `DROP TABLE IF EXISTS gmail_listener_state;`                                                             |
| `20260501000010_gaf_pet_request_pdf_urls.sql`           | Nullable **`gaf_request_pdf_url`**, **`pet_request_pdf_url`** (filled PDFs from admin transition; distinct from approved URLs).                                            | `DROP COLUMN IF EXISTS …`                                                                                |

### 1.2 Out of scope for Phase 0 (different files)

- **`status` widen + legacy backfill** → **`20260502000000_widen_status_enum.sql`** (Phase 2 in [[NEW_FLOW_PLAN|New Booking Flow — Implementation Plan]] §5).
- **Test-booking column removal** → **`20260608120000_drop_is_test_booking.sql`** (ships **after** `20260501000004` on a full migrate; safe `DROP COLUMN IF EXISTS`).
- **All other `202605*` / `202606*` migrations** (SD refund columns, `PENDING_DOCUMENTS`, vouchers, Gmail OAuth table, etc.) → **§1.3**.

### 1.3 Booking-flow migrations outside the Phase 0 batch

Supabase applies migrations in **filename sort order**. Among workflow redesign files:

1. **`20260428120000_add_pending_documents_parent_status.sql`** runs **before** `20260501000000_backup_guest_submissions.sql` (lexicographically: `20260428…` sorts before `20260501…`).
2. The **Phase 0 batch** (`20260501000000`–`20260501000010`) runs next — see **§1.1**.
3. Everything below runs **after** `20260501000010_*`:

| File                                                                      | Purpose (short)                                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20260502000000_widen_status_enum.sql`                                    | New workflow `status` literals + legacy row backfill                                                                                                                     |
| `20260503000000_add_sd_refund_details_status.sql`                         | Guest SD form columns + `READY_FOR_CHECKOUT`                                                                                                                             |
| `20260504000000_sd_settlement_line_items.sql`                             | JSONB line items + sync from numeric arrays                                                                                                                              |
| `20260530120000_guest_additional_fee.sql`                                 | `guest_additional_fee` column                                                                                                                                            |
| `20260531120000_fix_guest_submissions_status_check_pending_documents.sql` | Status CHECK allows `PENDING_DOCUMENTS`                                                                                                                                  |
| `20260527120000_finance_line_items.sql`                                   | `finance_line_items` operating expense/income table                                                                                                                      |
| `20260601120000_finance_line_items_recurrence.sql`                        | Recurrence columns (local / fresh reset order)                                                                                                                           |
| `20260601130000_gmail_mail_oauth_integration.sql`                         | `gmail_mail_integration` + OAuth state                                                                                                                                   |
| `20260708120000_finance_line_items_recurrence.sql`                        | Recurrence catch-up for hosted DBs that already applied `20260601120000` as Gmail                                                                                        |
| `20260710170000_app_settings_gaf_details.sql`                             | GAF PDF defaults (`app_settings` GAF columns)                                                                                                                            |
| `20260710180000_app_settings_gaf_signature.sql`                           | GAF unit-owner signature URL column                                                                                                                                      |
| `20260710190000_app_settings_gaf_guests_onsite_contact.sql`               | Rename GAF on-site contact column                                                                                                                                        |
| `20260602120000_document_substep_manual_incomplete.sql`                   | Manual incomplete flags / doc pipeline (dropped in `20261014120000`)                                                                                                     |
| `20261014120000_drop_document_manual_incomplete.sql`                      | Drops `gaf_manual_incomplete` / `pet_manual_incomplete`; strips JSONB `manualIncomplete`                                                                                 |
| `20260603120000_guest_balance_settlement.sql`                             | Guest balance settlement columns                                                                                                                                         |
| `20260604140000_parking_owner.sql`                                        | `parking_owner` display name                                                                                                                                             |
| `20260605120000_rename_status_to_ready_for_checkout.sql`                  | Rename intermediate status to `READY_FOR_CHECKOUT`                                                                                                                       |
| `20260606120000_next_stay_voucher.sql`                                    | Next-stay voucher columns                                                                                                                                                |
| `20260607120000_drop_sd_refund_cash_pickup_note.sql`                      | Drops legacy cash pickup note column                                                                                                                                     |
| `20260607130000_sd_refund_bank_gotyme.sql`                                | SD refund bank allow-list (GCash / GoTyme / Maribank)                                                                                                                    |
| `20260709120000_backfill_calendar_event_dates.sql`                        | Documents Google Calendar occupied-night window fix; run **`backfill-calendar-event-dates`** edge function after deploy                                                  |
| `20261306120000_property_settings_copy_log.sql`                           | Append-only **`property_settings_copy_log`** for org **Copy settings** runs (`copy-property-settings`); RLS on, service_role only                                        |
| `20261306120100_property_settings_copied_notification_type.sql`           | Adds **`property_settings_copied`** to notifications type check                                                                                                          |
| `20261316122340`–`20261316122352` voice migration guard/backfill files    | Preserve the existing platform switch + feature allowlist, copy missing property voice configs, then restore those global gates                                          |
| `20261316122400`–`20261316123410` voice hardening files                   | Session leases/RPCs, unverified transcript storage/deletion, start/health/reliability metrics, connected duration, reaper + canary cron, then legacy voice-table removal |

See also **§9** for SD bank allow-list rollback notes.

---

## 2. Pre-flight checklist (local first)

1. Confirm you are on the `guest-form-management` repo branch you intend to ship from.
2. Stop any running local Supabase: `bun run stop:supabase`.
3. (Optional) Wipe local DB to start clean: `supabase db reset` — this **only** affects the local container, never prod.
4. Inspect the new files:

   ```bash
   ls supabase/migrations/ | tail -n 20
   ```

5. Dry-read Phase 0 SQL (**§1.1**): no `DROP TABLE guest_submissions`, no raw `ALTER` on legacy `status` (that lives in **`20260502000000_widen_status_enum.sql`**).

---

## 3. Apply locally (safe)

```bash
# Starts local Postgres + Storage + edge runtime and applies ALL migrations.
supabase start
```

Verify:

```sql
-- Expected Phase 0 columns (nullable): booking_rate, down_payment, approved_*_pdf_url,
-- gaf_request_pdf_url, pet_request_pdf_url, status_updated_at, settled_at, …
\d guest_submissions
-- Historical unprotected snapshot must be absent:
SELECT to_regclass('public.guest_submissions_backup_20260501'); -- NULL
-- Expected new bucket rows:
SELECT id, public FROM storage.buckets WHERE id IN
  ('parking-endorsements','approved-gafs','approved-pet-forms','sd-refund-receipts');
-- Expected empty tracking tables:
SELECT * FROM processed_emails;
SELECT * FROM gmail_listener_state;
```

---

## 3.4 Expand / migrate / contract (production-readiness doc 19)

Every migration must stay backward compatible with the **currently deployed** SPA. Functions and UI deploy separately; a PWA tab can be one version behind.

| Change                     | Safe sequence                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Add NOT NULL column        | Add nullable → backfill → set NOT NULL in a later migration                                                                             |
| Rename column              | Add new → dual-read (then dual-write) → migrate readers → drop old after a release                                                      |
| Drop column                | Stop reading in code → wait one production release → drop                                                                               |
| New index on a large table | `CREATE INDEX CONCURRENTLY` on hosted (see Index deployment procedure). Local migrations may use `IF NOT EXISTS` without `CONCURRENTLY` |
| Destructive rewrite        | Forward-only note in the migration header; never pair with the client change that requires the new shape in the same release            |

Do not edit a shipped file under `supabase/migrations/`. Long-running DDL is flagged and scheduled (doc 14). Each new migration states a rollback path or `forward-only`.

---

## 3.5 Develop against **local** Supabase (env + optional prod data)

Use this when you want the UI and edge functions to hit **Docker Postgres on port 54322**, not the hosted project. [[migration-runbook|Migration Runbook — New Booking Flow]] §7.4 historically assumed `.env.development` pointed at prod — switch the vars below when testing migrations and copied prod rows locally.

### 3.5.1 Start the stack and read keys

```bash
# From repo root
supabase start
supabase status
```

Note:

- **API (REST + Auth):** `http://127.0.0.1:54321` (no trailing slash).
- **Edge Functions base URL:** `http://127.0.0.1:54321/functions/v1`.
- **anon key** and **service_role key** — copy from `supabase status` output.

Keep edge secrets in **`supabase/.env.local`** (see `supabase/.env.example`). `./dev.sh` runs **`supabase start`** only (functions run in that stack). If you use **`supabase functions serve`** separately, add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (see example file). Never commit real secrets.

### 3.5.2 `ui/.env.development` — point Vite at local

Set or replace these (see template in [`ui/.env.example`](../../ui/.env.example)):

| Variable                    | Local value                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `VITE_NODE_ENV`             | `development`                                                   |
| `VITE_SUPABASE_URL`         | `http://127.0.0.1:54321/functions/v1`                           |
| `VITE_API_URL`              | Same as `VITE_SUPABASE_URL`                                     |
| `VITE_SUPABASE_ANON_KEY`    | **anon** `eyJ…` from `supabase status`                          |
| `VITE_SUPABASE_PROJECT_URL` | Optional but clear: `http://127.0.0.1:54321`                    |
| `GOOGLE_CLIENT_ID`          | OAuth **Web** client ID (not `VITE_*`; not sent to the browser) |
| `GOOGLE_CLIENT_SECRET`      | Same client’s secret — used by local GoTrue only                |

**Admin Google sign-in (local):** `supabase/config.toml` enables `[auth.external.google]`. Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in this same file; `dev.sh` and `bun run start:supabase` run [`scripts/dev/run-with-ui-dev-env.sh`](../../scripts/dev/run-with-ui-dev-env.sh) so those vars are in the environment when the CLI starts Docker. In Google Cloud, add redirect URIs `http://127.0.0.1:54321/auth/v1/callback` and `http://localhost:54321/auth/v1/callback` (hosted projects still use the dashboard + `https://<ref>.supabase.co/auth/v1/callback`).

Restart after changing env files (`supabase stop` / `start` if you changed `GOOGLE_*`).

### 3.5.3 Copy **production Postgres data** into local (public schema)

Script: [`scripts/data/sync-prod-public-data-to-local.sh`](../../scripts/data/sync-prod-public-data-to-local.sh).

1. In the Supabase dashboard: **Connect** → copy a URI that works from your machine. Direct `db.<ref>.supabase.co` is often **IPv6-only**; on IPv4 networks use the **Session pooler** string (host like `…pooler.supabase.com`). URL-encode special characters in the password.
2. Local DB must already reflect your branch migrations (`supabase start` or `supabase db reset`).
3. Run:

   ```bash
   export PROD_DB_URL='postgresql://postgres.<ref>:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres'
   bun run sync:prod-data
   ```

   Or add `PROD_DB_URL=…` to `supabase/.env.local` (see `supabase/.env.example`). After `db:reset`, re-apply a cached dump without prod access: **`bun run sync:prod-data:restore`** (`RESTORE_ONLY=1`, uses `supabase/.temp/prod_public_data.sql`).

This dumps **`public` data only** into `supabase/.temp/` (gitignored). It does **not** copy Storage objects — file URLs in rows may still point at production buckets.

The script **drops `guest_submissions` CHECK constraints** that prod data may violate (`guest_submissions_status_check`, `valid_dates`, `valid_times`), loads the dump, then runs [`scripts/data/sql/after-prod-data-restore.sql`](../../scripts/data/sql/after-prod-data-restore.sql): legacy `booked`/`canceled` → new status enum, then re-adds the status CHECK. `valid_dates` / `valid_times` are re-added **`NOT VALID`** so historical bad rows (e.g. check-out before check-in) still load; new/updated rows must pass. After migration `20260623120000_normalize_time_columns_to_24h`, `valid_times` expects **24-hour `HH:MM`** (e.g. `14:00`), not AM/PM — see `20260625130000_valid_times_24h_constraint.sql`.

Treat the dump as **PII**; delete it when finished.

### 3.5.4 End-to-end local dev (typical order)

1. **`bun run start:supabase`** or **`./dev.sh`** (loads `ui/.env.development` for `GOOGLE_*` and runs **`bunx supabase@latest start`**). Avoid a global `supabase start` if your installed CLI is old (see `storage.buckets` row). For a clean DB only: `bun run db:reset`.
2. Update `ui/.env.development` and `supabase/.env.local` as above.
3. Optional: `bun run sync:prod-data` (or `sync:prod-data:restore` after a prior dump).
4. From repo root: `./dev.sh` **or** `./scripts/dev/run-with-ui-dev-env.sh supabase start` then `cd ui && bun run dev`. Avoid running **`supabase functions serve`** at the same time as `supabase start` (duplicate edge-runtime container / name conflict). If you use `functions serve` alone for hot reload, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `supabase/.env.local` (see `supabase/.env.example`).

### 3.5.5 Troubleshooting `supabase start` (local Postgres unhealthy)

| Symptom                                                                                                          | What to try                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `could not open configuration directory "/etc/postgresql-custom/conf.d"` + `postgresql.conf contains errors`     | Stale Docker volumes vs newer images. From repo root: `supabase stop`, then `docker rm -f supabase_db_guest-form-management` (if present), then `docker volume rm supabase_db_guest-form-management supabase_config_guest-form-management`, then `supabase start` again. **This wipes local DB data.**                                                                                                                                         |
| `failed to resolve reference "…/storage-api:buckets-objects-grants-postgres"`                                    | `supabase/.temp/storage-version` has an invalid tag (sometimes after `supabase link`). Replace with a real image tag (see CLI warning when you run `supabase start`, e.g. `v1.54.0`) or delete the file and re-link.                                                                                                                                                                                                                           |
| `must be owner of table objects` on `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`                      | RLS is already enabled on `storage.objects`; remove that `ALTER` from any migration (see [supabase/cli#4114](https://github.com/supabase/cli/issues/4114)). This repo’s storage migrations follow that rule.                                                                                                                                                                                                                                   |
| `relation "guest_submissions" does not exist` mid-migrate                                                        | Migration filename order: status DDL must run **after** `create_guest_submissions_table`. This repo uses `20250213043909_add_booking_status.sql` for the real `ALTER`; `20250113000000_add_booking_status.sql` is a no-op for legacy history.                                                                                                                                                                                                  |
| `relation "storage.objects" does not exist` on `20240213_storage_policies.sql`                                   | User migrations can run before Storage creates `storage.objects`. That migration is a no-op; policies are in `20250213045323_create_storage_buckets.sql`.                                                                                                                                                                                                                                                                                      |
| `relation "storage.buckets" does not exist` on `20250213045323_*` or later bucket migrations                     | **Old global Supabase CLI** (e.g. v2.40.x) with **Postgres 17** runs user migrations before the platform creates `storage.buckets`. Use **`bun run start:supabase`** / **`./dev.sh`** (`bunx supabase@latest`) or `brew upgrade supabase`. Avoid raw `supabase start` if `supabase -v` is far below **~2.80**.                                                                                                                                 |
| `pg_dump` / sync script: `Connection refused` or DNS `Errno 8` for `db.*.supabase.co`                            | Direct DB host is often **IPv6-only**; macOS/Python DNS may differ from `dig`. The sync script resolves via **socket then `dig` fallback**, then adds `hostaddr` (IPv4 or IPv6). **Best:** use the **Session pooler** URI from Connect (IPv4-friendly). Single-line `PROD_DB_URL`; URL-encode special characters in the password.                                                                                                              |
| `pg_dump`: `tenant/user postgres.<ref> not found` on `*.pooler.supabase.com`                                     | Pooler reached the server but **host or username does not match your project**. In Dashboard → **Connect**, choose **Session** (not Transaction), copy the full URI (host may be `aws-1-…` not `aws-0-…`; port **5432** not **6543**). Username must be `postgres.<reference-id>` from **Project Settings → General**. Reset DB password on **Database → Settings** if needed; URL-encode special chars in `PROD_DB_URL`.                      |
| `duplicate key` on `gmail_mail_oauth_state_pkey` during restore                                                  | Re-run sync (script truncates `gmail_mail_oauth_state` before restore). Or `TRUNCATE gmail_mail_oauth_state;` then `bun run sync:prod-data:restore`. OAuth state rows are ephemeral CSRF tokens — safe to clear locally.                                                                                                                                                                                                                       |
| `supabase_storage_*` unhealthy; logs show `duplicate key value violates unique constraint "migrations_name_key"` | Storage’s **internal** migration ledger in Postgres is corrupt. If `supabase start` logs **`Starting database from backup...`**, a normal stop/start keeps restoring that state — run **`bun run stop:supabase:clean`** (`supabase stop --no-backup --yes`, deletes local data volumes), then **`bun run start:supabase`**. Alternative: `bun run db:reset` from a clean stop. **Wipes local Postgres** — re-run prod data sync if you use it. |
| Edge logs: `Database error: { message: "name resolution failed" }` on `get-booked-dates`                         | Usually `supabase functions serve` with an `--env-file` that omits `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, so `createClient` gets an empty host. Add both from `supabase status`, or use `./dev.sh` (functions run inside `supabase start` with auto-injected vars).                                                                                                                                                                     |
| `failed to create docker container` … `supabase_edge_runtime_…` already in use                                   | Don’t run `supabase start` and `supabase functions serve` together. `docker rm -f supabase_edge_runtime_<project-id>` then `supabase start` again; prefer `./dev.sh` which only starts the stack once.                                                                                                                                                                                                                                         |
| `failed to create docker container` … `supabase_storage_…` already in use                                        | Stale Storage container (crash or partial stop). `bun run stop:supabase`, then `docker rm -f supabase_storage_guest-form-management` (replace suffix with your `project_id` from `supabase/config.toml`), then `bun run start:supabase`. Repeat for any other orphaned `supabase_*_guest-form-management` name the error mentions.                                                                                                             |
| `db:reset` fails mid-chain: `relation "app_settings" does not exist` / `parkings` / team or social tables        | Some older migrations assumed tables already present from a live DB. Fresh resets use **existence guards** + catch-ups: `20260818120100_ensure_property_scoped_integration_credentials.sql`, `20260909120100_ensure_team_contact_fields.sql`, `20260910120100_ensure_web_guest_chat.sql`, `20260918120100_guest_submissions_parking_fk.sql`. Pull latest migrations and re-run `bun run db:reset`.                                             |

**CLI drift:** Root **`package.json`** uses **`bunx supabase@latest`** for `start` / `stop` / `status` / `db:reset` so Postgres 17 + Storage ordering stays correct even when `supabase -v` on your PATH is outdated. Upgrade the global CLI with Homebrew when you want `supabase` in the shell to match.

---

## 4. Staging / dev environment

Dedicated dev Supabase project (separate account) + Vercel Preview wiring:

**[`dev-staging-environment.md`](./dev-staging-environment.md)** — full step-by-step setup, env files, VS Code tasks, and daily workflows.

Quick bootstrap after creating the dev project:

1. `cp supabase/.env.dev.example supabase/.env.dev.local` — fill `DEV_PROJECT_REF`, keys, `PROD_PROJECT_REF` guard.
2. `bun run deploy:supabase:dev` — migrations + functions.
3. Configure Dashboard secrets + Auth (see runbook §2.5–2.7).
4. Vercel Preview env vars → dev Supabase (runbook §3).

---

## 5. Applying to production

Follow **[[production-deployment|Production deployment — checkout checklist]]** for the full production checklist (backups, CLI, secrets, Google, hosting, `pg_cron`). The steps below are the **database push** slice.

**Do not skip any step.**

1. Backup the DB: **Pro+** Dashboard → Database → Backups; **Free** → **`pg_dump`** (pooler URI from **Connect** — **§3.5.3** URI guidance) **and/or** **`bunx supabase@latest db dump --linked --data-only`**; keep dumps **off git** (**PII**). Or automated: `bun run backup:supabase:prod` (also runs automatically before `deploy:supabase`/`deploy:supabase:db` unless `--skip-backup`).
2. Confirm the linked project ref:

   ```bash
   supabase projects list
   supabase link --project-ref <prod-ref>   # only if not already linked
   ```

3. Show what will run:

   ```bash
   supabase db diff --linked --schema public
   ```

4. Apply:

   ```bash
   supabase db push
   ```

5. Re-run the verification queries from §3 against prod (Dashboard → SQL Editor).
6. Smoke-test **`/form`** submit/update and admin **`/bookings`** flows against staging/prod expectations (workflow emails and transitions ship with Edge Functions + migrations — regression testing advised).
7. **Production integrations:** deploy Edge Functions if needed, then set **Supabase Edge secrets**, **Authentication → Google**, **UI (Vercel) env**, **Google service account / Gmail OAuth**, and **`pg_cron`** per **§11** below.

### 5.1 `db push`: “Remote migration versions not found in local migrations directory”

The linked database’s **`supabase_migrations.schema_migrations`** lists a **version** with **no matching file** `supabase/migrations/<VERSION>_*.sql` in your repo.

1. Inspect: **`bunx supabase@latest migration list`** — note orphan **Remote** versions.
2. **Preferred:** Recover the SQL that actually ran remotely (branch, teammate, Dashboard SQL history) and add **`supabase/migrations/<VERSION>_short_name.sql`** with that DDL; **`db push`** again.
3. **If the history row is wrong** but live schema matches your committed migrations (**`supabase db diff --linked`**): **`bunx supabase@latest migration repair <VERSION> --status reverted`** then **`db push`**. **`repair`** only adjusts the history table — it **does not** roll back DDL; if that migration created objects your chain would recreate, you may hit **already exists**.
4. **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` warnings** from the CLI during push/dump: harmless if OAuth is configured in Dashboard for hosted projects.

After **`repair --status reverted`**, if **`db push`** says **found local migrations to insert before the last migration on remote** — run **`bunx supabase@latest db push --include-all`**, or **`migration repair <MISSING_VERSION> --status applied`** when live schema already matches that file (**`migration list`** to see gaps). Prefer eyeballing the SQL (**`IF NOT EXISTS`** migrations are safest to replay).

### 5.2 `db push`: duplicate key on `schema_migrations_pkey`

Two files under `supabase/migrations/` must **never** share the same version prefix (`YYYYMMDDHHMMSS`). If **`db push --include-all`** fails with **`Key (version)=(… ) already exists`**, check for duplicates:

```bash
ls supabase/migrations/*.sql | sed 's|.*/||' | cut -d_ -f1 | sort | uniq -d
```

Rename the **later-added** file to a new unused timestamp (e.g. `…_booking_ai_reviews.sql` → `20261011120001_booking_ai_reviews.sql`), then **`bun run deploy:supabase:dev`** again. On dev, confirm which name is recorded: `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '<VERSION>';`

### 5.3 Stuck migration advisory lock

`supabase db push` (and the underlying `migration up`) takes a Postgres **advisory lock** for the duration of the migration run so two concurrent pushes can't race. A migration that fails partway (a `set -e`-style abort, a network drop mid-push, or the CLI process being killed) can leave that lock held even though the CLI process is gone, and the next `db push` attempt then hangs or times out waiting for a lock nothing will ever release.

**Detect it:**

```sql
-- Run against the target project (DEV_DB_URL / PROD_DB_URL, session-mode connection)
SELECT pid, mode, granted, query, state, query_start
FROM pg_locks l
JOIN pg_stat_activity a USING (pid)
WHERE l.locktype = 'advisory';
```

A row with `granted = true` and no live migration actually running (check `query`/`state` — an idle or terminated backend still holding the lock) is the stuck case.

**Clear it:**

```sql
-- Only after confirming the session is genuinely dead / not an active push:
SELECT pg_terminate_backend(<pid>);
```

`pg_terminate_backend` drops the session, which releases every lock (including advisory locks) it held. Do not run this against a `pid` you are not sure is dead — killing a live migration mid-DDL can leave the schema in a partially-applied state, which is a separate, worse problem than the stuck lock itself. If unsure whether a migration is genuinely stuck vs. just slow, wait and re-check `query_start` age before terminating.

This is a role-agnostic Postgres mechanism, unrelated to the `statement_timeout`/`idle_in_transaction_session_timeout` role defaults set in `20261316121600_request_role_statement_timeouts.sql` (doc 15) — those apply to `anon`/`authenticated`/`service_role` (the PostgREST-facing roles), not to the migration/`postgres` role, which must be able to run long DDL.

---

## 6. Rollback

**Database recovery:** in-place data replay is disabled. Create and link a fresh Supabase replacement project, then run `bun run rollback:supabase:prod -- --fresh-target`. The script verifies that the target has zero `public` tables, requires the full linked project ref as confirmation, and restores schema plus data in one transaction. Production remains kamewave-gated. `bun run rollback:functions:prod -- <git-ref>` redeploys Edge Functions from an older commit via a throwaway `git worktree`. See `production-deployment.md` §12.

This section reverses **only** the Phase 0 batch artifacts from **§1.1** (backup snapshot table, Phase 0 columns, buckets, `processed_emails`, `gmail_listener_state`). It does **not** undo **`status` enum widening**, SD refund columns, or other migrations listed in **§1.3** — for those, use a **dashboard backup restore** or author inverse migrations.

`DROP COLUMN IF EXISTS is_test_booking` is a no-op if **`20260608120000_drop_is_test_booking.sql`** already ran.

Rollback order (opposite of apply) for Phase 0 schema:

```sql
-- Run each as its own statement, only the ones you actually applied.
DROP INDEX IF EXISTS idx_guest_submissions_status_updated_at;
DROP TABLE IF EXISTS gmail_listener_state;
DELETE FROM storage.buckets WHERE id IN
  ('parking-endorsements','approved-gafs','approved-pet-forms','sd-refund-receipts');
DROP TABLE IF EXISTS processed_emails;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS is_test_booking;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS pet_request_pdf_url;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS gaf_request_pdf_url;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS approved_pet_pdf_url;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS approved_gaf_pdf_url;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS settled_at;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS status_updated_at;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS sd_refund_receipt_url;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS sd_refund_amount;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS sd_additional_profits;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS sd_additional_expenses;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS pet_fee;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS parking_owner_email;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS parking_endorsement_url;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS parking_rate_paid;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS parking_rate_guest;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS security_deposit;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS balance;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS down_payment;
ALTER TABLE guest_submissions DROP COLUMN IF EXISTS booking_rate;
DROP TABLE IF EXISTS guest_submissions_backup_20260501;
```

The legacy snapshot table is removed by `20261316121200_pre_production_security_hardening.sql` because `CREATE TABLE AS` left its guest PII outside RLS. Use the encrypted/platform backup and fresh-project restore path instead.

---

## 7. ✅ Phase 1 — Admin auth + read-only `/bookings` (shipped)

Phase 1 is **client-only** — no DB migration, no Edge Function change. It adds:

- `@supabase/supabase-js` + `@tanstack/react-query` to `ui/package.json`.
- Shared client at `ui/src/lib/supabase/client.ts`.
- Admin feature folder at `ui/src/features/dashboard/bookings/` (pages, components, hooks, lib).
- New UI routes: `/sign-in` (Google OAuth) and `/bookings` (read-only list, guarded by `RequireAdmin`).

### 7.1 One-time Supabase configuration (required for sign-in to work)

**You must do this in the Supabase dashboard before `/sign-in` works.** The code is ready; the provider is not.

1. Create a Google OAuth **Web** client in Google Cloud Console (Authentication → Credentials → "Create Credentials" → OAuth Client ID → Web application).
   - **Authorized JavaScript origins:** your local URL (e.g. `http://localhost:5173`) and your production URL (e.g. the Vercel domain).
   - **Authorized redirect URIs:** `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback` (get the exact value from the Supabase dashboard).
2. In the Supabase dashboard → **Authentication → Providers → Google** → enable, paste the client ID + client secret, save.
3. Under **Authentication → URL Configuration**: set **Site URL** to your primary app URL (production), and add **Additional Redirect URLs** for `http://localhost:5173` / any preview domains.

You do **not** need to change any Supabase _database_ setting for Phase 1.

### 7.2 Env vars

Host dashboard access uses Google sign-in + org/team RBAC — **no** `VITE_ADMIN_ALLOWED_EMAILS`.

Optional UI override:

- `VITE_SUPABASE_PROJECT_URL` — optional override. Unset, the client derives the project URL by stripping `/functions/v1` from `VITE_SUPABASE_URL`.

**Reference:** placeholder-only templates at [`ui/.env.example`](../../ui/.env.example) and [`supabase/.env.example`](../../supabase/.env.example).

### 7.3 Allow-list philosophy (important)

**`ADMIN_ALLOWED_EMAILS`** (edge) is enforced by **`verifyAdminJwt`** on legacy-style admin edge functions; org **owners** bypass without being on the list. **`SUPER_ADMIN_EMAILS`** stays edge-only; `list-organizations` returns the boolean capability used by the UI to gate `/admin/*`. There is no client allow list for host dashboard routes — **`RequireAdmin`** only checks for a signed-in session.

### 7.4 Verify locally

```bash
cd ui
npm install           # picks up new deps
bun run dev
```

1. Visit `http://localhost:5173/bookings` → should redirect to `/sign-in?redirect=%2Fbookings`.
2. Click **Continue with Google** → OAuth round-trip.
3. Signed in with an allow-listed email → lands on `/bookings`; sees rows from whichever project `VITE_SUPABASE_*` points at (prod by default, or local if you followed §3.5).
4. Signed in with a non-allowed email → generic "access restricted" message with a sign-out CTA (no disclosure of allow-listed addresses).
5. Hard-refresh `/bookings` while signed in → should load the table without bouncing to `/sign-in`.

### 7.5 Rollback

Phase 1 is pure UI / dependency change. Revert the commit(s) that added `ui/src/features/dashboard/bookings/`, `ui/src/lib/supabase/client.ts`, `ui/src/App.tsx` (QueryClientProvider wrap), and the `ui/src/routes/index.tsx` merge. The added env var and npm dependencies are safe to leave if you want to roll forward again later.

No DB or storage rollback is needed.

---

## 8. Phase 2–6 status (this repo)

| Phase | Scope                                            | Runbook / detail                                                                                                              |
| ----- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **2** | `status` widen + backfill                        | **`20260502000000_widen_status_enum.sql`** — see **[[NEW_FLOW_PLAN]] §5** and **§1.3** above.                                 |
| **3** | Admin edge functions + transition UI             | Shipped — verify **`supabase/config.toml`** + **[`docs/architecture/edge-functions.md`](../architecture/edge-functions.md)**. |
| **4** | `gmail-listener`, `sd-refund-cron`               | Shipped — **[[scheduled-jobs-and-testing]]**.                                                                                 |
| **5** | `submit-form` cleanup + no test-booking pipeline | Shipped — includes **`20260608120000_drop_is_test_booking.sql`**.                                                             |
| **6** | Calendar + Sheet backfill script                 | **Not shipped** as a dedicated migration yet — still planned in **[[NEW_FLOW_PLAN]] §5**.                                     |

Incremental schema after Phase 0 is enumerated in **§1.3** (filenames + purposes). **Production** Dashboard secrets, Google OAuth, Vercel `VITE_*`, and **`pg_cron`**: **§11**.

---

## 9. Additive: `sd_refund_bank` allow-list (June 2026)

| File                                       | Purpose                                                                                                                                                                                            | Reversible?                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `20260607130000_sd_refund_bank_gotyme.sql` | Sets **`sd_refund_bank`** to **NULL** where it was **`BDO`** or **`BPI`**, then replaces **`guest_submissions_sd_refund_bank_check`** with **`GCash` \| `GoTyme` \| `Maribank`** only (plus NULL). | Yes — reinstate the old `IN (...)` list only after fixing any disallowed rows. |

---

## 10. Additive: listing authorization backfill (August 2026)

Verification scope split — see [`docs/workflow/in-progress/verification-scope-split.md`](../../workflow/in-progress/verification-scope-split.md).

| File                                       | Purpose                                                                                                                                                                                                                                                                                                                                 | Reversible?                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `20261011120000_listing_authorization.sql` | Creates the private bucket **`listing-authorization-assets`** (5 MB; JPEG/PNG/WebP/PDF, service-role policy only), then backfills **`settings.listingAuthorization`** onto every `properties` and `parkings` row from the matching `organizations.settings.verification` leg (rights, contract end date, lifecycle, Tier 1 proof path). | Yes — the org verification block is **not** modified, so the backfilled key can be dropped. |

Notes:

- **Non-destructive by design.** Rows that already have a `listingAuthorization` **object** are skipped, and nothing is removed from `organizations.settings.verification`. Edge parsers fall back to the org leg via `resolveListingAuthorization` for any row the backfill skipped.
- The backfill helper `public.listing_authorization_from_org_leg(JSONB, TEXT)` is created and **dropped** within the same migration — it is not part of the schema afterwards.
- Verify after applying: bucket is `public = false` with only the service-role policy, and `SELECT count(*) FROM properties WHERE settings ? 'listingAuthorization'` matches the property count.

---

## 11a. Additive: Public Pages → Pro + Stay Guide config v2 (August 2026)

Stay Guide ↔ Showcase template-engine parity — see [`docs/workflow/done/stay-guide-showcase-templates.md`](../../workflow/done/stay-guide-showcase-templates.md).

| File                                           | Purpose                                                                                                                                                                                                                                                                               | Reversible?                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261210120000_public_pages_pro_tier.sql`     | `pricing_plans.features` — `customPages` + `publicPagesAutosave` flipped to `false` for `free` / `starter` / `commission`, `true` for `growth` (Pro) / `pro` (Business) / `managed`. (Route block later reverted — see `20261212120000`.)                                             | Yes — re-run the inverse `UPDATE`. No data loss; only a feature-flag flip.                                                                                     |
| `20261212120000_public_pages_explore_open.sql` | Restores `customPages: true` on Free/Starter/Commission so gallery + Page Editor stay explore-open; `publicPagesAutosave` remains Pro+.                                                                                                                                               | Yes — set `customPages` false again on those codes.                                                                                                            |
| `20261210120100_stay_guide_config_v2.sql`      | One-shot backfill of every `public_page_configs` row with `page_type = 'stay_guide'` from config **v1** (per-section `{visible}` + `chapters[]`) to **v2** (`palette`/`typography`/`motion` + flat `sections[]`). Chapter order + `accentColor` + all visibility flags are preserved. | Effectively — the runtime `normalizeStayGuideConfig` still upgrades any v1 row on read, so a stale row self-heals; there is no automatic v2→v1 down-migration. |

Notes:

- **Backfill is belt-and-suspenders.** `normalizeStayGuideConfig` (client + `_shared/publicPageConfigs.ts`) upgrades v1→v2 in memory on every read and on the next host PATCH, so a missed row is still rendered correctly.
- Verify after applying: `SELECT config->>'version' FROM public_page_configs WHERE page_type = 'stay_guide'` returns `2` for every row; spot-check that a row with reordered/hidden chapters kept its order, `accentColor`, and `visible` flags in the new `sections[]`.
- Verify the tier flip: `SELECT code, features->>'customPages', features->>'publicPagesAutosave' FROM pricing_plans ORDER BY code` — only `growth` / `pro` / `managed` are `true`.

---

## 11b. Additive: Airbnb / OTA calendar sync (Phase 1, December 2026)

Two-way iCal sync — see [`docs/workflow/done/airbnb-calendar-sync.md`](../../workflow/done/airbnb-calendar-sync.md). **All additive; no backfill, no data rewrite.**

| File                                                    | Purpose                                                                                                                                                                                                                                                                                                                                                 | Reversible?                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `20261213120000_calendar_sync_feeds.sql`                | New tables **`property_calendar_feeds`** (inbound `.ics` feeds; `ics_url_encrypted`) + **`property_calendar_export`** (outbound token). RLS on, no policies, `GRANT ALL TO service_role`.                                                                                                                                                               | Yes — `DROP TABLE`. No other table touched.                                                                                              |
| `20261213120100_calendar_sync_blocked_dates_source.sql` | `property_blocked_dates` **ADD** `source` (`'manual'`\|`'ical_import'`, default `'manual'`) + `feed_id` / `external_uid` / `external_summary` / `last_seen_at` + unique partial index `(feed_id, external_uid)`. `unblock_property_blocked_dates` **DROP + recreate** with a 3rd `p_source_filter text DEFAULT 'manual'` arg (2-arg callers unchanged). | Yes — drop the columns/index; restore the 2-arg function. Existing rows default to `source='manual'`, so behavior is identical pre-feed. |
| `20261213120200_calendar_sync_events.sql`               | New audit table **`calendar_sync_events`** (`action` CHECK, FK SET NULL to blocked-date / booking).                                                                                                                                                                                                                                                     | Yes — `DROP TABLE`.                                                                                                                      |
| `20261213120300_calendar_sync_plan_feature.sql`         | `pricing_plans.features` — `calendarSync: false` on `free`/`starter`/`commission`, `true` on `growth`/`pro`/`managed`/`business_plus`.                                                                                                                                                                                                                  | Yes — re-run inverse `UPDATE`; feature-flag flip only.                                                                                   |
| `20261213120400_calendar_sync_notification_types.sql`   | `notifications_type_check` **DROP + re-add** with `calendar_sync_failing` + `calendar_conflict` alongside the existing types.                                                                                                                                                                                                                           | Yes — re-add the prior CHECK (no rows use the new types until the feature runs).                                                         |
| `20261213120500_calendar_sync_cron.sql`                 | Self-invoking `public.sync_calendar_sync_cron_job()` (SECURITY DEFINER) → `pg_cron` job **`calendar-sync-every-30m`** (`*/30 * * * *`) POSTing `/functions/v1/calendar-sync-cron`. Safe no-op without Vault/`pg_cron` (`{ok:false}`).                                                                                                                   | Yes — `SELECT cron.unschedule('calendar-sync-every-30m'); DROP FUNCTION public.sync_calendar_sync_cron_job();`                           |

Notes:

- **Order matters:** `…120100` must precede any code path that reads `source`; `…120300`/`…120400` are independent flag/CHECK flips.
- Verify after applying: `SELECT code, features->>'calendarSync' FROM pricing_plans ORDER BY code` (only `growth`/`pro`/`managed`/`business_plus` are `true`); `\d property_blocked_dates` shows `source` with default `'manual'`; `SELECT cron.jobname FROM cron.job WHERE jobname = 'calendar-sync-every-30m'` after Vault `project_url` + `anon_key` are set (re-run `SELECT public.sync_calendar_sync_cron_job();` if absent).
- Edge secrets to set for production (optional): `CALENDAR_SYNC_CRON_SECRET` (+ Vault `calendar_sync_cron_secret`), `CALENDAR_SYNC_MIN_INTERVAL_MINUTES`. `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` is reused for feed-URL encryption — already required.

### Phase 2 batch (December 2026) — reservation ingestion + guest-form completion link

| File                                                         | Purpose                                                                                                                                                                                                                                                                                                            | Reversible?                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `20261214120000_calendar_sync_external_bookings.sql`         | `guest_submissions` **ADD** `external_source` (CHECK airbnb/booking_com/vrbo/other), `external_uid`, `external_feed_id` (FK SET NULL), `external_raw` jsonb + unique partial index `(external_feed_id, external_uid)`. Rows created by `calendar-sync-cron` when `property_calendar_feeds.create_bookings = true`. | Yes — drop the columns/indexes; ordinary submissions never set them. |
| `20261214120100_calendar_sync_guest_form_token.sql`          | `guest_submissions` **ADD** `guest_form_token` (unique partial index), `guest_form_token_issued_at`, `guest_form_completed_at`. Backs `<origin>/form?complete=<token>`.                                                                                                                                            | Yes — drop the columns/index.                                        |
| `20261214120200_calendar_sync_phase2_notification_types.sql` | `notifications_type_check` **DROP + re-add** with `booking_external_imported` + `booking_guest_form_completed` alongside the Phase 1 set.                                                                                                                                                                          | Yes — re-add the prior CHECK.                                        |

Notes:

- `…120000` must precede any code that reads `external_source` (the `workflowOrchestrator` no-guest-side-effect guard keys on `guest_email` blank, so it is safe even before the column exists, but `calendarSyncRun` writes the columns).
- Verify: `\d guest_submissions` shows the 7 new columns; `SELECT conname FROM pg_constraint WHERE conname = 'notifications_type_check'` then check the definition includes the 12 types.
- No new edge secrets. The completion link reuses `publicGuestAppOrigin` resolution; the token endpoints are `verify_jwt = false` (`config.toml`).

## 11c. Additive: Org Activity & Audit Log (Phase 0 + Phase 1 + Phase 3 net, September 2026)

One append-only `activity_log` table + two narrow triggers. Plan + emitter ledger: [`docs/workflow/in-progress/org-activity-audit-log.md`](../../workflow/in-progress/org-activity-audit-log.md). **All additive; no backfill, no data rewrite.**

| File                                                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Reversible?                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261306150000_activity_log.sql`                           | New table **`activity_log`** (append-only; `PRIMARY KEY (id, created_at)`; only FK is `actor_user_id → auth.users ON DELETE SET NULL`; CHECK constraints on `scope` / `actor_type` / `severity` / `source` + a scope/target coherence check + generous payload-size checks). 8 indexes (feed keyset, partial property/parking/destructive, category, actor, target, BRIN). RLS **enabled, no policies**, `GRANT ALL TO service_role` — no RLS read path. `BEFORE UPDATE OR DELETE` trigger `activity_log_block_mutation()` rejects mutation (service role included); DELETE only under `SET activity_log.allow_purge = 'on'`.                                                                                             | Yes — `DROP TABLE public.activity_log CASCADE; DROP FUNCTION public.activity_log_block_mutation();`. No other table touched.                                                                                                                                                |
| `20261306150100_activity_log_guest_submissions_trigger.sql` | `AFTER INSERT OR UPDATE OR DELETE ON guest_submissions` trigger `trg_activity_log_guest_submissions` — `WHEN` the JWT role is `authenticated`/`anon` (service-role writes skipped). SECURITY DEFINER function resolves the org via `property_id` / `parking_id` / `parking_request_organization_id`, emits `booking.created` / `booking.details_edited` / `booking.deleted` with an allow-listed **changed-column-name** diff (`status` + workflow columns excluded; no from/to values stored). Whole body wrapped in `EXCEPTION WHEN others` → `RAISE WARNING` + return, so an audit hiccup never rolls back a booking write.                                                                                            | Yes — `DROP TRIGGER trg_activity_log_guest_submissions ON public.guest_submissions; DROP FUNCTION public.activity_log_guest_submissions();`.                                                                                                                                |
| `20261306150200_activity_log_delete_net_trigger.sql`        | Belt-and-braces `AFTER DELETE` net: `trg_activity_log_delete_net_{org,property,parking}` on `organizations` / `properties` / `parkings`, same `WHEN` JWT-role guard (service-role cascade deletes skipped — those go through `delete-organization` / `delete-property` / `delete-parking` which self-log). SECURITY DEFINER `activity_log_delete_net()` writes one low-fidelity `db_trigger` `*.deleted` row (`severity destructive`, `metadata.via = db_trigger_net`) only for a direct end-user PostgREST delete, which should never happen. Child tables (`*_members`, `finance_*`, …) intentionally **not** covered — avoids fan-out on cascade. Whole body `EXCEPTION WHEN others` → `RAISE WARNING` + `RETURN OLD`. | Yes — `DROP TRIGGER trg_activity_log_delete_net_org ON public.organizations; DROP TRIGGER trg_activity_log_delete_net_property ON public.properties; DROP TRIGGER trg_activity_log_delete_net_parking ON public.parkings; DROP FUNCTION public.activity_log_delete_net();`. |

Notes:

- **Order matters:** `…150000` must run before `…150100` and `…150200` (both triggers insert into `activity_log`). All must run before deploying the edge-function bundle that imports `_shared/activityLog.ts`.
- **Timestamp note:** filenames follow the repo's synthetic future-dated sequence and sit **after** the latest existing migration (`20261306140000_host_verification_reward.sql`) — not the `20261305130200` slot the plan doc originally suggested (that would sort before already-applied migrations).
- Verify after applying: `\d public.activity_log` shows the composite PK + 8 indexes + `rowsecurity = t` with `SELECT count(*) FROM pg_policies WHERE tablename = 'activity_log'` returning `0`; `UPDATE public.activity_log SET summary = 'x'` raises `activity_log is append-only`; a `SET request.jwt.claims` to `role = service_role` then an `UPDATE guest_submissions` writes **no** `activity_log` row, while `role = authenticated` on an allow-listed column change writes one.
- No new edge secrets. `list-activity-log` is `verify_jwt = false` (`config.toml`), gated by `verifyOrgAccess` in the handler.

### 11c.1 Phase 5 + 6 follow-up (September 2026) — realtime + retention + plan gate

| File                                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                            | Reversible?                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261315120000_activity_log_realtime_broadcast.sql` | `AFTER INSERT` trigger `activity_log_broadcast()` → `realtime.send({ids + scope + category + severity}, 'activity', 'activity:org:<org>', private)`. Guarded by `to_regprocedure` + `EXCEPTION WHEN OTHERS` so it can never fail/slow the INSERT. RLS policy `activity_log_broadcast_read` on `realtime.messages` + helper `user_can_read_activity_broadcast(topic)` (reuses `user_can_access_org_notifications`). **No row content on the wire.** | Yes — `DROP TRIGGER trg_activity_log_broadcast ON public.activity_log; DROP FUNCTION public.activity_log_broadcast(); DROP POLICY activity_log_broadcast_read ON realtime.messages; DROP FUNCTION public.user_can_read_activity_broadcast(text);`                       |
| `20261315120100_activity_log_plan_feature.sql`       | Seeds `pricing_plans.features` with `activityLogExport` — `false` on `free`, `true` on `starter` / `commission` / `growth` / `pro` / `managed` / `business_plus`. Gates the CSV export only (`activity-log-export` via `requireOrgFeature`); in-app viewing stays ungated.                                                                                                                                                                         | Yes — `UPDATE pricing_plans SET features = features - 'activityLogExport';` (or re-run with the previous values).                                                                                                                                                       |
| `20261315120200_activity_log_retention_cron.sql`     | Adds `platform_settings.activity_log_retention_months` (default 24, `CHECK >= 6`). `purge_activity_log(months, max_rows)` (SECURITY DEFINER — sets `activity_log.allow_purge`, batch-deletes past the window). `sync_activity_log_retention_cron_job()` monthly pg_cron (`0 18 1 * *` UTC) → `activity-log-retention-cron` edge fn. Self-invoking; safe no-op without pg_cron/Vault.                                                               | Yes — `SELECT cron.unschedule('activity-log-retention-monthly-manila'); DROP FUNCTION public.sync_activity_log_retention_cron_job(); DROP FUNCTION public.purge_activity_log(int,int); ALTER TABLE public.platform_settings DROP COLUMN activity_log_retention_months;` |

- New optional edge secret **`ACTIVITY_LOG_RETENTION_CRON_SECRET`** (+ Vault key `activity_log_retention_cron_secret`) — see `scheduled-jobs-and-testing.md` § 1. `activity-log-retention-cron` is `verify_jwt = false`.
- **Monthly range partitioning on `created_at`** stays a **roadmap** item — the `PRIMARY KEY (id, created_at)` in `…150000` was chosen so it needs no table rewrite. Migration path when volume warrants: `CREATE TABLE activity_log_part (LIKE public.activity_log INCLUDING ALL) PARTITION BY RANGE (created_at)` → pre-create month partitions → `INSERT … SELECT` (or `ATTACH` the existing table as the historical partition) → swap names in one transaction → recreate the three `activity_log` triggers (`_block_mutation`, `_broadcast`) on the partitioned parent. Do this in a maintenance window with a load test, not opportunistically. Until then BRIN + btree handle millions of rows, and `activity-log-retention-cron` bounds growth.

### 11d Marketing AI asset generation — Phase 1 (images), September 2026

Plan: [`../../workflow/done/marketing-ai-asset-generation.md`](../../workflow/done/marketing-ai-asset-generation.md)

| File                                                        | Purpose                                                                                                                                                                                                                                                                                                                                                              | Reversible?                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `20261316120000_marketing_generation_jobs.sql`              | `marketing_generation_jobs` — one row per AI image/video generation request with the output inline. `job_status` CHECK already includes `finalizing`, and the Veo columns (`provider_operation_name` with a unique partial index, `finalize_claim_token`) ship now so Phase 2 is additive. `duration_seconds` CHECK is `(6, 8)` — 4s is unpublishable to Meta Reels. | Yes — `DROP TABLE public.marketing_generation_jobs;`                                                                   |
| `20261316120100_marketing_generation_references.sql`        | `marketing_generation_references` — reusable per-property reference library (unique `storage_path`, `last_used_at` for the 90-day prune).                                                                                                                                                                                                                            | Yes — `DROP TABLE public.marketing_generation_references;` (then clear `marketing-ai-refs/` from `property-media`)     |
| `20261316120200_ai_platform_usage_events_feature_index.sql` | `idx_ai_platform_usage_events_org_feature_created` — supports the per-feature monthly credit sub-cap query.                                                                                                                                                                                                                                                          | Yes — `DROP INDEX public.idx_ai_platform_usage_events_org_feature_created;`                                            |
| `20261316120400_marketing_generation_plan_features.sql`     | Seeds `aiMarketingImageGeneration` (`false` on free/starter/commission, `true` on growth/pro/managed/business_plus) **and raises `aiMonthlyCreditAllowance`**: growth 1,000→5,000, pro 10,000→25,000, managed 30,000→60,000, business_plus 20,000→50,000.                                                                                                            | Yes — `UPDATE pricing_plans SET features = features - 'aiMarketingImageGeneration';` + re-set the previous allowances. |

- Both new tables are **service-role only** (RLS enabled, no policies), same as `booking_ai_reviews` — access control is in the edge functions.
- **No storage migration and no `config.toml` bucket change**: the feature reuses the existing public `property-media` bucket under two new prefixes.
- **No new edge secret in Phase 1.** Phase 2 (video) adds `MARKETING_GENERATION_CRON_SECRET` + the Vault key `marketing_generation_cron_secret` and a `sync_marketing_generation_cron_job()` post-deploy call.
- Verify after applying: `SELECT code, features->>'aiMarketingImageGeneration', features->>'aiMonthlyCreditAllowance' FROM pricing_plans ORDER BY sort_order;`

### 11e Marketing AI asset generation — Phase 2 (video), September 2026

| File                                                         | Purpose                                                                                                                                                                                                                       | Reversible?                                                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `20261316120300_marketing_generation_cron.sql`               | `sync_marketing_generation_cron_job()` — rebuilds a 1-minute `marketing-generation-sweeper-every-1m` pg_cron job calling `marketing-generation-sweeper`. Self-invoked at the bottom; safe no-op without pg_cron/pg_net/Vault. | Yes — `SELECT cron.unschedule('marketing-generation-sweeper-every-1m'); DROP FUNCTION public.sync_marketing_generation_cron_job();` |
| `20261316120500_marketing_generation_video_plan_feature.sql` | Seeds `aiMarketingVideoGeneration` (`false` on free/starter/commission/growth, `true` on pro/managed/business_plus).                                                                                                          | Yes — `UPDATE pricing_plans SET features = features - 'aiMarketingVideoGeneration';`                                                |

- **No storage or table migration.** Video output reuses `marketing_generation_jobs` / `property-media` columns and prefixes Phase 1 already created.
- **New optional edge secret `MARKETING_GENERATION_CRON_SECRET`** (+ Vault key `marketing_generation_cron_secret`) — see `scheduled-jobs-and-testing.md` §1.
- After a hosted deploy: `SELECT public.sync_marketing_generation_cron_job();` once to register the cron job, then confirm the Vault secret exists.
- Verify after applying: `SELECT code, features->>'aiMarketingVideoGeneration' FROM pricing_plans ORDER BY sort_order;`

### 11f Duplicate version repair (local CLI), September 2026

Five never-applied files shared a version prefix with an already-recorded migration, so `bun run db:migrate` stopped. SQL was **copied unchanged** to unique timestamps; the colliding filenames were removed. Applied files were not edited.

| New file                                                   | Original colliding version (already recorded name stayed) |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `20261316120700_azure_north_pool_defaults.sql`             | `20261231150000` (`org_role_listing_scope`)               |
| `20261316120800_restore_platform_host_settings.sql`        | `20261231152000` (`drop_org_import_permission`)           |
| `20261316120900_platform_host_settings_rls_fix.sql`        | `20261231140100` (`org_team_template_role_ids`)           |
| `20261316121000_guest_doc_storage_service_role_writes.sql` | `20261310120000` (`analytics_review_notification_type`)   |
| `20261316121100_dashboard_assistant_expire_cron.sql`       | `20261311120000` (`analytics_ai_review_cron`)             |

### 11g Pre-production security grants, September 2026

| File                                                   | Purpose                                                                                                                                                                                                                                  | Reversible?                                                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `20261316121200_pre_production_security_hardening.sql` | Drops `guest_submissions_backup_20260501`. Revokes PUBLIC/anon/authenticated execute on AI wallet + usage RPCs; `service_role` only.                                                                                                     | Yes — restore snapshot from backup if still needed; re-grant execute only if a trusted caller requires it.            |
| `20261316121300_contract_expiry_cron_schedule.sql`     | `sync_contract_expiry_cron_job()` + `contract-expiry-daily-manila` (`0 1 * * *` UTC). Fails closed without Vault secrets.                                                                                                                | Yes — `SELECT cron.unschedule('contract-expiry-daily-manila'); DROP FUNCTION public.sync_contract_expiry_cron_job();` |
| `20261316121400_revoke_public_rls_helper_execute.sql`  | Revokes PUBLIC/anon execute on `user_can_access_*` RLS helpers and `activity_log_delete_net`. Drops leftover two-arg `user_can_access_guest_submission(uuid, uuid)` if present. Grants execute to `authenticated` for policy evaluation. | Yes — re-grant execute to the roles that need it.                                                                     |

### 11h Index the database — FK + access-pattern audit (Phase 14.3, September 2026)

Plan: [`docs/workflow/planned/production-readiness-checklist/14-index-the-database.md`](../../workflow/planned/production-readiness-checklist/14-index-the-database.md).

| File                                               | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Reversible?                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `20261316121800_fk_and_access_pattern_indexes.sql` | 33 `CREATE INDEX IF NOT EXISTS` on foreign-key columns (and a couple of confirmed access-pattern gaps) across tables that grow with tenant activity — bookings/parking-broadcast, notifications, social inbox, support tickets, AI usage/assistant, payment transactions, import batches, marketing generation, calendar sync events, analytics/smart pricing, guest reviews, telegram notification logs. No table/column changes, indexes only. Uses plain (non-`CONCURRENTLY`) `CREATE INDEX` — see **Index deployment procedure** below before running this against hosted dev/prod. | Yes — `DROP INDEX IF EXISTS <name>;` for any index by name (all names are listed in the migration file itself). |

#### Index deployment procedure (`CONCURRENTLY` + Supabase migrations)

This repo has no prior migration that uses `CREATE INDEX CONCURRENTLY` (checked: grepped every file under `supabase/migrations/` for `CONCURRENTLY` and for any transaction-control override comment/statement — none exist). That matters because:

- `CREATE INDEX CONCURRENTLY` **cannot run inside a transaction block** (Postgres rejects it with `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`).
- The Supabase CLI (`supabase db push` / `db reset` / `migration up`) applies **each migration file inside its own transaction**, with no `config.toml` or CLI flag in this repo's setup to opt a single file out of that wrapping.

So a migration file that contains `CREATE INDEX CONCURRENTLY` **will fail to apply** via the normal `supabase db push` / `bun run deploy:supabase:*` path. There are two ways to add an index safely, and this repo now uses the first for anything landing via the automated pipeline:

**Option A — plain `CREATE INDEX IF NOT EXISTS` (what `20261316121800` uses).** Safe for small-to-medium tables (current hosted dev/prod data volume) because a plain `CREATE INDEX` takes a `SHARE` lock that blocks writes to the table for the duration of the build, which is short when the table is small. This is the default for any index migration in this repo **unless** the target table is known to already be large enough that a blocking lock is a real production risk.

**Option B — manual `CONCURRENTLY` run outside the migration pipeline**, required once a target table is large enough (tens of thousands+ rows, or a hot write path where even a brief lock is unacceptable) that a blocking `SHARE` lock is not acceptable in production:

1. Do **not** add `CREATE INDEX CONCURRENTLY` to a `supabase/migrations/*.sql` file — it will break `db push` for that transaction-wrapped file.
2. Instead, connect directly to the target database (Dashboard SQL Editor, or `psql` via the **Session pooler** URI — see §3.5.3 above for how to get one) and run the `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` statement **by itself**, outside any transaction wrapper. The Dashboard SQL Editor and a bare `psql` connection each run a single statement outside an implicit transaction by default — do not wrap it in `BEGIN`/`COMMIT`.
3. Schedule this for a **low-traffic window** — `CONCURRENTLY` avoids the blocking lock but still consumes I/O and CPU for the duration of the build (can be minutes on a large table), and a failed `CONCURRENTLY` build can leave behind an **invalid** index (`SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;` to check) that must be dropped and retried — never left in place.
4. After a manual `CONCURRENTLY` run, add a no-op-safe **matching migration file** with plain `CREATE INDEX IF NOT EXISTS` (same name, same definition) so the schema history stays consistent for anyone re-running `db reset` locally or bootstrapping a fresh environment — the `IF NOT EXISTS` guard makes it a no-op against the database where the index already exists, and a real (blocking, but small-table-safe) build on a fresh local/dev database.
5. Verify: `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = '<name>';` returns the row, and `SELECT indisvalid FROM pg_index WHERE indexrelid = '<name>'::regclass;` is `true`.

**When to promote `20261316121800`'s indexes from Option A to Option B:** if hosted dev/prod `guest_submissions`, `notifications`, `social_messages`, `ai_platform_usage_events`, or `activity_log` have grown large by the time this migration is deployed (check row counts first — `SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20;`), re-run those specific `CREATE INDEX` statements manually with `CONCURRENTLY` per Option B instead of relying on the migration's plain form, then let the migration's `IF NOT EXISTS` no-op past them on the next deploy.

---

## 11. Production configuration & secrets (Supabase, Google, hosting)

Use this **after** migrations (**§5**) and Edge Function deploys. Canonical env templates: **[`supabase/.env.example`](../../supabase/.env.example)** (Edge secrets — mirror into Dashboard) and **[`ui/.env.example`](../../ui/.env.example)** (Vite / SPA). Full narrative also lives in **[`docs/architecture/validation-and-env.md`](../architecture/validation-and-env.md)** and **[`docs/architecture/deployment.md`](../architecture/deployment.md)**.

### 11.1 Recommended order

1. Run **`supabase db push`** (or CI equivalent) — **§5**.
2. Deploy functions: e.g. **`supabase functions deploy`** (or your pipeline) so hosted code matches `supabase/config.toml` (`verify_jwt`, **`static_files`** for HTML templates / inline email assets such as **`email-assets/*.jpg`**).
3. **Supabase Dashboard → Project Settings → Edge Functions → Secrets** — set every secret in **§11.5** you need (hosted injects `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` automatically).
4. **Supabase Dashboard → Authentication** — Google provider + URL configuration — **§11.2**.
5. **Google Cloud** — OAuth clients (**§11.3**) and service account (**§11.4**).
6. **UI host (e.g. Vercel)** — production **`VITE_*`** vars — **§11.6**.
7. **Database → Extensions / SQL** — enable **`pg_cron`** + **`pg_net`**, store Vault secrets, schedule **`gmail-listener`** and **`sd-refund-cron`** — **§11.8** (detail: **[[scheduled-jobs-and-testing|Scheduled jobs (cron) and how to test them]]**).

### 11.2 Supabase Dashboard — Authentication (Google sign-in for `/sign-in`)

Hosted projects **do not** read `supabase/config.toml` `[auth.external.google]` from your laptop — configure in the **Dashboard**.

1. Google Cloud Console → **APIs & Services → Credentials** → **OAuth 2.0 Client IDs** → **Web application** (see **§11.3 Client A**).
2. Supabase → **Authentication → Providers → Google** → enable; paste **Client ID** and **Client secret**.
3. **Authentication → URL Configuration**:
   - **Site URL:** primary production SPA origin (e.g. `https://kamehomes.space`).
   - **Additional Redirect URLs:** every origin that must complete OAuth (`http://localhost:5173`, preview URLs, `www` vs apex, etc.).
4. Google Cloud → **Authorized redirect URIs** must include **`https://<project-ref>.supabase.co/auth/v1/callback`** (exact string from Supabase **Authentication → Providers** helper text).

### 11.3 Google Cloud — two OAuth “Web” clients (do not confuse them)

| Client                | Purpose                                                              | Redirect URI(s)                                                             | Where the secret lives                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — Supabase Auth** | Admin (and any) **Google sign-in** via Supabase GoTrue               | `https://<project-ref>.supabase.co/auth/v1/callback`                        | Supabase Dashboard → Auth → Google provider                                                                                                                              |
| **B — Gmail API**     | **`gmail-listener`** + optional **Connect Gmail** on **`/settings`** | `https://<project-ref>.supabase.co/functions/v1/google-mail-oauth-callback` | Edge secret **`GMAIL_API_WEB_CLIENT_JSON`** (+ encryption key); **or** legacy **`GMAIL_OAUTH_CLIENT_JSON`** / **`GMAIL_OAUTH_TOKEN_JSON`** from **`bun run gmail-auth`** |

Use **separate** OAuth clients for A vs B so redirect URIs and rotation policies stay clear.

For **Client B**, add **Authorized JavaScript origins** matching your production SPA origin(s) (used during OAuth start). Set **`GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS`** (Edge secret) to the same origins (comma-separated).

### 11.4 Google Cloud — Service account (Calendar + Sheets)

1. Create a **service account**; enable **Google Calendar API** and **Google Sheets API** on the GCP project.
2. Create a JSON key; stringify as **one line** for Edge secret **`GOOGLE_SERVICE_ACCOUNT`** (escape newlines in `private_key` as `\n` — see **`supabase/.env.example`**).
3. **`GOOGLE_CALENDAR_ID`** — calendar ID or owner email the SA can write (share the calendar with the SA **`client_email`**).
4. **`GOOGLE_SPREADSHEET_ID`** — ID from the Sheet URL; share the spreadsheet with the SA **`client_email`** (**Editor**).

### 11.5 Edge Function secrets (Supabase Dashboard)

Copy names from **`supabase/.env.example`**. Typical production set:

| Group                              | Variables                                                                                                                       | Notes                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin / workflow**               | **`ADMIN_ALLOWED_EMAILS`**                                                                                                      | `verifyAdminJwt` allow list; org owners bypass.                                                                                                                                        |
|                                    | **`SUPER_ADMIN_EMAILS`**                                                                                                        | Platform `/admin/*` (`serveSuperAdmin`).                                                                                                                                               |
|                                    | **`PARKING_OWNER_EMAILS`**                                                                                                      | BCC list for parking broadcast — **[[NEW_FLOW_PLAN]] §6.1 Q4.1** seed; rotate via env only.                                                                                            |
| **Email (Resend)**                 | **`RESEND_API_KEY`**, **`EMAIL_TO`**, **`EMAIL_REPLY_TO`**                                                                      | Production vs dev routing — see **`.env.example`**. **`EMAIL_REPLY_TO`** is also the **To:** address for **New Booking Request** (`submit-form` → `sendNewBookingRequestNotify`).      |
|                                    | **`EMAIL_LOGO_URL`**, **`PUBLIC_GUEST_APP_ORIGIN`**, **`FACEBOOK_REVIEWS_URL`**                                                 | Optional guest links / branding ([`docs/architecture/validation-and-env.md`](../architecture/validation-and-env.md)).                                                                  |
| **Google APIs**                    | **`GOOGLE_SERVICE_ACCOUNT`**, **`GOOGLE_CALENDAR_ID`**, **`GOOGLE_SPREADSHEET_ID`**                                             | **§11.4**.                                                                                                                                                                             |
| **Gmail listener / Connect Gmail** | **`EMAIL_TO`** (Documents Approver in Settings) — allowed **From** on GAF/Pet approval replies when set; blank = permissive     |
|                                    | **Option 1:** **`GMAIL_API_WEB_CLIENT_JSON`**, **`GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`**, **`GMAIL_OAUTH_ALLOWED_RETURN_ORIGINS`** | In-app Connect Gmail + encrypted refresh token in DB.                                                                                                                                  |
|                                    | **Option 2:** **`GMAIL_OAUTH_CLIENT_JSON`**, **`GMAIL_OAUTH_TOKEN_JSON`**                                                       | Legacy **`bun run gmail-auth`** refresh token in secrets.                                                                                                                              |
|                                    | **`SUPABASE_PUBLIC_URL`** _(optional)_                                                                                          | Public API origin if Edge-internal `SUPABASE_URL` breaks Gmail redirect URI construction — see **[`docs/architecture/validation-and-env.md`](../architecture/validation-and-env.md)**. |
| **SD refund cron**                 | **`SD_REFUND_CRON_EMAIL_LEAD_MINUTES`**, **`SD_REFUND_CRON_MAX_CHECKOUT_AGE_DAYS`**                                             | Defaults **120** / **21** — **`.cursor/rules/admin-auth.mdc` §7**.                                                                                                                     |
| **Dev-only softness**              | **`ENVIRONMENT`**, **`DENO_ENV`**                                                                                               | Usually **omit** in prod so **`isDevelopment()`** stays false; **`DENO_DEPLOYMENT_ID`** is set automatically on hosted Edge.                                                           |

### 11.6 UI production env (e.g. Vercel)

Set in the **production** build environment (`bun run build` reads **`ui/.env.production`** locally; Vercel uses project **Environment Variables**):

| Variable                        | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| **`VITE_NODE_ENV`**             | **`production`** — guest form production behavior.            |
| **`VITE_SUPABASE_URL`**         | `https://<ref>.supabase.co/functions/v1`                      |
| **`VITE_API_URL`**              | Same as **`VITE_SUPABASE_URL`**.                              |
| **`VITE_SUPABASE_ANON_KEY`**    | Dashboard → **Project Settings → API** → anon **public** key. |
| **`VITE_SUPABASE_PROJECT_URL`** | Optional; default derives from **`VITE_SUPABASE_URL`**.       |

**Note:** **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`** in **`ui/.env.development`** exist for **local** `supabase start` + **`config.toml`** substitution only. **Hosted** Auth uses **Dashboard** credentials (**§11.2**), not Vite env.

### 11.7 Deploy Edge Functions

From repo root (linked project):

```bash
supabase functions deploy
```

Or deploy named functions only if your pipeline splits bundles. Ensure **`supabase/config.toml`** lists **`static_files`** for every function that sends email (templates + **`email-assets`** JPEG for ready-for-check-in QR CID) — mismatches cause **`ENOENT`** at runtime.

### 11.8 Scheduled jobs (`pg_cron` + Vault)

Hosted schedules are **not** defined in **`config.toml`** (local CLI limitation). On Supabase Cloud:

1. Enable **`pg_cron`** and **`pg_net`** (SQL Editor or Dashboard → **Database → Extensions**).
2. Store **`project_url`** (e.g. `https://<ref>.supabase.co`) and the **`anon`** JWT (**Dashboard → Project Settings → API**) in **Vault** — same pattern as Supabase’s scheduling guide.
3. Schedule **`net.http_post`** to **`/functions/v1/gmail-listener`** and **`/functions/v1/sd-refund-cron`** with **`Authorization: Bearer <anon_key>`** and body **`{}`** (both functions use **`verify_jwt = false`**; **`anon`** matches \*\*[[scheduled-jobs-and-testing|Scheduled jobs (cron) and how to test them]] §2–§4).

Full SQL patterns, security notes, and local curl testing: **[[scheduled-jobs-and-testing|Scheduled jobs (cron) and how to test them]]**.

### 11.9 Post-deploy smoke checklist

- [ ] **`/sign-in`** → Google OAuth → **`/bookings`** loads for allow-listed email.
- [ ] **`/form`** guest submit + **`/sd-form`** when eligible (status + emailed-at gates).
- [ ] Admin **transition** on a test booking (calendar color/title + sheet row if toggles on).
- [ ] Outbound **email** received (Resend dashboard / inbox).
- [ ] **Run Gmail poll now** / **Run SD refund cron now** from booking detail (scoped JWT) succeeds.
- [ ] After **`pg_cron`** is live, confirm **`gmail-listener`** / **`sd-refund-cron`** invocations in **Edge Logs** on schedule.

**Templates:** [`supabase/.env.example`](../../supabase/.env.example) · [`ui/.env.example`](../../ui/.env.example) · **[`docs/architecture/validation-and-env.md`](../architecture/validation-and-env.md)** · **[[scheduled-jobs-and-testing|Scheduled jobs (cron) and how to test them]]**
