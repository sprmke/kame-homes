---
title: 'Environment and configuration health remediation'
status: done
tags: [ops, env, health, production-readiness]
updated: 2026-11-04
stage: done
---

# Environment and configuration health remediation

**Status 2026-11-04:** complete. Production backend, Vercel env, local profile, registry
coverage and cron heartbeats are applied. Optional local-only action left to the operator:
create separate Google credentials ([guide](../../guides/testing/local-google-setup.md)).

Goal: `/admin/health` shows no avoidable errors in production, every value it inspects is a
real, current value, and a local checkout runs on local/test credentials only.

Written from a read-only pass on 2026-11-04 against:

- Supabase project `fworvijbrwpyngycotbz` (secrets list, `cron.job`, `vault.secrets`,
  `platform_settings`, `ai_platform_global_settings`)
- Vercel project `kame-space` (production and preview env entries, latest production build)
- every gitignored env file in the repo

Secret values were never read back: the Supabase Management API returns `sha256` hashes, and
this plan only ever compares those hashes.

## What the health page is reporting, and why

| Row                                                           | Section                 | Cause (verified)                                                                                                                                | Type                     |
| ------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `QUERY_CACHE_SWEEP_CRON_SECRET` Missing                       | Cron secrets            | `pg_cron` job `query-cache-sweep-nightly` is active, the edge secret and Vault key `query_cache_sweep_cron_secret` do not exist                 | Real                     |
| `VOICE_RECEPTIONIST_REAPER_SECRET` Missing                    | Cron secrets            | `pg_cron` job `voice-receptionist-reaper-every-minute` is active, the edge secret and Vault key `voice_receptionist_reaper_secret` do not exist | Real                     |
| Guest form dev controls hidden                                | Production posture (UI) | The Vercel production entry for `VITE_NODE_ENV` was created with the preview value (`development`) and is shared across targets                 | Real                     |
| `META_OAUTH_ALLOWED_RETURN_ORIGINS` Points at a local address | Meta                    | Hosted value still lists `127.0.0.1:5173` / `localhost:5173`                                                                                    | Cosmetic, tighten anyway |
| `REVIEW_IDENTITY_PEPPER` Missing                              | Security                | Never set. `guest_reviews` has 0 rows, so setting it now is safe; changing it later would unlink reviews                                        | Real                     |
| AI platform switch Off                                        | Platform settings       | `ai_platform_global_settings.enabled = false`                                                                                                   | Decision                 |
| Authenticated rate limit Log only                             | Platform settings       | `platform_settings.authenticated_rate_limit_enforce = false`                                                                                    | Decision                 |

The 19 "Off" rows are optional keys or tuning knobs with a working default. Only
`VITE_SUPABASE_PROJECT_URL` and `VITE_POSTHOG_INGEST_PATH` are worth setting in production.

Also found, not on the page:

- `pg_cron` job `voice-receptionist-canary-weekly` runs in production against a staging-only
  function. It is a no-op (the function returns `skipped` in production) but its secret is
  unset, so it 401s every Monday.
- `supabase/.env.dev.local` (the hosted reference file) said `ENVIRONMENT=development` while
  the project is production. A secret push from that file would have disabled cron secret
  enforcement. It is now `production`, and the sync script forces that value.
- Vercel has duplicate entries for `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`,
  `VITE_NODE_ENV`, `VITE_SUPABASE_URL`, `VITE_API_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SUPER_ADMIN_EMAILS`, `VITE_VAPID_PUBLIC_KEY`,
  `VITE_TURNSTILE_SITE_KEY`. Resolution depends on target order, which is how the
  `VITE_NODE_ENV` bug slipped through.
- `ui/.env.production` still pointed at the retired legacy project `zftt…`, so a local
  `vite build` produced a bundle pointed at a dead backend.
- `supabase/.env.local` (the file loaded by `functions serve`) contained production values for
  Resend, Gemini, Groq, Meta, PostHog, Sentry, VAPID, Vault-equivalent crypto keys and every
  cron secret. Local guest submissions sent real Resend email and used the production AI quota.
- `bun run env:sync:all` would have copied those local values into `supabase/.env.dev.local`
  and pushed them to the hosted project (`EDGE_ALWAYS_FROM_LOCAL`).
- `bun run env:reorganize` silently dropped script-only keys that have no schema row
  (`VERCEL_TOKEN`, `TARGET_*`, `SENTRY_AUTH_TOKEN`, …).
- The health registries were missing keys the code actually reads: `ASSISTANT_TOOL_TIMEOUT_MS`,
  `ASSISTANT_TURN_DEADLINE_MS`, `SENTRY_SAMPLE_RATE_WARNING` (edge) and
  `VITE_SENTRY_TRACES_SAMPLE_RATE`, `VITE_CANONICAL_APP_ORIGIN`, `VITE_LEGACY_APP_HOSTS`,
  `VITE_SUPER_ADMIN_EMAILS`, `VITE_VIDEO_EDITOR_V2`, `VITE_REMOTION_LICENSE_KEY` (UI).

## Phase 0: Safety (done)

- [x] `bun run env:backup` (`scripts/dev/env-backup.mjs`) copies every real env file to
      `.env-backups/<UTC stamp>/`, mode 600, with `MANIFEST.json` holding sha256 and key names
      only.
- [x] Snapshot taken before any edit:
      `.env-backups/2026-11-03_22-12-25_pre-env-health-remediation/` (14 files).
- [x] Restore is `cp .env-backups/<stamp>/<path> <path>`.

## Phase 1: Tooling (done)

- [x] `bun run env:audit` (`scripts/dev/env-audit.mjs`, read-only):
      registry coverage, local-file shape, local-vs-hosted secret hash comparison, missing
      hosted secrets, Vercel production coverage and duplicate entries.
      `bun run env:audit -- --hosted --vercel` is the full pass.
- [x] Health registries extended so no code-read key is invisible to the page.
- [x] Sync tooling made safe: - hosted file is authoritative, `.env.local` is never copied into it; - PostHog server key is mirrored to the hosted edge file only; - telemetry, VAPID and Turnstile no longer propagate into the local profile; - `env:reorganize` has a schema for `.env.management.local` and `.env.prod.local`; - `sync-vercel-dev-env --production-too` forces `VITE_NODE_ENV=production`.

## Phase 2: Local profile (done)

`supabase/.env.local` is now a local-stack file only:

- generated local crypto keys, VAPID pair, push secret, review pepper and cron secrets;
- Cloudflare always-pass Turnstile keys;
- PayMongo test key (kept) plus a local webhook secret;
- third parties with no sandbox (Resend, Gemini, Groq, Meta, Jamendo, PostHog, Sentry) are
  unset, so email/AI/Meta work is a logged no-op locally and never bills production;
- `ENVIRONMENT=development`, localhost origins only.

Script-only credentials (`PROD_DB_URL`, `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`,
`TARGET_*`, `LEGACY_*`, `SENTRY_AUTH_TOKEN`, `POSTHOG_PERSONAL_API_KEY`) moved to
`supabase/.env.management.local`. `backup-supabase.sh`, `rollback-supabase.sh` and
`sync-prod-public-data-to-local.sh` read it first, then fall back to `.env.local`.

UI profile:

- `ui/.env.development` uses the local VAPID public key, the always-pass Turnstile site key,
  and no PostHog/Sentry values.
- `ui/.env` now holds build-only vendor tokens (`POSTHOG_PERSONAL_API_KEY`,
  `POSTHOG_PROJECT_ID`), nothing the dev runtime reads.
- `ui/.env.development.local` leaves `VITE_SENTRY_DSN` unset and sets the trace sample rate to 0.
- `ui/.env.production` points at `fworvijbrwpyngycotbz` with the production PostHog, Sentry,
  Turnstile and VAPID values (it used to point at the retired legacy project).

Verified after the change: `bun run env:audit -- --hosted` reports
`No production secret value is reused in supabase/.env.local`.

## Phase 3: Production remediation (applied 2026-11-04)

### 3.1 Edge + Vault secrets for the two active crons

Values are already generated in `supabase/.env.dev.local`:

```bash
# Edge secrets
QUERY_CACHE_SWEEP_CRON_SECRET
VOICE_RECEPTIONIST_REAPER_SECRET

# Vault, same value, lowercase name
select vault.create_secret('<same value>', 'query_cache_sweep_cron_secret');
select vault.create_secret('<same value>', 'voice_receptionist_reaper_secret');
```

The cron commands read Vault at call time, so no re-schedule is needed. Next run records a
heartbeat and the rows go green.

### 3.2 Review pepper

`REVIEW_IDENTITY_PEPPER` (value generated in `supabase/.env.dev.local`). Safe now:
`guest_reviews` is empty. Once reviews exist, this value must never change.

### 3.3 Unschedule the staging-only canary

```sql
select cron.unschedule('voice-receptionist-canary-weekly');
```

Or set `VOICE_RECEPTIONIST_CANARY_SECRET` and leave the no-op. Unschedule is cleaner.

### 3.4 Vercel (production target, applied)

- `VITE_NODE_ENV=production` set on the production entry; preview keeps `development`.
- Every key now has exactly one entry per target (checked for production, preview and
  development). Broad entries were narrowed to the target that owns their value.
- Added `VITE_SUPABASE_PROJECT_URL=https://fworvijbrwpyngycotbz.supabase.co`.
- Added `VITE_POSTHOG_INGEST_PATH=/ingest`.
- Production redeployed from the current production build.

### 3.5 Meta origin (applied)

`META_OAUTH_ALLOWED_RETURN_ORIGINS=https://kamespace.com,https://www.kamespace.com` on the
hosted edge project. Keep localhost values in `supabase/.env.local` only.

### 3.6 Cost guard and optional keys (applied)

- `AI_PLATFORM_DAILY_COST_USD_CAP=150` (0 currently disables the cap).
- `SENTRY_SAMPLE_RATE_WARNING=0.25`. Production currently has `1`, which samples every
  warning-level capture instead of a quarter of them.
- Optional: `CORS_ALLOWED_ORIGINS` for Vercel preview hosts,
  `VITE_PLATFORM_CONTACT_PHONE` and `VITE_PLATFORM_SOCIAL_*` if the footer should show them.

## Phase 4: Decisions (applied 2026-11-04)

1. **AI platform**: enabled (`enabled = true`, `enforce_quotas = true`). Quotas and the
   $150/day platform cap stay in force, so free-tier Gemini keys cannot run away.
2. **Authenticated rate limit**: enforced at 300 requests per minute per identity. The limiter
   fails open on a counter error, so a DB blip cannot block authenticated calls.
3. **`VITE_SUPER_ADMIN_EMAILS`**. It is a public build value holding five admin addresses,
   used only to flag internal PostHog users. Options: keep, or replace with PostHog-internal
   project filtering and drop the env var.
4. **Local third-party testing**. If local booking email must really send, create a dedicated
   Resend key and a local `RESEND_FROM_EMAIL`; do not reuse the production key.
   Same question for Gemini (a free key) and Meta (a test app).

## Phase 5: Cleanup candidates (after the items above)

Safe to archive once the user confirms the legacy project is gone:

- `ui/.env.legacy-prod.local`, `supabase/.env.legacy-prod.local` (retired `zftt…` values;
  kept because `scripts/migrate/legacy-to-mt-prod/*` still references them),
- `supabase/.env.production` (stale 9-key file, not read by any script),
- `LEGACY_*`, `TARGET_*`, `GCASH_*`, `TELEGRAM_*_BOT_TOKEN` entries (retired by migration).

Do not delete without a backup: `.env-backups/` keeps a copy, but the migration verifier
expects the two legacy files to exist.

## What I need from you

| Need                         | Exact steps                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approve production changes   | Reply with `kamewave` in the message that asks for them, or run the Phase 3 SQL/secrets yourself.                                                                                                                                                                |
| Vercel env write access      | Vercel → team `kame-works` → project `kame-space` → Settings → Environment Variables. The local `VERCEL_TOKEN` can read the project but cannot list or write env vars. Either do the four Phase 3.4 edits there, or create a token with project env write scope. |
| AI + rate limit decision     | Answer Phase 4 items 1 and 2.                                                                                                                                                                                                                                    |
| Optional local provider keys | Resend → API Keys → Create "local dev" (Sending access). Gemini → AI Studio → Get API key. Meta → developers.facebook.com → your app → Test app. Put them in `supabase/.env.local` only.                                                                         |
| Confirm Google OAuth client  | `ui/.env.development` uses `GOOGLE_CLIENT_ID`/`SECRET` for local GoTrue. If that client is the production one, create a separate "Kame Space local" web client and replace those two values.                                                                     |

## Applied log

- Edge secrets added: `QUERY_CACHE_SWEEP_CRON_SECRET`, `VOICE_RECEPTIONIST_REAPER_SECRET`,
  `REVIEW_IDENTITY_PEPPER`; `SENTRY_SAMPLE_RATE_WARNING` set to `0.25`;
  `AI_PLATFORM_DAILY_COST_USD_CAP` set to `150`.
- Vault keys created: `query_cache_sweep_cron_secret`, `voice_receptionist_reaper_secret`.
- `voice-receptionist-canary-weekly` unscheduled.
- `ai_platform_global_settings`: enabled, quotas enforced.
- `platform_settings`: authenticated rate limit enforced at 300/min.
- Vercel production env deduplicated and corrected, production redeployed.
- Local Resend key added to `supabase/.env.local` with `RESEND_FROM_EMAIL=onboarding@resend.dev`.
- `serveCronPost` records a heartbeat for every run (19 jobs), and the three raw handlers
  (`sd-refund-cron`, `calendar-sync-cron`, `superhost-assessment-cron`) record their unscoped
  cron runs too.

## Verification

```bash
bun run env:audit -- --hosted --vercel   # expect 0 fail
./dev.sh                                 # local stack boots, guest form submits, no outbound email
```

In production: `/admin/health` → Configuration and Jobs show 0 errors; the two cron jobs record
a heartbeat within one interval (1 minute for the reaper, next 02:17 Manila for the cache sweep).
