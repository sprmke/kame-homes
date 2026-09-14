---
title: 'Form validation and environment variables'
status: active
tags: [architecture]
updated: 2026-09-11
---

# Form validation and environment variables

Part of the [`docs/PROJECT.md`](../PROJECT.md) architecture split.

---

## 10. Form validation (UI)

`ui/src/features/guest/form/schemas/guestFormSchema.ts` (Zod):

- **Phone**: Philippines `09` + 9 digits (11 total).
- **Address**: `City, Province` pattern.
- **Guests**: up to **4** additional guests on step 1 — each with **name**, **age**, and **valid ID** when age ≥ 18; `numberOfAdults` / `numberOfChildren` are derived (age ≤ 5 = child). Primary guest name **pre-fills from the contact name** and stays editable.
- **Parking / pets**: conditional required fields.
- **Same-day stay**: check-out time must be after check-in time when dates equal.
- **Files**: `paymentReceipt` required for Facebook bookings; `validId` / `guest2ValidId` / `guest3ValidId` / `guest4ValidId` / `guest5ValidId` required when the matching guest is 18+; pet files required when `hasPets`.

**Server mirror (edge):** format-only rules duplicated in `_shared/guestFormSubmitValidation.ts` for `submit-form` and `submit-form-completion` (name, email, PH phone, adults ≥ 1, check-out after check-in on `submit-form` only). Property-config-dependent rules stay client-side or in overlap/buffer checks.

---

## 11. Environment variables

### Files (templates vs secrets)

| File                                                              | Purpose                               |
| ----------------------------------------------------------------- | ------------------------------------- |
| `ui/.env.example`                                                 | UI var inventory (placeholders)       |
| `ui/.env.development.local.example`                               | Local-stack UI-only template          |
| `ui/.env.development.dev.example`                                 | Hosted-dev UI template                |
| `supabase/.env.example`                                           | Edge secrets inventory (placeholders) |
| `supabase/.env.dev.example`                                       | Dev project deploy + `dev:remote-api` |
| `supabase/.env.prod.example`                                      | Multi-tenant prod bootstrap template  |
| Gitignored `*.local`, `.env.development`, `.env.production`, etc. | Real values — never commit            |

**Backups:** `.env-backups/<date>/` (gitignored). Re-format after edits: `bun run env:reorganize` (`scripts/dev/reorganize-env-files.mjs`).

**Keep env files in sync:** `bun run env:sync:all` — reorganize → merge UI (`ui/.env` ↔ `.env.development` ↔ `.env.development.dev`) + PostHog → Edge (`VITE_POSTHOG_*` → `POSTHOG_*`) → `supabase/.env.dev.local` → push Supabase DEV secrets → Vercel `kame-homes`. Subcommands: `env:reorganize`, `env:sync:dev` (local + Supabase only), `env:sync:vercel:dev` (Vercel only; requires `vercel login` on `kame-works`). Does **not** touch LEGACY prod.

**Format:** Short `# Section` headers; optional vars commented in `*.example` only. Operator settings (email, payment, Telegram) live in DB — not env. Contact email is **UI-only** (`VITE_PLATFORM_CONTACT_EMAIL`) — never put `PLATFORM_CONTACT_EMAIL` in Edge env.

### Secrets hygiene

| Safe in git (`*.example`, docs)                    | Never commit                                                   |
| -------------------------------------------------- | -------------------------------------------------------------- |
| Placeholder names and fake values                  | `*.local`, real `.env.development` / `.env.production`         |
| Project ref in operator docs (semi-public in URLs) | Service role key, anon JWT (real), DB pooler URIs, API secrets |
| GitHub secret **names** in workflow docs           | GitHub secret **values**                                       |

Production hosted secrets: Supabase Dashboard → Edge Functions → Secrets. UI `VITE_*`: Vercel project env. Checklist: **`docs/archive/operations/migration-runbook.md`** §11.

---

### 11.1 UI (`ui/.env` / Vercel)

| Variable                          | Required   | Notes                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`               | Yes        | Edge Functions base URL **with** `/functions/v1`                                                                                                                                                                                                                                                                                                                                                              |
| `VITE_API_URL`                    | Yes        | Same as `VITE_SUPABASE_URL` (guest form fetchers)                                                                                                                                                                                                                                                                                                                                                             |
| `VITE_SUPABASE_ANON_KEY`          | Yes        | Public anon key                                                                                                                                                                                                                                                                                                                                                                                               |
| `VITE_NODE_ENV`                   | Yes        | `production` toggles guest-form prod behavior                                                                                                                                                                                                                                                                                                                                                                 |
| `VITE_SUPABASE_PROJECT_URL`       | No         | Override Supabase JS project URL (hybrid `dev:remote-api`)                                                                                                                                                                                                                                                                                                                                                    |
| `VITE_SUPER_ADMIN_EMAILS`         | No         | Comma-separated — `/admin/*` UX only; server uses `SUPER_ADMIN_EMAILS`                                                                                                                                                                                                                                                                                                                                        |
| `VITE_GOOGLE_MAPS_API_KEY`        | No         | Property Settings location picker                                                                                                                                                                                                                                                                                                                                                                             |
| `VITE_POSTHOG_KEY`                | No         | PostHog project API key — error tracking, product analytics, session replay, feature flags. Unset → `ui/src/lib/posthog/client.ts` no-ops (no `posthog.init`)                                                                                                                                                                                                                                                 |
| `VITE_POSTHOG_HOST`               | No         | PostHog Cloud region host (dev/preview). Defaults to `https://us.i.posthog.com`; use `https://eu.i.posthog.com` for EU data residency                                                                                                                                                                                                                                                                         |
| `VITE_POSTHOG_INGEST_PATH`        | No         | Production first-party ingest path (e.g. `/ingest`). When set in prod builds, `ui/src/lib/posthog/env.ts` uses this instead of `VITE_POSTHOG_HOST`. Pair with `ui/vercel.json` rewrites to `us.i.posthog.com`.                                                                                                                                                                                                |
| `VITE_POSTHOG_SESSION_REPLAY`     | No         | Set to `true` to enable session replay in production builds. Default off; inputs masked when on (`ui/src/lib/posthog/client.ts`).                                                                                                                                                                                                                                                                             |
| `VITE_APP_TRACK`                  | No         | Analytics track label: `mt` (default) or `legacy` for dual-track legacy prod. Attached as `app_track` on every event.                                                                                                                                                                                                                                                                                         |
| `POSTHOG_PERSONAL_API_KEY`        | No         | **Build-time only** (Vercel/CI build env — no `VITE_` prefix, never bundled to the browser). PostHog **personal** API key (error tracking write scope) so `vite.config.ts` uploads readable production source maps via `@posthog/rollup-plugin`. Deliberately a different var from edge's `POSTHOG_API_KEY` (project key) — unset → plugin skipped, `build.sourcemap` stays `false`                           |
| `POSTHOG_PROJECT_ID`              | No         | Pairs with `POSTHOG_PERSONAL_API_KEY` for source map upload — from PostHog project settings                                                                                                                                                                                                                                                                                                                   |
| `VITE_INBOX_MOCK_DATA`            | No         | `true` → inbox mock mode                                                                                                                                                                                                                                                                                                                                                                                      |
| `VITE_PLATFORM_APP_NAME`          | No         | Operator/product name for marketing site, legal pages, app-level tab titles, PWA install copy, and super-admin chrome. **UI only** — set in `ui/.env*` / Vercel; not read from `supabase/.env.local`. Unset or the retired placeholder `Stays` → **`Kame Homes`**.                                                                                                                                            |
| `VITE_PLATFORM_CONTACT_EMAIL`     | No         | Support/legal contact email on marketing and legal pages. **UI only.** Defaults to `support@example.com` when unset.                                                                                                                                                                                                                                                                                          |
| `VITE_DISABLE_IMAGE_OPTIMIZATION` | No         | `1` → client image compression becomes a no-op (global kill switch). See [`storage.md`](./storage.md) §7.1                                                                                                                                                                                                                                                                                                    |
| `VITE_IMAGE_OPT_SURFACES`         | No         | Staged rollout. **Unset** → every group optimizes **except `guest-documents`** (held back until the §9.7 OCR gate runs — safe default for dev, staging and prod); `all` → everything incl. guest docs; `none` → nothing; CSV of rollout groups (`settings,galleries,marketing,guest-profile,guest-documents`) or surface ids → only those. Ceiling checks always run. See [`storage.md`](./storage.md) §7.1   |
| `GOOGLE_CLIENT_ID`                | Local only | GoTrue Google OAuth — **not** `VITE_*`; loaded before `supabase start`                                                                                                                                                                                                                                                                                                                                        |
| `GOOGLE_CLIENT_SECRET`            | Local only | Pair with `GOOGLE_CLIENT_ID`                                                                                                                                                                                                                                                                                                                                                                                  |
| `VITE_VAPID_PUBLIC_KEY`           | No         | base64url raw VAPID public key for PWA Web Push. Unset → the "Notifications on this device" toggle reports unsupported. Generate with `node scripts/pwa/generate-vapid-keys.mjs`. See [`pwa.md`](./pwa.md) §5                                                                                                                                                                                                 |
| `VITE_TURNSTILE_SITE_KEY`         | No         | Cloudflare Turnstile **site** key for the anti-spam widget (auth OTP + guest booking/SD/review/pay-parking forms). Unset → `ui/src/components/security/TurnstileWidget.tsx` renders nothing and forms submit on server heuristics + rate limit only. Local/CI test key: `1x00000000000000000000AA` (always passes). See [captcha-anti-spam-hardening](../workflow/for-testing/captcha-anti-spam-hardening.md) |

**Removed / unused:** `VITE_SUPABASE_DB_PASSWORD` — not read by the app.

**Local GoTrue:** After changing `GOOGLE_*` or `supabase/config.toml` `[auth.external.google]`, run `bun run stop:supabase` then `./dev.sh` so the auth container picks up `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI`.

---

### 11.2 Edge secrets (`supabase/.env.local` / Dashboard)

#### Platform-injected (hosted)

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — set by Supabase on deploy.
- `DENO_DEPLOYMENT_ID` — production signal (auto).

#### Local `functions serve` aliases

When invoking `supabase functions serve` manually, `./dev.sh` / `bun run dev:api` merge `API_URL` + `SERVICE_ROLE_KEY` from `supabase status` via `scripts/dev/build-local-functions-env.sh` (CLI skips `SUPABASE_*` in `--env-file`).

#### Core

| Variable                                 | Notes                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `ENVIRONMENT` / `DENO_ENV`               | `development` → `isDevelopment()` in `_shared/utils.ts`                        |
| `ADMIN_ALLOWED_EMAILS`                   | Legacy platform admin allow list (`verifyAdminJwt`)                            |
| `SUPER_ADMIN_EMAILS`                     | `/admin/*`, `serveSuperAdmin`                                                  |
| `PUBLIC_GUEST_APP_ORIGIN`                | Guest email/deep links; legacy `org_settings.public_guest_app_origin` fallback |
| `PUBLIC_API_URL` / `SUPABASE_PUBLIC_URL` | Public API base for Meta OAuth/webhooks; ngrok local dev                       |

#### Email (Resend)

| Variable                         | Notes                                                  |
| -------------------------------- | ------------------------------------------------------ |
| `RESEND_API_KEY`                 | Outbound + inbound attachment fetch                    |
| `RESEND_FROM_EMAIL`              | Optional verified From; else property `email_reply_to` |
| `RESEND_INBOUND_WEBHOOK_SECRET`  | Svix secret for `approval-email-webhook`               |
| `RESEND_APPROVAL_INBOUND_DOMAIN` | Plus-address domain, e.g. `inbound.kamehomes.space`    |
| `SUPPORT_TEAM_EMAIL`             | Help & Support ticket notify inbox                     |

**Email routing (`EMAIL_TO`, `EMAIL_REPLY_TO`, parking BCC):** **`app_settings`** / **`org_settings`** — not env.

#### Encryption

| Variable                           | Notes                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` | 32-byte hex/base64 — encrypts Telegram tokens at rest (legacy name)                                                     |
| `SETTINGS_VERIFICATION_SECRET`     | HMAC for settings OTP tokens; falls back to encryption key, then service role                                           |
| `SUPER_ADMIN_VERIFICATION_SECRET`  | Optional — HMAC for the super-admin step-up sudo token; falls back to `SETTINGS_VERIFICATION_SECRET`, then service role |

#### Anti-spam — Cloudflare Turnstile

| Variable               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile **secret** key. Used two ways: (1) Supabase Auth native captcha on `signInWithOtp` (`supabase/config.toml` `[auth.captcha]`, hosted: Dashboard → Authentication → Attack Protection); (2) `_shared/captcha.ts#verifyCaptchaToken` `siteverify` for the anon write endpoints. **Unset → CAPTCHA is disabled** (helper no-ops). Local/CI test secret: `1x0000000000000000000000000000000AA` (always passes) / `2x0000000000000000000000000000000AA` (always fails). |
| `CAPTCHA_MODE`         | Optional override for `_shared/captcha.ts`: `enforce` (reject missing/invalid token), `monitor` (always allow, log outcome to PostHog for tuning), `disabled` (skip). Unset → derived: `enforce` when `TURNSTILE_SECRET_KEY` is set, else `disabled`. Use `monitor` for a zero-redeploy fallback during a provider incident. Fails **open** on `siteverify` 5xx / timeout / network error; fails **closed** on a definitive negative or a missing token in `enforce`.                  |

**Durable rate limiter** (`_shared/rateLimit.ts` + `request_rate_limits` table + `bump_rate_limit()` RPC, migration `20261304120000`): no env — always on, fixed-window per `{scope, identity}` where identity is the auth user id else client IP. Fails **open** on any counter error. Public GET ceiling from `platform_settings.public_rate_limit_per_min` via `_shared/publicEndpointRateLimit.ts`. `_shared/publicRateLimit.ts` stays as an in-memory L1 burst dampener on `submit-form`; client IP prefers `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for`.

#### Guest booking access tokens

| Variable                                 | Notes                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GUEST_BOOKING_ACCESS_SECRET`            | HMAC secret for guest PII link tokens (`_shared/guestBookingAccessToken.ts`). Optional — falls back to `SUPABASE_SERVICE_ROLE_KEY`.                         |
| `GUEST_BOOKING_ACCESS_ENFORCE`           | `true` → `get-form`, `get-sd-form`, `get-guest-review` require valid `?access=` token (or booking within legacy grace). Default off until dev verification. |
| `GUEST_BOOKING_ACCESS_LEGACY_GRACE_DAYS` | When enforce is on, bare UUID still works for N days after `guest_submissions.created_at`. Default **30**. `0` = no grace.                                  |
| `AI_PLATFORM_DAILY_COST_USD_CAP`         | Platform-wide daily AI USD ceiling in `assertOrgAndPropertyAiQuota`. Default **150**; `0` = disabled.                                                       |
| `AI_ASSISTANT_ATTACHMENT_RETENTION_DAYS` | Purge `ai-assistant-attachments` objects older than N days (dashboard-assistant-expire cron). Default **90**.                                               |
| `VITE_POSTHOG_SESSION_REPLAY`            | UI — set `true` to enable session replay in production builds (default off).                                                                                |

#### Cron secret gate

| Variable      | Notes                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT` | When `production`, `_shared/cronSecretGate.ts` rejects cron POSTs if the job-specific `*_CRON_SECRET` is unset. Dev/local stay fail-open until Vault secrets are provisioned. |

#### AI

| Variable                                                                      | Notes                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEYS`                                                             | Comma-separated (local/dev rotation)                                                                                                                                                                                                                                                                                                           |
| `GEMINI_API_KEY`                                                              | Single key — **required for production**                                                                                                                                                                                                                                                                                                       |
| `GROQ_API_KEY`                                                                | Fallback when Gemini fails                                                                                                                                                                                                                                                                                                                     |
| `GEMINI_MODEL_OVERRIDE_<FEATURE>` / `GEMINI_MODEL_OVERRIDE`                   | Optional. Overrides the model id from `_shared/aiModelRouter.ts` (e.g. `GEMINI_MODEL_OVERRIDE_DASHBOARD_ASSISTANT=gemini-3.5-flash-lite`). Pricing metadata unchanged. Local/dev when free-tier quota is exhausted on the default model. After changing: rebuild via `scripts/dev/build-local-functions-env.sh` and restart `functions serve`. |
| `GEMINI_MODEL_OVERRIDE_MARKETING_IMAGE_<TIER>` / `..._MARKETING_VIDEO_<TIER>` | Optional. `<TIER>` is `DRAFT` \| `STANDARD` \| `PREMIUM`. Overrides the media-generation model id from `MARKETING_IMAGE_MODELS` / `MARKETING_VIDEO_MODELS` in `_shared/aiModelRouter.ts`. Pricing metadata unchanged — the credit table still charges the tier's published rate, so use this only for local/dev model swaps.                   |

#### Meta (Guest Inbox + Marketing publish)

| Variable                               | Notes                   |
| -------------------------------------- | ----------------------- |
| `META_APP_ID`, `META_APP_SECRET`       | Developer app           |
| `META_INBOX_TOKEN_ENCRYPTION_KEY`      | Page token encryption   |
| `META_WEBHOOK_VERIFY_TOKEN`            | Webhook GET verify      |
| `META_OAUTH_ALLOWED_RETURN_ORIGINS`    | SPA origins after OAuth |
| `META_OAUTH_EXCLUDE_PUBLISHING_SCOPES` | `1` = inbox-only OAuth  |
| `META_OAUTH_EXTRA_SCOPES`              | Comma-separated extras  |

#### PayMongo

| Variable                  | Notes                                |
| ------------------------- | ------------------------------------ |
| `PAYMONGO_SECRET_KEY`     | Org subscriptions + parking checkout |
| `PAYMONGO_WEBHOOK_SECRET` | HMAC in `paymongo-webhook`           |

#### Integrations (optional)

| Variable            | Notes                               |
| ------------------- | ----------------------------------- |
| `JAMENDO_CLIENT_ID` | Marketing Studio video music browse |

#### Observability (optional)

| Variable          | Notes                                                                                                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTHOG_API_KEY` | Server-side exception capture (`_shared/posthog.ts`). Unset → no-op. Wired into `httpResponse.ts#handleEdgeError` (all `serveAdmin`/`serveSuperAdmin`/`serveAuthenticated`/`servePublic` functions) and `serveEdge.ts#serveCronPost` — never call it from individual handlers |
| `POSTHOG_HOST`    | Defaults to `https://us.i.posthog.com`; use `https://eu.i.posthog.com` to match EU data residency                                                                                                                                                                             |

#### PWA Web Push

| Variable             | Notes                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VAPID_KEYS`         | JWK pair JSON `{ publicKey, privateKey }` — imported by `_shared/webPushService.ts` (`node scripts/pwa/generate-vapid-keys.mjs`). Unset → push no-ops.                       |
| `VAPID_SUBJECT`      | `mailto:` or `https:` contact URL sent in the VAPID JWT.                                                                                                                     |
| `PUSH_FANOUT_SECRET` | Shared secret the `notifications` → `pg_net` trigger sends as `X-Push-Fanout-Secret` to `push-fanout`. Also set the Vault secret **`push_fanout_secret`** to the same value. |

#### Platform email branding (optional)

| Variable            | Notes                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLATFORM_APP_NAME` | Product name in **transactional email** shells (`_shared/platformBrand.ts`). Unset or `Stays` → **Kame Homes**. Does not affect the browser. |

Contact email on public/legal pages is **`VITE_PLATFORM_CONTACT_EMAIL`** in `ui/.env*` only.

#### Legacy env fallbacks (prefer DB)

| Variable                                                            | Replaced by                                    |
| ------------------------------------------------------------------- | ---------------------------------------------- |
| `FACEBOOK_REVIEWS_URL`, `AIRBNB_URL`, `INSTAGRAM_URL`, `TIKTOK_URL` | `org_settings` / `app_settings` social columns |

#### Cron webhook secrets (optional)

When set, matching cron endpoints require the corresponding header. See **`docs/archive/operations/scheduled-jobs-and-testing.md`**.

| Variable                                     | Header                                         |
| -------------------------------------------- | ---------------------------------------------- |
| `SD_REFUND_CRON_SECRET`                      | `X-Sd-Refund-Cron-Secret`                      |
| `TELEGRAM_CRON_SECRET`                       | `X-Telegram-Cron-Secret`                       |
| `TELEGRAM_STAFF_CRON_SECRET`                 | `X-Telegram-Cron-Secret`                       |
| `TELEGRAM_ADMIN_CRON_SECRET`                 | `X-Telegram-Cron-Secret`                       |
| `TELEGRAM_FINANCE_CRON_SECRET`               | `X-Telegram-Cron-Secret`                       |
| `TELEGRAM_MAINTENANCE_CRON_SECRET`           | `X-Telegram-Cron-Secret`                       |
| `PARKING_BROADCAST_EXPIRE_CRON_SECRET`       | `X-Parking-Broadcast-Expire-Cron-Secret`       |
| `PARKING_REMINDER_CRON_SECRET`               | `X-Parking-Reminder-Cron-Secret`               |
| `CONTRACT_EXPIRY_CRON_SECRET`                | `X-Contract-Expiry-Cron-Secret`                |
| `DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET`     | (dashboard assistant expire cron)              |
| `META_INBOX_WEBHOOK_HEALTHCHECK_CRON_SECRET` | `X-Meta-Inbox-Webhook-Healthcheck-Cron-Secret` |
| `PLATFORM_BILLING_CRON_SECRET`               | `X-Platform-Billing-Cron-Secret`               |
| `CALENDAR_SYNC_CRON_SECRET`                  | `X-Calendar-Sync-Cron-Secret`                  |
| `SMART_PRICING_CRON_SECRET`                  | `X-Smart-Pricing-Cron-Secret`                  |
| `SUPERHOST_ASSESSMENT_CRON_SECRET`           | `X-Superhost-Assessment-Cron-Secret`           |
| `ANALYTICS_AI_REVIEW_CRON_SECRET`            | `X-Analytics-Ai-Review-Cron-Secret`            |
| `PROPERTY_PAGE_VIEWS_PRUNE_CRON_SECRET`      | `X-Property-Page-Views-Prune-Cron-Secret`      |
| `ACTIVITY_LOG_RETENTION_CRON_SECRET`         | `X-Activity-Log-Retention-Cron-Secret`         |

**Telegram bot tokens + chat IDs:** per-property/parking DB tables — **not** env. Only `*_CRON_SECRET` vars remain env-only.

**Calendar sync (`calendarSync`, Pro+):** `CALENDAR_SYNC_CRON_SECRET` gates the global `calendar-sync-cron` sweep only (scoped "Sync now" is JWT-gated). `CALENDAR_SYNC_MIN_INTERVAL_MINUTES` (default `30`) is the per-feed minimum poll gap. Feed `.ics` URLs are stored encrypted with the existing `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` (via `_shared/secretsCrypto.ts`), never a new key.

**Marketing AI image generation (`aiMarketingImageGeneration`, Pro+):** no new env var. Reuses the platform `GEMINI_API_KEYS` / `GEMINI_API_KEY` and the shared `ai_platform_*` quota/credit system (feature `marketing_image_generate`), on the same `generativelanguage.googleapis.com/v1beta` host as every other Gemini call. Per-property tuning (`enabled`, `monthly_credit_cap`) lives in `ai_platform_property_settings.feature_configs`, not env.

**Marketing AI video generation (`aiMarketingVideoGeneration`, Business+, Phase 2):** reuses the same Gemini keys (Veo lives on the same API host). One new optional edge secret **`MARKETING_GENERATION_CRON_SECRET`** + Vault key `marketing_generation_cron_secret` gate the `marketing-generation-sweeper` cron (fail-open locally when unset, fail-closed once `ENVIRONMENT=production`, per `_shared/cronSecretGate.ts`). After a hosted deploy, run `SELECT public.sync_marketing_generation_cron_job();` once to (re)register the 1-minute pg_cron job.

**Smart Pricing (`smartPricing`, Pro+):** `SMART_PRICING_CRON_SECRET` (optional) gates the global `smart-pricing-cron` autopilot sweep. All other Smart Pricing tuning lives in `property_smart_pricing_settings` (per property, host-editable), not env. The optional AI rationale pass reuses the platform `GEMINI_API_KEYS` and the shared `ai_platform_*` quota/credit system (feature `smart_pricing`) — no new AI env var.

#### Deploy / script-only (not edge runtime)

| Variable                                                      | File                       | Notes                                   |
| ------------------------------------------------------------- | -------------------------- | --------------------------------------- |
| `DEV_PROJECT_REF`, `DEV_SUPABASE_URL`, `DEV_SERVICE_ROLE_KEY` | `supabase/.env.dev.local`  | `deploy:supabase:dev`, `dev:remote-api` |
| `PROD_PROJECT_REF`                                            | `supabase/.env.dev.local`  | Safety deny-list vs dev ref             |
| `DEV_DB_URL`                                                  | `supabase/.env.dev.local`  | Rollback script                         |
| `MT_PROD_*`, `LEGACY_PROD_PROJECT_REF`                        | `supabase/.env.prod.local` | Mt-prod bootstrap                       |
| `PROD_DB_URL`                                                 | `supabase/.env.local`      | `sync-prod-public-data-to-local.sh`     |

#### Removed (do not add back)

Google Calendar/Sheets/Gmail OAuth listener env (`GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SPREADSHEET_ID`, `GMAIL_OAUTH_*` except encryption key), global Telegram bot env (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, …), `EMAIL_TO` / `EMAIL_REPLY_TO` / `PARKING_OWNER_EMAILS` / `GCASH_*` / `SD_REFUND_CRON_*` / `EMAIL_LOGO_URL` / `PERMIT_APPROVER_EMAIL` — all migrated to **`app_settings`** / **`org_settings`** or per-property Telegram settings.

---

### 11.3 DB operator settings vs env (quick reference)

| Concern                             | DB location                       | Env fallback                            |
| ----------------------------------- | --------------------------------- | --------------------------------------- |
| GAF/pet To + Reply-To + parking BCC | `app_settings`                    | —                                       |
| Payment account + QR                | `app_settings`                    | —                                       |
| SD cron lead / max checkout age     | `app_settings`                    | —                                       |
| Org logo (email chrome)             | `org_settings`                    | default URL in code                     |
| Guest app origin                    | `org_settings`                    | `PUBLIC_GUEST_APP_ORIGIN`               |
| Social review URLs                  | org + property columns            | legacy `FACEBOOK_REVIEWS_URL`, etc.     |
| Telegram bots                       | `telegram_*_settings` (encrypted) | `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` only |

Settings UI map unchanged — see prior **`resolveAppSettings`** / Property → Settings guides under `docs/guides/routes/`.
